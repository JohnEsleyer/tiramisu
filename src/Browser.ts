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
                // Required for autoplay/seeking without user interaction
                '--autoplay-policy=no-user-gesture-required' 
            ]
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
        videos: string[],
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
            videoList: string[],
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
                        .catch(err => console.error(`Failed to load font ${f.name}`, err));
                });
                await Promise.all(fontPromises);
            }

            // --- 2. Load Images ---
            // @ts-ignore
            window.loadedAssets = {};
            const imagePromises = assetList.map(src => new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = "Anonymous";
                img.src = src; 
                img.onload = () => { 
                    // @ts-ignore
                    window.loadedAssets[src] = img; 
                    resolve(null); 
                };
                img.onerror = () => {
                    console.error(`Failed image: ${src}`);
                    resolve(null);
                }
            }));

            // --- 3. Load Videos ---
            // @ts-ignore
            window.loadedVideos = {};
            const videoPromises = videoList.map(src => new Promise((resolve) => {
                const vid = document.createElement('video');
                vid.crossOrigin = "Anonymous";
                vid.src = src;
                vid.muted = true;
                vid.playsInline = true;
                vid.preload = "auto";
                
                // We append to body but hide it, so it's part of the DOM (helps with some browser quirks)
                vid.style.display = "none";
                document.body.appendChild(vid);

                vid.onloadeddata = () => {
                    // @ts-ignore
                    window.loadedVideos[src] = vid;
                    resolve(null);
                };
                vid.onerror = () => {
                    console.error(`Failed video: ${src}`);
                    resolve(null);
                }
            }));

            await Promise.all([...imagePromises, ...videoPromises]);
            console.log(`Assets loaded: ${assetList.length} images, ${videoList.length} videos.`);

            // --- 4. Hydrate Clips ---
            // @ts-ignore
            window.activeClips = clipList.map(c => ({
                ...c,
                fn: new Function('return ' + c.drawFunction)()
            })).sort((a, b) => a.zIndex - b.zIndex);

            // --- 5. Render Loop ---
            // @ts-ignore
            window.renderFrame = async (frame, fps, totalFrames) => {
                const canvas = document.getElementById('stage') as HTMLCanvasElement;
                const ctx = canvas.getContext('2d')!;
                const currentTime = frame / fps;

                // Sync Videos
                // We must ensure all videos are sought to the exact time of the frame
                // before we draw.
                // @ts-ignore
                const videoSyncPromises = Object.values(window.loadedVideos).map((vid: HTMLVideoElement) => {
                    return new Promise(resolve => {
                        // If already at time, skip
                        if (Math.abs(vid.currentTime - currentTime) < 0.001) return resolve(null);

                        const onSeek = () => {
                            resolve(null);
                        };
                        
                        vid.addEventListener('seeked', onSeek, { once: true });
                        vid.currentTime = currentTime;
                    });
                });
                await Promise.all(videoSyncPromises);

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
                            videos: window.loadedVideos,
                            // @ts-ignore
                            utils: window.TiramisuUtils
                        });
                    }
                });
            };
        }, clips, width, height, data, assets, videos, fonts);
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