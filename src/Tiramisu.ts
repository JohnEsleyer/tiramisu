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
        // We only provide defaults for optional fields. 
        // Mandatory fields (width, height, fps) are taken directly from config.
        this.config = { 
            headless: true, 
            ...config 
        };
    }

    /**
     * Adds a drawing function to the timeline with specific timing and layering.
     */
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

    /**
     * Orchestrates the full render pipeline: Audio -> Browser -> FFmpeg.
     */
    public async render() {
        const { 
            width, height, fps, durationSeconds, outputFile, 
            audioFile, data, assets, videos, fonts, headless 
        } = this.config;
        
        const totalFrames = Math.ceil(fps * durationSeconds);

        const server = new TiramisuServer();
        const browser = new TiramisuBrowser();
        const cli = new TiramisuCLI(totalFrames);
        const analyzer = new AudioAnalyzer();

        // 1. Analyze Audio (if provided)
        let audioLevels: number[] = [];
        if (audioFile) {
            audioLevels = await analyzer.analyze(audioFile, fps, durationSeconds);
        }
        
        // 2. Start Stage Server & Puppeteer
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

        // 3. Start FFmpeg Encoder
        const encoder = new TiramisuEncoder(fps, outputFile, audioFile);
        cli.start();

        // 4. Main Render Loop
        for (let i = 0; i < totalFrames; i++) {
            const frameBuffer = await browser.renderFrame(i, fps, totalFrames);
            await encoder.writeFrame(frameBuffer);
            cli.update(i + 1);
        }

        // 5. Cleanup Resources
        await encoder.close();
        await browser.close();
        server.stop();
        
        cli.finish(outputFile);
    }
}