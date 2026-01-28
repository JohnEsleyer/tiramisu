import { TiramisuServer } from './Server';
import { TiramisuBrowser } from './Browser';
import { TiramisuEncoder } from './Encoder';
import { TiramisuCLI } from './CLI';
import { AudioAnalyzer } from './AudioAnalysis';
import type { RenderConfig, DrawFunction, Clip } from './types';

export class Tiramisu<T = any> {
    private config: RenderConfig<T>;
    private clips: Clip[] = [];

    constructor(config: RenderConfig<T>) {
        this.config = { headless: true, ...config };
    }

    public addClip(startSeconds: number, durationSeconds: number, fn: DrawFunction<T>, zIndex: number = 0) {
        const startFrame = Math.floor(startSeconds * this.config.fps);
        const endFrame = startFrame + Math.floor(durationSeconds * this.config.fps);

        this.clips.push({
            id: crypto.randomUUID(),
            startFrame,
            endFrame,
            zIndex,
            drawFunction: fn.toString()
        });
    }

    public async render() {
        const { width, height, fps, durationSeconds, outputFile, headless, audioFile, data, assets, videos, fonts } = this.config;
        const totalFrames = Math.ceil(fps * durationSeconds);

        const server = new TiramisuServer();
        const browser = new TiramisuBrowser();
        const cli = new TiramisuCLI(totalFrames);
        const analyzer = new AudioAnalyzer();

        let audioLevels: number[] = [];
        if (audioFile) {
            try {
                audioLevels = await analyzer.analyze(audioFile, fps, durationSeconds);
            } catch (e) {
                console.warn("⚠️ Failed to analyze audio. Visualization will not react.", e);
            }
        }
        
        const url = server.start();
        await browser.init(width, height, headless ?? true);
        
        await browser.setupScene(
            url, 
            this.clips, 
            width, 
            height, 
            data || {}, 
            assets || [],
            videos || [], 
            fonts || [],
            audioLevels
        );

        const encoder = new TiramisuEncoder(fps, outputFile, audioFile);
        cli.start();

        for (let i = 0; i < totalFrames; i++) {
            const frameBuffer = await browser.renderFrame(i, fps, totalFrames);
            await encoder.writeFrame(frameBuffer);
            cli.update(i + 1);
        }

        await encoder.close();
        await browser.close();
        server.stop();
        
        cli.finish(outputFile);
    }
}