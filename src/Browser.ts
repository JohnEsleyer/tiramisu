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
        
        this.page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    }

    public async setupScene(url: string, drawFunctionString: string, width: number, height: number, data: any, assets: string[]) {
        if (!this.page) return;
        
        console.log(`   Loading Stage: ${url}`);
        await this.page.goto(url);

        // Preload Assets & Inject Logic
        await this.page.evaluate(async (fnString: string, w: number, h: number, injectedData: any, assetList: string[]) => {
            // @ts-ignore
            window.setupStage(w, h);

            // 1. Preload Assets
            // @ts-ignore
            window.loadedAssets = {};
            const loadPromises = assetList.map(src => new Promise((resolve, reject) => {
                const img = new Image();
                img.src = src; // Server middleware handles local paths
                img.onload = () => { 
                    // @ts-ignore
                    window.loadedAssets[src] = img; 
                    resolve(null); 
                };
                img.onerror = (e) => reject(`Failed to load asset: ${src}`);
            }));

            if (assetList.length > 0) {
                console.log(`Loading ${assetList.length} assets...`);
                await Promise.all(loadPromises);
                console.log("Assets loaded.");
            }
            
            // 2. Setup Draw Logic
            // @ts-ignore
            window.userDrawLogic = new Function('return ' + fnString)();

            // 3. Define Render Hook
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
                    fps,
                    data: injectedData,
                    // @ts-ignore
                    assets: window.loadedAssets
                });
            };
        }, drawFunctionString, width, height, data, assets);
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