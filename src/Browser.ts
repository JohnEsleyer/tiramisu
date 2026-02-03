import puppeteer, { type Browser, type Page } from 'puppeteer';
import { BROWSER_UTILS_CODE } from './Utils';
import type { Clip } from './types';

export class TiramisuBrowser {
    private browser?: Browser;
    private page?: Page;

    public async init(width: number, height: number, headless: boolean) {
        this.browser = await puppeteer.launch({
            headless: headless ? "shell" : false,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        this.page = await this.browser.newPage();
        await this.page.setViewport({ width, height, deviceScaleFactor: 1 });
    }

    public async setupScene(
        url: string, clips: Clip[], width: number, height: number, 
        data: any, assets: string[], videoKeys: string[], audioLevels: number[]
    ) {
        if (!this.page) return;
        await this.page.goto(url);
        await this.page.evaluate(BROWSER_UTILS_CODE);

        await this.page.evaluate(async (clipList, w, h, injectedData, assetList, videoKeyList, levels) => {
            const win = window as any;
            document.body.style.margin = "0"; document.body.style.padding = "0";
            document.body.style.overflow = "hidden"; document.body.style.backgroundColor = "black";

            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.style.position = "absolute"; canvas.style.top = "0"; canvas.style.left = "0";
            document.body.appendChild(canvas);
            
            win.loadedAssets = {};
            for (const src of assetList) {
                const img = new Image(); img.src = src;
                await new Promise(r => img.onload = r);
                win.loadedAssets[src] = img;
            }

            win.loadedVideos = {};
            videoKeyList.forEach(key => { win.loadedVideos[key] = new Image(); });

            win.activeClips = clipList.map(c => ({
                ...c, fn: new Function('return ' + c.drawFunction)()
            })).sort((a: any, b: any) => a.zIndex - b.zIndex);

            win.renderFrame = async (frame: number, fps: number, totalFrames: number, vMap: Record<string, string>) => {
                const ctx = canvas.getContext('2d')!;
                await Promise.all(Object.entries(vMap).map(([key, path]) => {
                    return new Promise(res => {
                        const img = win.loadedVideos[key];
                        if (img.src.includes(path)) return res(null);
                        img.onload = () => res(null); img.src = path;
                    });
                }));

                ctx.clearRect(0, 0, w, h);
                for (const clip of win.activeClips) {
                    if (frame >= clip.startFrame && frame < clip.endFrame) {
                        clip.fn({
                            frame, ctx, canvas, width: w, height: h, fps,
                            progress: frame / (totalFrames - 1 || 1),
                            localProgress: (frame - clip.startFrame) / (clip.endFrame - clip.startFrame - 1 || 1),
                            audioVolume: levels[frame] || 0,
                            data: injectedData, assets: win.loadedAssets, videos: win.loadedVideos, utils: win.TiramisuUtils
                        });
                    }
                }
            };
        }, clips, width, height, data, assets, videoKeys, audioLevels);
    }

    public async renderFrame(frame: number, fps: number, totalFrames: number, vMap: Record<string, string>): Promise<Uint8Array> {
        await this.page!.evaluate(async (f, r, tf, vm) => {
            await (window as any).renderFrame(f, r, tf, vm);
        }, frame, fps, totalFrames, vMap);
        return await this.page!.screenshot({ type: "png", omitBackground: true }) as Uint8Array;
    }

    public async close() { await this.browser?.close(); }
}