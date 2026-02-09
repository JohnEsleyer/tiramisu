import puppeteer, { type Browser, type Page } from "puppeteer";
import { BROWSER_UTILS_CODE } from "./Utils.js";
import { WEBCODECS_LOGIC } from "./WebCodecsLogic.js";
import { readFileSync } from "fs";
import { join } from "path";
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
        videoKeys: string[],
        audioLevels: { rms: number }[], // <-- Audio levels is now an object array
    ) {
        if (!this.page) return;
        await this.page.goto(url);
        
        // Inject MP4Box and our logic
        const mp4boxPath = join(process.cwd(), "node_modules", "mp4box", "dist", "mp4box.all.js");
        const MP4BOX_SOURCE = readFileSync(mp4boxPath, "utf-8");
        await this.page.evaluate(MP4BOX_SOURCE);
        await this.page.evaluate(BROWSER_UTILS_CODE);
        await this.page.evaluate(WEBCODECS_LOGIC);

        await this.page.evaluate(
            async (
                clipList,
                w,
                h,
                injectedData,
                assetList,
                videoKeyList,
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

                win.loadedVideos = {};
                
                // Initialize decoders for all videos in memory
                for (const videoUrl of videoKeyList) {
                    await (window as any).initVideo(videoUrl);
                }
                
                // Type assertion for videoFrames
                const videoFrames: Record<string, any> = {};

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

                    // Fetch frames from WebCodecs Decoders instead of <img> tags
                    const videoFrames: Record<string, any> = {};
                    for (const [key, path] of Object.entries(vMap)) {
                        const controller = (window as any).VideoDecoders.get(key);
                        if (controller) {
                            videoFrames[key] = await controller.getFrame(frame, fps);
                        }
                    }

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
                                videos: videoFrames,
                                utils: win.TiramisuUtils,
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
            videoKeys,
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
