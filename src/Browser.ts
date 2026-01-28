import puppeteer, { type Browser, type Page } from 'puppeteer';
import { BROWSER_UTILS_CODE } from './Utils';
import type { Clip } from './types';

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

    public async setupScene(
        url: string, 
        clips: Clip[], 
        width: number, 
        height: number, 
        data: any, 
        assets: string[],
        fonts: { name: string, url: string }[]
    ) {
        if (!this.page) return;
        
        console.log(`   Loading Stage: ${url}`);
        await this.page.goto(url);

        await this.page.evaluate(BROWSER_UTILS_CODE);

        // Inject everything into the browser
        await this.page.evaluate(async (
            clipList: Clip[], 
            w: number, 
            h: number, 
            injectedData: any, 
            assetList: string[],
            fontList: { name: string, url: string }[]
        ) => {
            // @ts-ignore
            window.setupStage(w, h);

            // --- 1. Load Fonts ---
            if (fontList && fontList.length > 0) {
                console.log(`Loading ${fontList.length} fonts...`);
                const fontPromises = fontList.map(f => {
                    const font = new FontFace(f.name, `url(${f.url})`);
                    return font.load()
                        .then(loaded => {
                            // @ts-ignore
                            document.fonts.add(loaded);
                        })
                        .catch(err => {
                            console.error(`Failed to load font ${f.name}:`, err);
                            // Resolve null so we don't crash the entire render
                            return null;
                        });
                });
                await Promise.all(fontPromises);
                console.log("Fonts loaded (or skipped).");
            }

            // --- 2. Load Images ---
            // @ts-ignore
            window.loadedAssets = {};
            const loadPromises = assetList.map(src => new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = "Anonymous"; // Attempt to handle CORS
                img.src = src; 
                img.onload = () => { 
                    // @ts-ignore
                    window.loadedAssets[src] = img; 
                    resolve(null); 
                };
                img.onerror = (e) => {
                    console.error(`Failed to load asset: ${src}`);
                    resolve(null); // Don't crash on missing image
                }
            }));
            await Promise.all(loadPromises);

            // --- 3. Hydrate Clips ---
            // We turn the stringified functions back into real functions
            // @ts-ignore
            window.activeClips = clipList.map(c => ({
                ...c,
                fn: new Function('return ' + c.drawFunction)()
            })).sort((a, b) => a.zIndex - b.zIndex);

            // --- 4. Render Loop ---
            // @ts-ignore
            window.renderFrame = (frame, fps, totalFrames) => {
                const canvas = document.getElementById('stage') as HTMLCanvasElement;
                const ctx = canvas.getContext('2d')!;
                
                // Auto Clear
                ctx.clearRect(0, 0, w, h);
                
                // Iterate Clips
                // @ts-ignore
                window.activeClips.forEach(clip => {
                    if (frame >= clip.startFrame && frame < clip.endFrame) {
                        const localFrame = frame - clip.startFrame;
                        const duration = clip.endFrame - clip.startFrame;
                        const localProgress = localFrame / (duration - 1 || 1);

                        // Execute Draw
                        clip.fn({
                            frame,
                            progress: frame / (totalFrames - 1 || 1),
                            localFrame,
                            localProgress,
                            ctx,
                            canvas,
                            width: w,
                            height: h,
                            fps,
                            data: injectedData,
                            // @ts-ignore
                            assets: window.loadedAssets,
                            // @ts-ignore
                            utils: window.TiramisuUtils
                        });
                    }
                });
            };
        }, clips, width, height, data, assets, fonts);
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