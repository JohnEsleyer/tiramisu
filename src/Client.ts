import { TiramisuUtils } from "./Utils.js";
import { VideoController } from "./VideoController.js";
import type { Clip, DrawFunction, RenderConfig } from "./types.js";

export class TiramisuPlayer<T = any> {
    private config: RenderConfig<T>;
    private clips: Clip[] = [];
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private loadedAssets: Record<string, HTMLImageElement> = {};
    private loadedVideos: Record<string, VideoController> = {}; // Now using VideoController
    private isPlaying = false;
    private animationFrameId: number | null = null;

    // Audio
    private audioContext: AudioContext | null = null;
    private audioBuffer: AudioBuffer | null = null;
    private audioSource: AudioBufferSourceNode | null = null;
    private audioAnalyser: AnalyserNode | null = null;
    private startTime: number = 0;
    private pausedAt: number = 0;

    constructor(config: RenderConfig<T>) {
        this.config = config;

        if (typeof config.canvas === "string") {
            this.canvas = document.getElementById(
                config.canvas,
            ) as HTMLCanvasElement;
        } else if (config.canvas instanceof HTMLCanvasElement) {
            this.canvas = config.canvas;
        } else {
            throw new Error(
                "TiramisuPlayer: No valid canvas element provided.",
            );
        }

        this.canvas.width = config.width;
        this.canvas.height = config.height;
        this.ctx = this.canvas.getContext("2d")!;
    }

    public addClip(
        startSeconds: number,
        durationSeconds: number,
        fn: DrawFunction<T>,
        zIndex: number = 0,
    ) {
        const startFrame = Math.floor(startSeconds * this.config.fps);
        const endFrame =
            startFrame + Math.floor(durationSeconds * this.config.fps);

        this.clips.push({
            id: crypto.randomUUID(),
            startFrame,
            endFrame,
            zIndex,
            drawFunction: fn,
        });

        this.clips.sort((a, b) => a.zIndex - b.zIndex);
    }

    public async load() {
        console.log("🍰 Tiramisu Client: Loading assets...");

        this.loadedAssets = {};
        
        // Load Images
        if (this.config.assets) {
            const promises = this.config.assets.map(
                (src: string) =>
                    new Promise<void>((resolve) => {
                        const img = new Image();
                        img.crossOrigin = "Anonymous";
                        img.src = src;
                        img.onload = () => {
                            this.loadedAssets[src] = img;
                            resolve();
                        };
                        img.onerror = () => {
                            console.warn(`Failed to load ${src}`);
                            resolve();
                        };
                    }),
            );
            await Promise.all(promises);
        }

        // Load Videos using WebCodecs
        if (this.config.videos) {
            const promises = this.config.videos.map(async (src: string) => {
                try {
                    const vc = new VideoController(src);
                    await vc.load();
                    this.loadedVideos[src] = vc;
                    console.log(`✓ Loaded video: ${src}`);
                } catch (e) {
                    console.warn(`Failed to load video ${src}`, e);
                    // Keep the entry as undefined but continue
                    this.loadedVideos[src] = undefined as any;
                }
            });
            await Promise.all(promises);
        }

        // Load Fonts
        if (this.config.fonts) {
            const promises = this.config.fonts.map(
                async (f: { name: string; url: string }) => {
                    const font = new FontFace(f.name, `url(${f.url})`);
                    try {
                        const loaded = await font.load();
                        document.fonts.add(loaded);
                    } catch (e) {
                        console.error(`Failed to load font ${f.name}`, e);
                    }
                },
            );
            await Promise.all(promises);
        }

        // Load Audio
        if (this.config.audioFile) {
            try {
                this.audioContext = new (
                    window.AudioContext || (window as any).webkitAudioContext
                )();
                const response = await fetch(this.config.audioFile);
                const arrayBuffer = await response.arrayBuffer();
                this.audioBuffer =
                    await this.audioContext.decodeAudioData(arrayBuffer);

                this.audioAnalyser = this.audioContext.createAnalyser();
                this.audioAnalyser.fftSize = 64; // Small FFT for visualizer demo (32 bins)
            } catch (e) {
                console.error("Failed to load audio file", e);
            }
        }

        console.log("🍰 Tiramisu Client: Ready.");
        // Render first frame immediately
        this.renderFrame(0);
    }

    public play() {
        if (this.isPlaying) return;
        this.isPlaying = true;

        if (this.audioContext && this.audioBuffer) {
            if (this.audioContext.state === "suspended")
                this.audioContext.resume();
            this.audioSource = this.audioContext.createBufferSource();
            this.audioSource.buffer = this.audioBuffer;
            // Connect source to analyser, then analyser to destination
            this.audioSource.connect(this.audioAnalyser!);
            this.audioAnalyser!.connect(this.audioContext.destination);

            const offset = this.pausedAt;
            this.startTime = this.audioContext.currentTime - offset;
            this.audioSource.start(0, offset);
        } else {
            this.startTime = performance.now() / 1000 - this.pausedAt;
        }

        this.loop();
    }

