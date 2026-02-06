import { TiramisuServer } from "./Server.js";
import { TiramisuBrowser } from "./Browser.js";
import { TiramisuEncoder } from "./Encoder.js";
import { TiramisuCLI } from "./CLI.js";
import { AudioAnalyzer } from "./AudioAnalysis.js";
import { VideoManager } from "./VideoManager.js";
import type { RenderConfig, DrawFunction, Clip } from "./types.js";
import { join } from "path";

export class Tiramisu<T = any> {
    private config: RenderConfig<T>;
    private clips: Clip[] = [];

    constructor(config: RenderConfig<T>) {
        this.config = { headless: true, ...config };
    }

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
            drawFunction: fn.toString(),
        });
    }

    public async render() {
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
        // BANDS_COUNT is now inside AudioAnalyzer

        const videoManager = new VideoManager();
        const videoFrameMaps: Record<
            string,
            { folder: string; count: number }
        > = {};

        if (this.config.videos) {
            for (const path of this.config.videos) {
                // The 'path' starts with '/' for uploaded files (e.g., '/upload_vid_123.mp4')
                // and is the web-accessible URL. FFmpeg needs the file system path.
                const relativePath = path.startsWith("/")
                    ? path.slice(1)
                    : path;

                // CRITICAL FIX: Resolve the absolute path for FFmpeg/VideoManager robustness
                // We assume the file was saved in the CWD by examples/serve.ts
                const fsPath = join(process.cwd(), relativePath);

                const result = await videoManager.extractFrames(fsPath, fps);
                videoFrameMaps[path] = result;
            }
        }

        const server = new TiramisuServer();
        const browser = new TiramisuBrowser();
        const encoder = new TiramisuEncoder(
            fps,
            outputFile!,
            audioFile,
            durationSeconds,
        );
        const cli = new TiramisuCLI(totalFrames);

        // Analyze audio for both RMS and Bands
        // AudioAnalyzer now returns full band data
        const audioAnalysisData = audioFile
            ? await new AudioAnalyzer().analyze(audioFile, fps, durationSeconds)
            : [];

        const url = server.start();
        await browser.init(width, height, headless ?? true);

        // Pass the full analysis data to the browser
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
        for (let i = 0; i < totalFrames; i++) {
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

            // Pass the REAL bands data to Puppeteer's renderFrame
            const buffer = await browser.renderFrame(
                i,
                fps,
                totalFrames,
                vMap,
                rms,
                bands,
            );
            await encoder.writeFrame(buffer);
            cli.update(i + 1);
        }

        await encoder.close();
        await browser.close();
        server.stop();
        cli.finish(outputFile!);
    }
}
