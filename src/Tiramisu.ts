import { TiramisuServer } from "./Server.js";
import { TiramisuBrowser } from "./Browser.js";
import { TiramisuEncoder } from "./Encoder.js";
import { TiramisuCLI } from "./CLI.js";
import { AudioAnalyzer } from "./AudioAnalysis.js";
import { VideoManager } from "./VideoManager.js";
import type { RenderConfig, DrawFunction, Clip } from "./types.js";
import { join } from "path";

/**
 * Metadata provided during the rendering process to track progress.
 */
export type ProgressPayload = {
    frame: number;
    total: number;
    percent: number;
    eta: number; // Estimated seconds remaining
};

export class Tiramisu<T = any> {
    private config: RenderConfig<T>;
    private clips: Clip[] = [];

    constructor(config: RenderConfig<T>) {
        this.config = { headless: true, ...config };
    }

    /**
     * Registers a clip to occupy a segment of the video timeline.
     * @param start Start time in seconds.
     * @param dur Duration in seconds.
     * @param fn The drawing function (Unified Canvas API).
     * @param z Index for layering (higher is on top).
     */
    public addClip(
        start: number,
        dur: number,
        fn: DrawFunction<T>,
        z: number = 0,
    ) {
        this.clips.push({
            id: crypto.randomUUID(),
            startFrame: Math.floor(start * this.config.fps),
            endFrame: Math.floor((start + dur) * this.config.fps),
            zIndex: z,
            // Convert function to string for injection into the browser environment
            drawFunction: fn.toString(),
        });
    }

    /**
     * Orchestrates the video creation process: extraction, analysis, rendering, and encoding.
     * @param onProgress Callback invoked every frame to report status.
     */
    public async render(onProgress?: (p: ProgressPayload) => void) {
        const {
            width,
            height,
            fps,
            durationSeconds,
            outputFile,
            audioFile,
            data,
            headless,
        } = this.config;

        const totalFrames = Math.ceil(fps * durationSeconds);
        const startTime = performance.now();

        // 1. Prepare Video Assets (Frame Extraction)
        const videoManager = new VideoManager();
        const videoFrameMaps: Record<
            string,
            { folder: string; count: number }
        > = {};

        if (this.config.videos) {
            for (const path of this.config.videos) {
                const relativePath = path.startsWith("/")
                    ? path.slice(1)
                    : path;
                const fsPath = join(process.cwd(), relativePath);
                const result = await videoManager.extractFrames(fsPath, fps);
                videoFrameMaps[path] = result;
            }
        }

        // 2. Initialize Internal Services
        const server = new TiramisuServer();
        const browser = new TiramisuBrowser();
        const encoder = new TiramisuEncoder(
            fps,
            outputFile!,
            audioFile,
            durationSeconds,
        );
        const cli = new TiramisuCLI(totalFrames);

        // 3. Audio Analysis (Rust/WASM powered)
        // This ensures audioBands and audioVolume are deterministic
        const audioAnalysisData = audioFile
            ? await new AudioAnalyzer().analyze(audioFile, fps, durationSeconds)
            : [];

        // 4. Start Internal Assets Server & Browser
        const url = server.start();
        await browser.init(width, height, headless ?? true);

        // Setup the browser context with clips, assets, and audio data
        await browser.setupScene(
            url,
            this.clips,
            width,
            height,
            data || {},
            this.config.assets || [],
            Object.keys(videoFrameMaps),
            audioAnalysisData,
        );

        cli.start();

        // 5. Main Render Loop
        for (let i = 0; i < totalFrames; i++) {
            // Map video paths to their specific extracted frames for this global index
            const vMap: Record<string, string> = {};
            for (const [key, info] of Object.entries(videoFrameMaps)) {
                const idx = (i % info.count) + 1;
                vMap[key] =
                    `/${info.folder}/frame_${idx.toString().padStart(5, "0")}.jpg`;
            }

            const { rms, bands } = audioAnalysisData[i] || {
                rms: 0,
                bands: Array(32).fill(0),
            };

            // Render the frame in Puppeteer and grab the buffer
            const buffer = await browser.renderFrame(
                i,
                fps,
                totalFrames,
                vMap,
                rms,
                bands,
            );

            // Stream buffer directly to FFmpeg via STDIN
            await encoder.writeFrame(buffer);

            // Update local CLI output
            const currentFrame = i + 1;
            cli.update(currentFrame);

            // Report Progress to external listeners (e.g., UbeStudio Progress Modal)
            if (onProgress) {
                const elapsedSeconds = (performance.now() - startTime) / 1000;
                const actualFps = currentFrame / elapsedSeconds;
                const remainingFrames = totalFrames - currentFrame;
                const etaSeconds =
                    i > 0 ? Math.round(remainingFrames / actualFps) : 0;

                onProgress({
                    frame: currentFrame,
                    total: totalFrames,
                    percent: Math.round((currentFrame / totalFrames) * 100),
                    eta: etaSeconds,
                });
            }
        }

        // 6. Finalization & Cleanup
        await encoder.close();
        await browser.close();
        server.stop();
        cli.finish(outputFile!);
    }
}
