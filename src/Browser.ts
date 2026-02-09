import puppeteer, { type Browser, type Page } from "puppeteer";
import { BROWSER_UTILS_CODE } from "./Utils.js";
import { WEBCODECS_LOGIC } from "./WebCodecsLogic.js";
import type { Clip } from "./types.js";

export class TiramisuBrowser {
    private browser?: Browser;
    private page?: Page;

    public async init(width: number, height: number, headless: boolean) {
        this.browser = await puppeteer.launch({
            headless: headless ? "shell" : false,
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });
        this.page = await this.browser.newPage();
        await this.page.setViewport({ width, height, deviceScaleFactor: 1 });
    }

    public async setupScene(
        url: string,
        clips: Clip[],
        width: number,
        height: number,
        data: any,
        assets: string[],
        videoUrls: string[],
        audioLevels: { rms: number }[],
    ) {
        if (!this.page) return;
        await this.page.goto(url);
        
        // Inject MP4Box library for WebCodecs
        await this.page.addScriptTag({ url: 'https://unpkg.com/mp4box@0.5.5/dist/mp4box.all.min.js' });
        await this.page.evaluate(WEBCODECS_LOGIC);
        await this.page.evaluate(BROWSER_UTILS_CODE);

        await this.page.evaluate(
            async (
                clipList,
                w,
                h,
                injectedData,
                assetList,
                videoUrlList,
                levels,
            ) => {
                const win = window as any;
                document.body.style.margin = "0";
                document.body.style.padding = "0";
                document.body.style.overflow = "hidden";
                document.body.style.backgroundColor = "black";

                const canvas = document.createElement("canvas");
                canvas.width = w;
                canvas.height = h;
                canvas.style.position = "absolute";
                canvas.style.top = "0";
                canvas.style.left = "0";
                document.body.appendChild(canvas);

                win.loadedAssets = {};
                for (const src of assetList) {
                    const img = new Image();
                    img.src = src;
                    await new Promise((r) => (img.onload = r));
                    win.loadedAssets[src] = img;
                }

                // Initialize WebCodecs video controllers
                for (const videoUrl of videoUrlList) {
                    if (!win.VideoControllers.has(videoUrl)) {
                        const controller = new win.VideoController(videoUrl);
                        await controller.init();
                        win.VideoControllers.set(videoUrl, controller);
                    }
                }

                win.activeClips = clipList
                    .map((c) => ({
                        ...c,
                        fn: new Function("return " + c.drawFunction)(),
                    }))
                    .sort((a: any, b: any) => a.zIndex - b.zIndex);

                win.audioData = levels; // store the analyzed RMS data from server

                win.renderFrame = async (
                    frame: number,
                    fps: number,
                    totalFrames: number,
                    vMap: Record<string, string>,
                    rms: number,
                    bands: number[],
                ) => {
                    const ctx = canvas.getContext("2d")!;
                    const time = frame / fps;

                    // Create layer utility for compositing (matches Client.ts)
                    const layer = {
                        create: (width: number, height: number) => {
                            const layerCanvas = document.createElement('canvas');
                            layerCanvas.width = width;
                            layerCanvas.height = height;
                            const layerCtx = layerCanvas.getContext('2d')!;
                            
                            return {
                                ctx: layerCtx,
                                canvas: layerCanvas,
                                create: (w: number, h: number) => layer.create(w, h),
                                applyBlur: (amount: number) => {
                                    layerCtx.filter = `blur(${amount}px)`;
                                },
                                applyBrightness: (amount: number) => {
                                    layerCtx.filter = `brightness(${amount})`;
                                },
                                drawTo: (targetCtx: CanvasRenderingContext2D) => {
                                    targetCtx.drawImage(layerCanvas, 0, 0);
                                }
                            };
                        }
                    };

                    ctx.clearRect(0, 0, w, h);
                    for (const clip of win.activeClips) {
                        if (frame >= clip.startFrame && frame < clip.endFrame) {
                            clip.fn({
                                frame,
                                ctx,
                                canvas,
                                width: w,
                                height: h,
                                fps,
                                progress: frame / (totalFrames - 1 || 1),
                                localProgress:
                                    (frame - clip.startFrame) /
                                    (clip.endFrame - clip.startFrame - 1 || 1),
                                audioVolume: rms,
                                audioBands: bands,
                                data: injectedData,
                                assets: win.loadedAssets,
                                videos: win.VideoControllers, // Pass WebCodecs controllers
                                utils: win.TiramisuUtils,
                                layer: layer,
                            });
                        }
                    }
                };
            },
            clips,
            width,
            height,
            data,
            assets,
            videoUrls,
            audioLevels,
        );
    }

    public async renderFrame(
        frame: number,
        fps: number,
        totalFrames: number,
        vMap: Record<string, string>,
        rms: number,
        bands: number[],
    ): Promise<Uint8Array> {
        await this.page!.evaluate(
            async (f, r, tf, vm, rV, bA) => {
                await (window as any).renderFrame(f, r, tf, vm, rV, bA);
            },
            frame,
            fps,
            totalFrames,
            vMap,
            rms,
            bands,
        );
        return (await this.page!.screenshot({
            type: "png",
            omitBackground: true,
        })) as Uint8Array;
    }

    public async close() {
        await this.browser?.close();
    }
}
