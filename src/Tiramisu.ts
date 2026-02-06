import { TiramisuServer } from "./Server.js";
import { TiramisuBrowser } from "./Browser.js";
import { TiramisuEncoder } from "./Encoder.js";
import { TiramisuCLI } from "./CLI.js";
import { AudioAnalyzer } from "./AudioAnalysis.js";
import { VideoManager } from "./VideoManager.js";
import type {
    RenderConfig,
    DrawFunction,
    Clip,
    ProgressPayload,
} from "./types.js";
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

        const server = new TiramisuServer();
        const browser = new TiramisuBrowser();
        const encoder = new TiramisuEncoder(
            fps,
            outputFile!,
            audioFile,
            durationSeconds,
        );
        const cli = new TiramisuCLI(totalFrames);

        const audioAnalysisData = audioFile
            ? await new AudioAnalyzer().analyze(audioFile, fps, durationSeconds)
            : [];

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

            const buffer = await browser.renderFrame(
                i,
                fps,
                totalFrames,
                vMap,
                rms,
                bands,
            );
            await encoder.writeFrame(buffer);

            const currentFrame = i + 1;
            cli.update(currentFrame);

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

        await encoder.close();
        await browser.close();
        server.stop();
        cli.finish(outputFile!);
    }
}
