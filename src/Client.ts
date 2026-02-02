import { TiramisuUtils } from "./Utils";
import type { Clip, DrawFunction, RenderConfig } from "./types";

export class TiramisuPlayer<T = any> {
    private config: RenderConfig<T>;
    private clips: Clip[] = [];
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private loadedAssets: Record<string, HTMLImageElement> = {};
    private loadedVideos: Record<string, HTMLVideoElement> = {};
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

        if (typeof config.canvas === 'string') {
            this.canvas = document.getElementById(config.canvas) as HTMLCanvasElement;
        } else if (config.canvas instanceof HTMLCanvasElement) {
            this.canvas = config.canvas;
        } else {
            throw new Error("TiramisuPlayer: No valid canvas element provided.");
        }

        this.canvas.width = config.width;
        this.canvas.height = config.height;
        this.ctx = this.canvas.getContext("2d")!;
    }

    public addClip(startSeconds: number, durationSeconds: number, fn: DrawFunction<T>, zIndex: number = 0) {
        const startFrame = Math.floor(startSeconds * this.config.fps);
        const endFrame = startFrame + Math.floor(durationSeconds * this.config.fps);

        this.clips.push({
            id: crypto.randomUUID(),
            startFrame,
            endFrame,
            zIndex,
            drawFunction: fn // Store the raw function for client execution
        });

        // Sort by zIndex immediately
        this.clips.sort((a, b) => a.zIndex - b.zIndex);
    }

    public async load() {
        console.log("🍰 Tiramisu Client: Loading assets...");

        // Clear previous instances if load is called again.
        this.loadedAssets = {};

        // Properly remove old video elements from DOM
        Object.values(this.loadedVideos).forEach(v => v.remove());
        this.loadedVideos = {};

        // Load Images
        if (this.config.assets) {
            const promises = this.config.assets.map(src => new Promise<void>((resolve) => {
                const img = new Image();
                img.crossOrigin = "Anonymous";
                img.src = src;
                img.onload = () => { this.loadedAssets[src] = img; resolve(); };
                img.onerror = () => { console.warn(`Failed to load ${src}`); resolve(); };
            }));
            await Promise.all(promises);
        }

        // Load Videos
        if (this.config.videos) {
               const promises = this.config.videos.map(src => new Promise<void>((resolve) => {
                const vid = document.createElement("video");
                vid.crossOrigin = "Anonymous";
                vid.src = src;
                vid.muted = true;
                vid.playsInline = true;
                vid.style.display = "none";
                vid.preload = "auto";
                document.body.appendChild(vid);
                
                // Use 'canplaythrough' to ensure we have enough data
                vid.oncanplaythrough = () => { 
                    this.loadedVideos[src] = vid; 
                    resolve(); 
                };
                vid.onerror = () => { 
                    console.warn(`Failed to load ${src}`); 
                    resolve(); 
                };
            }));
            await Promise.all(promises);
        }

        // Load Fonts
        if (this.config.fonts) {
            const promises = this.config.fonts.map(async f => {
                const font = new FontFace(f.name, `url(${f.url})`);
                try {
                    const loaded = await font.load();
                    document.fonts.add(loaded);
                } catch (e) {
                    console.error(`Failed to load font ${f.name}`, e);
                }
            });
            await Promise.all(promises);
        }

        // Load Audio
        if (this.config.audioFile) {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const response = await fetch(this.config.audioFile);
            const arrayBuffer = await response.arrayBuffer();
            this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            this.audioAnalyser = this.audioContext.createAnalyser();
            this.audioAnalyser.fftSize = 256;
        }

        console.log("🍰 Tiramisu Client: Ready.");
        // Render first frame
        this.renderFrame(0);
    }

    public play() {
        if (this.isPlaying) return;
        this.isPlaying = true;

        if (this.audioContext && this.audioBuffer) {
            if (this.audioContext.state === 'suspended') this.audioContext.resume();
            this.audioSource = this.audioContext.createBufferSource();
            this.audioSource.buffer = this.audioBuffer;
            this.audioSource.connect(this.audioAnalyser!);
            this.audioAnalyser!.connect(this.audioContext.destination);
            
            // Handle seeking offset
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
        
        // Pause all videos
        Object.values(this.loadedVideos).forEach(v => v.pause());

        if (this.audioSource) {
            this.audioSource.stop();
            this.audioSource.disconnect();
            this.audioSource = null;
        }
        this.pausedAt = this.audioContext ? (this.audioContext.currentTime - this.startTime) : ((performance.now() / 1000) - this.startTime);
    }

    public seek(timeSeconds: number) {
        this.pausedAt = TiramisuUtils.clamp(timeSeconds, 0, this.config.durationSeconds);
        if (this.isPlaying) {
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
            currentTime = (performance.now() / 1000) - this.startTime;
        }

        if (currentTime >= this.config.durationSeconds) {
            this.pause();
            this.pausedAt = 0; // Loop or Stop? Let's stop.
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
        return Math.sqrt(sum / dataArray.length) * 2; // Approximate RMS normalized
    }

    private renderFrame(frame: number) {
        const totalFrames = Math.ceil(this.config.fps * this.config.durationSeconds);
        const progress = frame / (totalFrames - 1 || 1);
        const volume = this.getAudioVolume();

        // 1. Sync Videos
        const targetTime = frame / this.config.fps;
        Object.values(this.loadedVideos).forEach(vid => {
            if (this.isPlaying) {
                if (vid.paused) vid.play().catch(() => {});
                const drift = Math.abs(vid.currentTime - targetTime);
                if (drift > 0.2) vid.currentTime = targetTime;
            } else {
                if (!vid.paused) vid.pause();
                // Avoid "Seek Storms": only seek if not already seeking
                if (!vid.seeking && Math.abs(vid.currentTime - targetTime) > 0.01) {
                    vid.currentTime = targetTime;
                }
            }
        });

        // 2. Clear Canvas
        // We clear the canvas, but our clips will now handle their own persistence.
        this.ctx.clearRect(0, 0, this.config.width, this.config.height);

        // 3. Draw Clips
        for (const clip of this.clips) {
            if (frame >= clip.startFrame && frame < clip.endFrame) {
                if (typeof clip.drawFunction === 'function') {
                    clip.drawFunction({
                        frame,
                        progress,
                        localFrame: frame - clip.startFrame,
                        localProgress: (frame - clip.startFrame) / (clip.endFrame - clip.startFrame - 1 || 1),
                        audioVolume: volume,
                        ctx: this.ctx,
                        canvas: this.canvas,
                        width: this.config.width,
                        height: this.config.height,
                        fps: this.config.fps,
                        data: this.config.data || {},
                        assets: this.loadedAssets,
                        videos: this.loadedVideos,
                        utils: TiramisuUtils
                    });
                }
            }
        }
    }
}