import { TiramisuServer } from './Server';
import { TiramisuBrowser } from './Browser';
import { TiramisuEncoder } from './Encoder';
import { TiramisuCLI } from './CLI';
import { AudioAnalyzer } from './AudioAnalysis';
import { VideoManager } from './VideoManager';
import type { RenderConfig, DrawFunction, Clip } from './types';

export class Tiramisu<T = any> {
    private config: RenderConfig<T>;
    private clips: Clip[] = [];

    constructor(config: RenderConfig<T>) { this.config = { headless: true, ...config }; }

    public addClip(start: number, dur: number, fn: DrawFunction<T>, z: number = 0) {
        this.clips.push({
            id: crypto.randomUUID(),
            startFrame: Math.floor(start * this.config.fps),
            endFrame: Math.floor((start + dur) * this.config.fps),
            zIndex: z,
            drawFunction: fn.toString()
        });
    }

    public async render() {
        const { width, height, fps, durationSeconds, outputFile, audioFile, data, headless } = this.config;
        const totalFrames = Math.ceil(fps * durationSeconds);

        const videoManager = new VideoManager();
        const videoFrameMaps: Record<string, { folder: string, count: number }> = {};
        
        if (this.config.videos) {
            for (const path of this.config.videos) {
                const fsPath = path.startsWith('/') ? path.slice(1) : path;
                const result = await videoManager.extractFrames(fsPath, fps);
                videoFrameMaps[path] = result;
            }
        }

        const server = new TiramisuServer();
        const browser = new TiramisuBrowser();
        const encoder = new TiramisuEncoder(fps, outputFile!, audioFile);
        const cli = new TiramisuCLI(totalFrames);
        const audioLevels = audioFile ? await new AudioAnalyzer().analyze(audioFile, fps, durationSeconds) : [];

        const url = server.start();
        await browser.init(width, height, headless ?? true);
        await browser.setupScene(url, this.clips, width, height, data || {}, this.config.assets || [], Object.keys(videoFrameMaps), audioLevels);

        cli.start();
        for (let i = 0; i < totalFrames; i++) {
            const vMap: Record<string, string> = {};
            for (const [key, info] of Object.entries(videoFrameMaps)) {
                const idx = (i % info.count) + 1;
                vMap[key] = `/${info.folder}/frame_${idx.toString().padStart(5, '0')}.jpg`;
            }
            const buffer = await browser.renderFrame(i, fps, totalFrames, vMap);
            await encoder.writeFrame(buffer);
            cli.update(i + 1);
        }

        await encoder.close(); await browser.close(); server.stop();
        cli.finish(outputFile!);
    }
}