import { TiramisuServer } from './Server';
import { TiramisuBrowser } from './Browser';
import { TiramisuEncoder } from './Encoder';
import { TiramisuCLI } from './CLI';
import type { RenderConfig, DrawFunction } from './types';

export class Tiramisu<T = any> {
    private config: RenderConfig<T>;
    private drawFunctionString: string = "() => {}";

    constructor(config: RenderConfig<T>) {
        this.config = { headless: true, ...config };
    }

    public scene(fn: DrawFunction<T>) {
        this.drawFunctionString = fn.toString();
    }

    public async render() {
        const { width, height, fps, durationSeconds, outputFile, headless, audioFile, data, assets } = this.config;
        const totalFrames = Math.ceil(fps * durationSeconds);

        const server = new TiramisuServer();
        const browser = new TiramisuBrowser();
        const cli = new TiramisuCLI(totalFrames);
        
        const url = server.start();
        await browser.init(width, height, headless ?? true);
        
        // Pass 'assets' array (defaults to empty)
        await browser.setupScene(url, this.drawFunctionString, width, height, data || {}, assets || []);

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