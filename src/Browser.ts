import puppeteer, { type Browser, type Page } from 'puppeteer';
import { BROWSER_UTILS_CODE } from './Utils';
import type { Clip } from './types';

export class TiramisuBrowser {
    private browser?: Browser;
    private page?: Page;

    public async init(width: number, height: number, headless: boolean) {
        this.browser = await puppeteer.launch({
            headless: headless,
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--font-render-hinting=none',
                '--autoplay-policy=no-user-gesture-required' 
            ]
        });
        this.page = await this.browser.newPage();
        await this.page.setViewport({ width, height, deviceScaleFactor: 1 });
        
        // Console logs are disabled to prevent CLI artifacts
        // this.page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    }

    public async setupScene(
        url: string, 
        clips: Clip[], 
        width: number, 
        height: number, 
        data: any, 
        assets: string[],
        videos: string[],
        fonts: { name: string, url: string }[],
        audioLevels: number[]
    ) {
        if (!this.page) return;
        
        console.log(`   Loading Stage: ${url}`);
        await this.page.goto(url);

        await this.page.evaluate(BROWSER_UTILS_CODE);

        await this.page.evaluate(async (
            clipList: Clip[], 
            w: number, 
            h: number, 
            injectedData: any, 
            assetList: string[],
            videoList: string[],
            fontList: { name: string, url: string }[],
            levels: number[]
        ) => {
            // @ts-ignore
            window.setupStage(w, h);

            if (fontList && fontList.length > 0) {
                const fontPromises = fontList.map(f => {
                    const font = new FontFace(f.name, `url(${f.url})`);
                    return font.load().then(loaded => {
                         // @ts-ignore
                         document.fonts.add(loaded);
                    }).catch(e => console.error(e));
                });
                await Promise.all(fontPromises);
            }

            // @ts-ignore
            window.loadedAssets = {};
            const imagePromises = assetList.map(src => new Promise(res => {
                const img = new Image(); img.crossOrigin="Anonymous"; img.src = src;
                // @ts-ignore
                img.onload = () => { window.loadedAssets[src] = img; res(null); };
                img.onerror = () => res(null);
            }));

            // @ts-ignore
            window.loadedVideos = {};
            const videoPromises = videoList.map(src => new Promise(res => {
                const vid = document.createElement('video'); vid.crossOrigin="Anonymous"; vid.src = src; vid.muted = true; vid.playsInline = true; vid.style.display = "none"; document.body.appendChild(vid);
                // @ts-ignore
                vid.onloadeddata = () => { window.loadedVideos[src] = vid; res(null); };
                vid.onerror = () => res(null);
            }));

            await Promise.all([...imagePromises, ...videoPromises]);

            // @ts-ignore
            window.activeClips = clipList.map(c => ({
                ...c,
                fn: new Function('return ' + c.drawFunction)()
            })).sort((a, b) => a.zIndex - b.zIndex);

            // @ts-ignore
            window.renderFrame = async (frame, fps, totalFrames) => {
                const canvas = document.getElementById('stage') as HTMLCanvasElement;
                const ctx = canvas.getContext('2d')!;
                const currentTime = frame / fps;

                // @ts-ignore
                const videoSyncPromises = Object.values(window.loadedVideos).map((vid: HTMLVideoElement) => {
                    return new Promise(resolve => {
                        if (Math.abs(vid.currentTime - currentTime) < 0.001) return resolve(null);
                        const onSeek = () => resolve(null);
                        vid.addEventListener('seeked', onSeek, { once: true });
                        vid.currentTime = currentTime;
                    });
                });
                await Promise.all(videoSyncPromises);

                ctx.clearRect(0, 0, w, h);
                
                const currentVolume = levels[frame] || 0;

                // @ts-ignore
                window.activeClips.forEach(clip => {
                    if (frame >= clip.startFrame && frame < clip.endFrame) {
                        const localFrame = frame - clip.startFrame;
                        const duration = clip.endFrame - clip.startFrame;
                        
                        clip.fn({
                            frame,
                            progress: frame / (totalFrames - 1 || 1),
                            localFrame,
                            localProgress: localFrame / (duration - 1 || 1),
                            audioVolume: currentVolume,
                            ctx,
                            canvas,
                            width: w,
                            height: h,
                            fps,
                            data: injectedData,
                            // @ts-ignore
                            assets: window.loadedAssets,
                            // @ts-ignore
                            videos: window.loadedVideos,
                            // @ts-ignore
                            utils: window.TiramisuUtils
                        });
                    }
                });
            };
        }, clips, width, height, data, assets, videos, fonts, audioLevels);
    }

    public async renderFrame(frame: number, fps: number, totalFrames: number): Promise<Uint8Array> {
        if (!this.page) throw new Error("Browser not initialized");
        await this.page.evaluate(async (f, r, tf) => {
            // @ts-ignore
            await window.renderFrame(f, r, tf);
        }, frame, fps, totalFrames);

        return await this.page.screenshot({ type: "png", omitBackground: true }) as Uint8Array;
    }

    public async close() {
        await this.browser?.close();
    }
}