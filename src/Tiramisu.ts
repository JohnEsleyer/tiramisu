import { TiramisuServer } from "./Server.js";
import { TiramisuBrowser } from "./Browser.js";
import { TiramisuEncoder } from "./Encoder.js";
import { TiramisuCLI } from "./CLI.js";
import { AudioAnalyzer } from "./AudioAnalysis.js";
import { spawn } from "node:child_process";
import { unlinkSync, writeFileSync } from "fs";
import type {
    RenderConfig,
    DrawFunction,
    Clip,
    ProgressPayload,
    WorkerPayload,
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
        const numWorkers = this.config.parallel || 1;

        if (numWorkers > 1) {
            return this.renderParallel(numWorkers, onProgress);
        } else {
            return this.renderSingleThreaded(onProgress);
        }
    }

    private async renderSingleThreaded(
        onProgress?: (p: ProgressPayload) => void,
    ) {
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
            const vMap: Record<string, string> = {};
            videoPaths.forEach(p => vMap[p] = `${url}/${p}`);

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

    private async renderParallel(
        numWorkers: number,
        onProgress?: (p: ProgressPayload) => void,
    ) {
        const { fps, durationSeconds, outputFile, audioFile } = this.config;
        const totalFrames = Math.ceil(fps * durationSeconds);
        const framesPerChunk = Math.ceil(totalFrames / numWorkers);
        const startTime = performance.now();

        console.log(`🚀 Parallel Render: Spawning ${numWorkers} workers...`);

        const workerPromises: Promise<void>[] = [];
        const chunkFiles: string[] = [];
        let completedFrames = 0;
        const cli = new TiramisuCLI(totalFrames);
        cli.start();

        for (let i = 0; i < numWorkers; i++) {
            const startFrame = i * framesPerChunk;
            const endFrame = Math.min(startFrame + framesPerChunk, totalFrames);

            const worker = new Worker(
                new URL("./RenderWorker.ts", import.meta.url).href,
                {
                    type: "module",
                },
            );

            const promise = new Promise<void>((resolve, reject) => {
                worker.onmessage = (event) => {
                    if (event.data.type === "progress") {
                        completedFrames++;
                        cli.update(completedFrames);

                        if (onProgress) {
                            const elapsedSeconds =
                                (performance.now() - startTime) / 1000;
                            const actualFps = completedFrames / elapsedSeconds;
                            const remainingFrames = totalFrames - completedFrames;
                            const etaSeconds =
                                completedFrames > 0
                                    ? Math.round(remainingFrames / actualFps)
                                    : 0;

                            onProgress({
                                frame: completedFrames,
                                total: totalFrames,
                                percent: Math.round(
                                    (completedFrames / totalFrames) * 100,
                                ),
                                eta: etaSeconds,
                            });
                        }
                    } else if (event.data.type === "done") {
                        chunkFiles.push(event.data.chunkOutputFile);
                        worker.terminate();
                        resolve();
                    }
                };

                worker.onerror = (error) => {
                    console.error(`Worker ${i} error:`, error);
                    worker.terminate();
                    reject(error);
                };
            });

            const payload: WorkerPayload = {
                workerId: i,
                startFrame,
                endFrame,
                config: this.config,
                clips: this.clips,
            };

            worker.postMessage(payload);
            workerPromises.push(promise);
        }

        await Promise.all(workerPromises);

        console.log(`\n📦 Stitching ${chunkFiles.length} fragments...`);

        chunkFiles.sort((a, b) => {
            const numA = parseInt(a.match(/\d+/)![0]);
            const numB = parseInt(b.match(/\d+/)![0]);
            return numA - numB;
        });

        const concatListPath = ".tiramisu-concat.txt";
        const listContent = chunkFiles.map((f) => `file '${f}'`).join("\n");
        writeFileSync(concatListPath, listContent);

        const finalArgs = [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            concatListPath,
        ];

        if (audioFile) {
            finalArgs.push("-i", audioFile);
            finalArgs.push(
                "-c:v",
                "copy",
                "-c:a",
                "aac",
                "-map",
                "0:v:0",
                "-map",
                "1:a:0",
                "-shortest",
            );
        } else {
            finalArgs.push("-c", "copy");
        }

        finalArgs.push(outputFile!);

        const proc = spawn(finalArgs[0], finalArgs.slice(1));
        await new Promise<void>((resolve, reject) => {
            proc.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`FFmpeg exited with code ${code}`));
            });
            proc.on('error', reject);
        });

        chunkFiles.forEach((f) => {
            try { unlinkSync(f); } catch (e) {}
        });
        try { unlinkSync(concatListPath); } catch (e) {}

        cli.finish(outputFile!);
    }
}