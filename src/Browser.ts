import puppeteer, { type Browser, type Page } from 'puppeteer';

export class TiramisuBrowser {
    private browser?: Browser;
    private page?: Page;

    public async init(width: number, height: number, headless: boolean) {
        this.browser = await puppeteer.launch({
            headless: headless,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none']
        });
        this.page = await this.browser.newPage();
        await this.page.setViewport({ width, height, deviceScaleFactor: 1 });
    }

    public async setupScene(url: string, drawFunctionString: string, width: number, height: number) {
        if (!this.page) return;
        await this.page.goto(url);
        await this.page.evaluate((fnString: string, w: number, h: number) => {
            // @ts-ignore
            window.setupStage(w, h);
            // @ts-ignore
            window.userDrawLogic = new Function('return ' + fnString)();
            // @ts-ignore
            window.renderFrame = (frame, fps, totalFrames) => {
                const canvas = document.getElementById('stage') as HTMLCanvasElement;
                const ctx = canvas.getContext('2d')!;
                ctx.clearRect(0, 0, w, h);
                // @ts-ignore
                window.userDrawLogic({
                    frame,
                    progress: frame / (totalFrames - 1 || 1),
                    ctx,
                    canvas,
                    width: w,
                    height: h,
                    fps
                });
            };
        }, drawFunctionString, width, height);
    }

    public async renderFrame(frame: number, fps: number, totalFrames: number): Promise<Uint8Array> {
        if (!this.page) throw new Error("Browser not initialized");
        await this.page.evaluate((f, r, tf) => {
            // @ts-ignore
            window.renderFrame(f, r, tf);
        }, frame, fps, totalFrames);

        return await this.page.screenshot({ type: "png", omitBackground: true }) as Uint8Array;
    }

    public async close() {
        await this.browser?.close();
    }
}