    public pause() {
        if (!this.isPlaying) return;
        this.isPlaying = false;
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);

        // Note: VideoControllers don't need to be paused like HTMLVideoElements
        // They are stateless and just seek when needed

        if (this.audioSource) {
            this.audioSource.stop();
            this.audioSource.disconnect();
            this.audioSource = null;
        }
        this.pausedAt = this.audioContext
            ? this.audioContext.currentTime - this.startTime
            : performance.now() / 1000 - this.startTime;
    }

    public seek(timeSeconds: number) {
        this.pausedAt = TiramisuUtils.clamp(
            timeSeconds,
            0,
            this.config.durationSeconds,
        );
        if (this.isPlaying) {
            // If playing, we need to restart the audio source to seek
            this.pause();
            this.play();
        } else {
            const frame = Math.floor(this.pausedAt * this.config.fps);
            this.renderFrame(frame);
        }
    }

    private loop() {
        if (!this.isPlaying) return;

        let currentTime = 0;
        if (this.audioContext) {
            currentTime = this.audioContext.currentTime - this.startTime;
        } else {
            currentTime = performance.now() / 1000 - this.startTime;
        }

        if (currentTime >= this.config.durationSeconds) {
            this.pause();
            this.pausedAt = 0;
            // Optionally loop: this.play();
            return;
        }

        const currentFrame = Math.floor(currentTime * this.config.fps);
        this.renderFrame(currentFrame);

        this.animationFrameId = requestAnimationFrame(() => this.loop());
    }

    private getAudioVolume(): number {
        if (!this.audioAnalyser) return 0;
        const dataArray = new Uint8Array(this.audioAnalyser.frequencyBinCount);
        this.audioAnalyser.getByteTimeDomainData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            const x = (dataArray[i] - 128) / 128.0;
            sum += x * x;
        }
        return Math.sqrt(sum / dataArray.length) * 2;
    }

    private getAudioBands(count: number = 32): number[] {
        if (!this.audioAnalyser) return Array(count).fill(0);
        // frequencyBinCount is fftSize / 2, which is 32 in this case.
        const dataArray = new Uint8Array(this.audioAnalyser.frequencyBinCount);
        this.audioAnalyser.getByteFrequencyData(dataArray);

        // Map the bins to a normalized array (0-1)
        const bins = Array.from(dataArray.slice(0, count));
        // Simple normalization (0-255 range from getByteFrequencyData)
        return bins.map((v) => v / 255.0);
    }

    // Public render method for forcing updates
    public renderFrame(frame: number) {
        const totalFrames = Math.ceil(
            this.config.fps * this.config.durationSeconds,
        );
        const progress = frame / (totalFrames - 1 || 1);

        // --- NEW AUDIO DATA RETRIEVAL ---
        const volume = this.getAudioVolume();
        const bands = this.getAudioBands(32); // Use 32 bins for the visualizer
        // ---------------------------------

        // Sync Videos using WebCodecs
        const targetTime = frame / this.config.fps;
        
        // In the client, we want performant seeking.
        // For the Client implementation of VideoController, we can optimize seek 
        // to check if the next frame is simply the next delta in the sequence.
        Object.values(this.loadedVideos).forEach(vc => {
            if (vc && vc.ready) {
                vc.seek(targetTime); 
            }
        });

        this.ctx.clearRect(0, 0, this.config.width, this.config.height);

        for (const clip of this.clips) {
            // Draw clip if frame is within range (inclusive start, exclusive end)
            // Note: We're expanding the range check slightly for safety
            if (frame >= clip.startFrame && frame < clip.endFrame) {
                if (typeof clip.drawFunction === "function") {
                    clip.drawFunction({
                        frame,
                        progress,
                        localFrame: frame - clip.startFrame,
                        localProgress:
                            (frame - clip.startFrame) /
                            (clip.endFrame - clip.startFrame - 1 || 1),
                        audioVolume: volume,
                        audioBands: bands, // <-- NEW
                        ctx: this.ctx,
                        canvas: this.canvas,
                        width: this.config.width,
                        height: this.config.height,
                        fps: this.config.fps,
                        data: this.config.data || {},
                        assets: this.loadedAssets,
                        videos: this.loadedVideos, // These are now VideoControllers
                        utils: TiramisuUtils,
                    });
                }
            }
        }
    }
}
