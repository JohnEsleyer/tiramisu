import { TiramisuServer } from './Server';
import { TiramisuBrowser } from './Browser';
import { TiramisuEncoder } from './Encoder';
import type { RenderConfig, DrawFunction } from './types';

export class Tiramisu {
    private config: RenderConfig;
    private drawFunctionString: string = "() => {}";

    constructor(config: RenderConfig) {
        this.config = { headless: true, ...config };
    }

    public scene(fn: DrawFunction) {
        this.drawFunctionString = fn.toString();
    }

    public async render() {
        const { width, height, fps, durationSeconds, outputFile, headless } = this.config;
        const totalFrames = Math.ceil(fps * durationSeconds);
        const startTime = performance.now();

        const server = new TiramisuServer();
        const browser = new TiramisuBrowser();
        const url = server.start();

        await browser.init(width, height, headless ?? true);
        await browser.setupScene(url, this.drawFunctionString, width, height);

        const encoder = new TiramisuEncoder(fps, outputFile);

        console.log(`🎥 Rendering ${totalFrames} frames...`);

        for (let i = 0; i < totalFrames; i++) {
            const frameBuffer = await browser.renderFrame(i, fps, totalFrames);
            await encoder.writeFrame(frameBuffer);

            if (i % fps === 0) {
                const percent = Math.round((i / totalFrames) * 100);
                process.stdout.write(`\r   Progress: ${percent}% (${i}/${totalFrames})`);
            }
        }

        await encoder.close();
        await browser.close();
        server.stop();

        const totalTime = ((performance.now() - startTime) / 1000).toFixed(2);
        console.log(`\n🎉 Done! Saved to ${outputFile} in ${totalTime}s`);
    }
}
export type { RenderContext } from './types';