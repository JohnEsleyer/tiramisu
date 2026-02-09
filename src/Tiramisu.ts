import { TiramisuServer } from "./Server.js";
import { TiramisuBrowser } from "./Browser.js";
import { TiramisuEncoder } from "./Encoder.js";
import { TiramisuCLI } from "./CLI.js";
import { AudioAnalyzer } from "./AudioAnalysis.js";
import type {
    RenderConfig,
    DrawFunction,
    Clip,
    ProgressPayload,
} from "./types.js";

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

        // PHASE 3 CHANGE: No more extraction!
        // We just verify files exist and pass paths to the browser.
        const videoPaths = this.config.videos || [];

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
            videoPaths,
            audioAnalysisData,
        );

        cli.start();

        for (let i = 0; i < totalFrames; i++) {
            // vMap now just points to the original URLs
            const vMap: Record<string, string> = {};
            videoPaths.forEach(p => vMap[p] = p);

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
