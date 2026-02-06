import { TiramisuServer } from "./Server.js";
import { TiramisuBrowser } from "./Browser.js";
import { TiramisuEncoder } from "./Encoder.js";
import { TiramisuCLI } from "./CLI.js";
import { AudioAnalyzer } from "./AudioAnalysis.js";
import { VideoManager } from "./VideoManager.js";
import type { RenderConfig, DrawFunction, Clip } from "./types.js";
import { join } from "path";

/**
 * Metadata provided during the rendering process.
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
     * Registers a clip on the timeline.
     * @param start Start time in seconds
     * @param dur Duration in seconds
     * @param fn The drawing function
     * @param z Layer order (higher is on top)
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
            // We stringify the function so it can be sent to the Puppeteer context
            drawFunction: fn.toString(),
        });
    }

    /**
     * Orchestrates the video creation process.
     * @param onProgress Optional callback for real-time progress tracking
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

        // 1. Asset Preparation
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

        // 2. Component Initialization
        const server = new TiramisuServer();
        const browser = new TiramisuBrowser();
        const encoder = new TiramisuEncoder(
            fps,
            outputFile!,
            audioFile,
            durationSeconds,
        );
        const cli = new TiramisuCLI(totalFrames);

        // 3. Audio Analysis (WASM powered)
        const audioAnalysisData = audioFile
            ? await new AudioAnalyzer().analyze(audioFile, fps, durationSeconds)
            : [];

        // 4. Puppeteer Setup
        const url = server.start();
        await browser.init(width, height, headless ?? true);

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

        // 5. Render Loop
        cli.start();

        for (let i = 0; i < totalFrames; i++) {
            // Determine video frames for this specific point in time
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

            // Capture Puppeteer screenshot as PNG buffer
            const buffer = await browser.renderFrame(
                i,
                fps,
                totalFrames,
                vMap,
                rms,
                bands,
            );

            // Pipe buffer to FFmpeg STDIN
            await encoder.writeFrame(buffer);

            // Update CLI
            const currentFrame = i + 1;
            cli.update(currentFrame);

            // Report Progress to caller
            if (onProgress) {
                const elapsedSeconds = (performance.now() - startTime) / 1000;
                const fps_actual = currentFrame / elapsedSeconds;
                const remainingFrames = totalFrames - currentFrame;
                const eta =
                    i > 0 ? Math.round(remainingFrames / fps_actual) : 0;

                onProgress({
                    frame: currentFrame,
                    total: totalFrames,
                    percent: Math.round((currentFrame / totalFrames) * 100),
                    eta: eta,
                });
            }
        }

        // 6. Cleanup
        await encoder.close();
        await browser.close();
        server.stop();
        cli.finish(outputFile!);
    }
}
