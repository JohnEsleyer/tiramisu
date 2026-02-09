import puppeteer, { type Browser, type Page } from "puppeteer";
import { BROWSER_UTILS_CODE } from "./Utils.js";
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
        await this.page.evaluate(BROWSER_UTILS_CODE);

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
                videoKeyList.forEach((key) => {
                    win.loadedVideos[key] = new Image();
                });

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

                    // --- CRITICAL CHANGE: ADDING ERROR HANDLER TO IMAGE LOADS ---
                    await Promise.all(
                        Object.entries(vMap).map(([key, path]) => {
                            return new Promise((res) => {
                                const img = win.loadedVideos[key];
                                // If src is already correct, resolve immediately
                                if (img.src.includes(path)) return res(null);

                                const onError = () => {
                                    console.error(
                                        `[Puppeteer] FAILED to load frame image: ${path}`,
                                    );
                                    img.removeEventListener("load", onLoad);
                                    res(null); // Resolve to prevent render hang, even on failure
                                };

                                const onLoad = () => {
                                    img.removeEventListener("error", onError); // Cleanup
                                    res(null);
                                };

                                img.onload = onLoad;
                                img.onerror = onError;

                                img.src = path;
                            });
                        }),
                    );
                    // --- END CRITICAL CHANGE ---

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
                                videos: win.loadedVideos,
                                utils: win.TiramisuUtils,
                                layer: {
                                    create: (lw?: number, lh?: number) => {
                                        const layerWidth = lw ?? w;
                                        const layerHeight = lh ?? h;
                                        return win.TiramisuUtils.createLayer(layerWidth, layerHeight);
                                    },
                                },
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
