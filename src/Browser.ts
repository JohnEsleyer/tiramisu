import puppeteer, { type Browser, type Page } from "puppeteer";
import { BROWSER_UTILS_CODE } from "./Utils.js";
import type { Clip } from "./types.js";

export class TiramisuBrowser {
    private browser?: Browser;
    private page?: Page;

    public async init(width: number, height: number, headless: boolean) {
        this.browser = await puppeteer.launch({
            headless: headless ? "shell" : false,
            args: [
                "--no-sandbox", 
                "--disable-setuid-sandbox",
                // Essential for WebCodecs in headless mode on some machines:
                "--enable-features=SharedArrayBuffer", 
                "--use-gl=egl" // often helps with headless canvas
            ],
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
        videoPaths: string[],
        audioLevels: { rms: number }[],
    ) {
        if (!this.page) return;
        
        await this.page.goto(url);
        
        // Inject Utils
        await this.page.evaluate(BROWSER_UTILS_CODE);

        // Inject MP4Box Library
        // We need to add the mp4box library to the page context
        await this.page.addScriptTag({ 
            path: require.resolve("mp4box/dist/mp4box.all.js") 
        });

        // Inject VideoController Class Definition
        await this.page.evaluate(() => {
            (window as any).VideoController = class VideoController {
                constructor(url) {
                    this.url = url;
                    this.ready = false;
                    this.file = (window as any).MP4Box.createFile();
                    this.decoder = new VideoDecoder({
                        output: (frame) => {
                            if (this.currentFrame) this.currentFrame.close();
                            this.currentFrame = frame;
                        },
                        error: (e) => console.error("VideoDecoder Error:", e)
                    });
                }
                
                async load() {
                    const resp = await fetch(this.url);
                    const buf = await resp.arrayBuffer();
                    buf.fileStart = 0;
                    
                    return new Promise((resolve, reject) => {
                        this.file.onReady = (info) => {
                            this.info = info;
                            this.track = info.videoTracks[0];
                            if (!this.track) {
                                reject(new Error("No video track found"));
                                return;
                            }
                            
                            this.width = this.track.video.width;
                            this.height = this.track.video.height;
                            this.duration = info.duration / info.timescale;
                            
                            this.file.setExtractionOptions(this.track.id, null, { nbSamples: 10000 });
                            this.file.start();
                        };
                        this.file.onSamples = (id, user, samples) => {
                            if (id === this.track.id) {
                                this.samples = samples;
                                
                                // Extract codec description
                                const avc1 = this.track.mdia?.minf?.stbl?.stsd?.entries?.find(e => e.type === 'avc1');
                                const desc = avc1?.avcC ? new Uint8Array(avc1.avcC.data) : undefined;
                                
                                this.decoder.configure({
                                    codec: this.track.codec,
                                    codedWidth: this.width,
                                    codedHeight: this.height,
                                    description: desc
                                });
                                this.ready = true;
                                resolve(null);
                            }
                        };
                        this.file.appendBuffer(buf);
                        this.file.flush();
                    });
                }

                async seek(time) {
                    if (!this.ready || !this.samples || this.samples.length === 0) return;
                    
                    const timescale = this.info.timescale;
                    const timeTicks = time * timescale;
                    
                    // Find the sample at the specific time
                    let sampleIndex = this.samples.findIndex(s => s.cts >= timeTicks);
                    if (sampleIndex === -1) sampleIndex = this.samples.length - 1;
                    if (sampleIndex < 0) sampleIndex = 0;

                    // Find the nearest preceding Keyframe
                    let keyIdx = sampleIndex;
                    while(keyIdx > 0 && !this.samples[keyIdx].is_sync) keyIdx--;

                    await this.decoder.flush();
                    
                    for(let i=keyIdx; i<=sampleIndex; i++) {
                        const s = this.samples[i];
                        const chunk = new EncodedVideoChunk({
                            type: s.is_sync ? 'key' : 'delta',
                            timestamp: (s.cts * 1000000) / timescale,
                            duration: (s.duration * 1000000) / timescale,
                            data: s.data
                        });
                        this.decoder.decode(chunk);
                    }
                    await this.decoder.flush();
                }

                draw(ctx, x, y, w, h) {
                    if (this.currentFrame) ctx.drawImage(this.currentFrame, x, y, w, h);
                }
            };
        });

        // Initialize Scene
        await this.page.evaluate(async (clipList, w, h, injectedData, assetList, vidPaths, levels) => {
            const win = window as any;
            document.body.style.backgroundColor = "black";
            const canvas = document.createElement("canvas");
            canvas.width = w; canvas.height = h;
            document.body.appendChild(canvas);

            win.loadedAssets = {};
            for (const src of assetList) {
                const img = new Image(); 
                img.src = src;
                await new Promise(r => img.onload = r);
                win.loadedAssets[src] = img;
            }

            // --- CHANGE: Load Videos via VideoController ---
            win.loadedVideos = {};
            if (vidPaths && vidPaths.length > 0) {
                const vidPromises = vidPaths.map(async (path) => {
                    try {
                        const vc = new (win.VideoController)(path);
                        await vc.load();
                        win.loadedVideos[path] = vc;
                    } catch (e) {
                        console.warn(`Failed to load video controller for ${path}:`, e);
                        // Fallback to creating a placeholder
                        win.loadedVideos[path] = null;
                    }
                });
                await Promise.all(vidPromises);
            }
            // -----------------------------------------------

            win.activeClips = clipList.map((c) => ({
                ...c, 
                fn: new Function("return " + c.drawFunction)()
            })).sort((a, b) => a.zIndex - b.zIndex);

            win.audioData = levels;

            win.renderFrame = async (frame, fps, totalFrames, rms, bands) => {
                const ctx = canvas.getContext("2d")!;
                const time = frame / fps;

                // --- CHANGE: Seek all videos to exact time ---
                const seekPromises = Object.entries(win.loadedVideos)
                    .filter(([_, vc]) => vc !== null)  // Skip failed videos
                    .map(([path, vc]) => vc.seek(time));
                await Promise.all(seekPromises);
                // ---------------------------------------------

                ctx.clearRect(0, 0, w, h);
                
                // Context setup
                const contextObj = {
                    frame, ctx, canvas, width: w, height: h, fps,
                    progress: frame / (totalFrames - 1 || 1),
                    audioVolume: rms, audioBands: bands,
                    data: injectedData,
                    assets: win.loadedAssets,
                    videos: win.loadedVideos, // These are now VideoControllers
                    utils: win.TiramisuUtils,
                    localFrame: 0, localProgress: 0
                };

                for (const clip of win.activeClips) {
                    if (frame >= clip.startFrame && frame < clip.endFrame) {
                        contextObj.localFrame = frame - clip.startFrame;
                        contextObj.localProgress = contextObj.localFrame / (clip.endFrame - clip.startFrame - 1 || 1);
                        clip.fn(contextObj);
                    }
                }
            };
        }, clips, width, height, data, assets, videoPaths, audioLevels);
    }

    public async renderFrame(
        frame: number,
        fps: number,
        totalFrames: number,
        rms: number,
        bands: number[],
    ): Promise<Uint8Array> {
        await this.page!.evaluate(async (f, r, tf, rms, bands) => {
            await (window as any).renderFrame(f, r, tf, rms, bands);
        }, frame, fps, totalFrames, rms, bands);
        
        return (await this.page!.screenshot({ 
            type: "png", 
            omitBackground: true 
        })) as Uint8Array;
    }

    public async close() {
        await this.browser?.close();
    }
}
