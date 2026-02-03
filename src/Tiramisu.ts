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
    const { width, height, fps, durationSeconds, outputFile, audioFile, data, headless } = this.config;
    const totalFrames = Math.ceil(fps * durationSeconds);

    // --- ADD THIS CHECK HERE ---
    if (!outputFile) {
        throw new Error("Tiramisu: 'outputFile' is required for server-side rendering. Please provide it in the config.");
    }

    const server = new TiramisuServer();
    const browser = new TiramisuBrowser();
    const cli = new TiramisuCLI(totalFrames);
    const analyzer = new AudioAnalyzer();

    let audioLevels: number[] = [];
    if (audioFile) audioLevels = await analyzer.analyze(audioFile, fps, durationSeconds);
    
    const url = server.start();
    await browser.init(width, height, headless ?? true);

    // Ensure we pass all asset lists to the browser setup
    await browser.setupScene(
        url, 
        this.clips, 
        width, 
        height, 
        data || {}, 
        this.config.assets || [], 
        this.config.videos || [], 
        this.config.fonts || [], 
        audioLevels
    );

    // Now TypeScript knows outputFile is definitely a string
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