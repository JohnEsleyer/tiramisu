import { TiramisuBrowser } from "./Browser.js";
import { TiramisuEncoder } from "./Encoder.js";
import { AudioAnalyzer } from "./AudioAnalysis.js";
import { VideoManager } from "./VideoManager.js";
import { TiramisuServer } from "./Server.js";
import { join } from "path";
import type { WorkerPayload } from "./types.js";

declare var self: Worker;

self.onmessage = async (event: MessageEvent<WorkerPayload>) => {
    const { workerId, startFrame, endFrame, config, clips } = event.data;
    const chunkOutputFile = `.tiramisu-tmp-chunk-${workerId}.mp4`;

    const videoManager = new VideoManager();
    const videoFrameMaps: Record<string, { folder: string; count: number }> = {};

    // Extract video frames if needed
    if (config.videos) {
        for (const path of config.videos) {
            const relativePath = path.startsWith("/") ? path.slice(1) : path;
            const fsPath = join(process.cwd(), relativePath);
            const result = await videoManager.extractFrames(fsPath, config.fps);
            videoFrameMaps[path] = result;
        }
    }

    // Start a local server for this worker
    const server = new TiramisuServer();
    const url = server.start();

    const browser = new TiramisuBrowser();
    const encoder = new TiramisuEncoder(
        config.fps,
        chunkOutputFile,
        undefined, // Render segments silently
        (endFrame - startFrame) / config.fps,
    );

    const audioAnalysisData = config.audioFile
        ? await new AudioAnalyzer().analyze(
              config.audioFile,
              config.fps,
              config.durationSeconds,
          )
        : [];

    await browser.init(config.width, config.height, true);

    await browser.setupScene(
        url,
        clips,
        config.width,
        config.height,
        config.data || {},
        config.assets || [],
        Object.keys(videoFrameMaps),
        audioAnalysisData,
    );

    const totalFrames = Math.ceil(config.fps * config.durationSeconds);

    for (let i = startFrame; i < endFrame; i++) {
        const { rms, bands } = audioAnalysisData[i] || {
            rms: 0,
            bands: Array(32).fill(0),
        };
        const vMap: Record<string, string> = {};
        for (const [key, info] of Object.entries(videoFrameMaps)) {
            const idx = (i % info.count) + 1;
            vMap[key] =
                `/${info.folder}/frame_${idx.toString().padStart(5, "0")}.jpg`;
        }

        const buffer = await browser.renderFrame(
            i,
            config.fps,
            totalFrames,
            vMap,
            rms,
            bands,
        );
        await encoder.writeFrame(buffer);

        // Report progress back to main thread
        self.postMessage({ type: "progress", workerId, frame: i });
    }

    await encoder.close();
    await browser.close();
    server.stop();

    self.postMessage({ type: "done", chunkOutputFile, workerId });
};
