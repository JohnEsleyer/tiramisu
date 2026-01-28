import { TiramisuServer } from './Server';
import { TiramisuBrowser } from './Browser';
import { TiramisuEncoder } from './Encoder';
import { TiramisuCLI } from './CLI';
import type { RenderConfig, DrawFunction, Clip } from './types';

export class Tiramisu<T = any> {
    private config: RenderConfig<T>;
    private clips: Clip[] = [];

    constructor(config: RenderConfig<T>) {
        this.config = { headless: true, ...config };
    }

    /**
     * Add a clip to the timeline.
     * @param startSeconds When the clip starts
     * @param durationSeconds How long the clip lasts
     * @param fn The drawing function
     * @param zIndex Layer order (default 0)
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

    public async render() {
        const { width, height, fps, durationSeconds, outputFile, headless, audioFile, data, assets, fonts } = this.config;
        const totalFrames = Math.ceil(fps * durationSeconds);

        const server = new TiramisuServer();
        const browser = new TiramisuBrowser();
        const cli = new TiramisuCLI(totalFrames);
        
        const url = server.start();
        await browser.init(width, height, headless ?? true);
        
        await browser.setupScene(
            url, 
            this.clips, 
            width, 
            height, 
            data || {}, 
            assets || [],
            fonts || []
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
export type { RenderContext } from './types';