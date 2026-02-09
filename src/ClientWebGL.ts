import { TiramisuRenderer } from './webgl/TiramisuRenderer.js';
import { TextureManager } from './webgl/TextureManager.js';
import { WebCodecsVideoSource } from './webgl/WebCodecsVideoSource.js';
import { ShaderManager } from './webgl/ShaderManager.js';
import { WebGLRenderContext, RenderConfig, Effect } from './types.js';
import * as TiramisuUtils from './Utils.js';

/**
 * WebGL-powered Tiramisu Player - Phase 1 Implementation
 * Supports WebCodecs video processing and GPU-accelerated effects
 */
export class TiramisuWebGLPlayer<T = any> {
    private config: RenderConfig<T>;
    private canvas: HTMLCanvasElement;
    private renderer: TiramisuRenderer;
    private textureManager: TextureManager;
    private shaderManager: ShaderManager;
    
    // Video sources
    private videoSources: Map<string, WebCodecsVideoSource> = new Map();
    private activeVideoTexture: WebGLTexture | null = null;
    
    // Playback state
    private isPlaying = false;
    private currentFrame = 0;
    private animationFrameId: number | null = null;
    private startTime = 0;
    private pausedAt = 0;
    
    // Effects
    private effects: Effect[] = [];
    
    constructor(config: RenderConfig<T>) {
        this.config = config;
        
        // Setup canvas
        if (typeof config.canvas === "string") {
            this.canvas = document.getElementById(
                config.canvas,
            ) as HTMLCanvasElement;
        } else if (config.canvas instanceof HTMLCanvasElement) {
            this.canvas = config.canvas;
        } else {
            throw new Error(
                "TiramisuWebGLPlayer: No valid canvas element provided.",
            );
        }

        // Initialize WebGL components
        this.renderer = new TiramisuRenderer(this.canvas, config);
        this.textureManager = new TextureManager(this.renderer['gl']);
        this.shaderManager = new ShaderManager(this.renderer);
    }

    async load(): Promise<void> {
        console.log("🍰 Tiramisu WebGL: Loading video sources...");

        try {
            // Load video sources using WebCodecs
            if (this.config.videos) {
                for (let i = 0; i < this.config.videos.length; i++) {
                    const videoUrl = this.config.videos[i];
                    const videoId = `video_${i}`;
                    
                    const videoSource = new WebCodecsVideoSource();
                    
                    await videoSource.loadVideo(videoId, videoUrl, {
                        width: this.config.width,
                        height: this.config.height,
                        framerate: this.config.fps
                    });
                    
                    // Set up frame handling
                    videoSource.on('frameDecoded', (sourceId: string, frame: VideoFrame) => {
                        if (sourceId === videoId) {
                            const texture = this.textureManager.uploadVideoFrame(frame);
                            if (i === 0) { // Use first video as primary
                                this.activeVideoTexture = texture;
                            }
                        }
                    });
                    
                    this.videoSources.set(videoId, videoSource);
                }
            }

            console.log("🍰 Tiramisu WebGL: Ready.");
            
            // Render first frame
            this.renderFrame(0);
        } catch (error) {
            console.error("Failed to load video sources:", error);
            throw error;
        }
    }

    public addEffect(effect: Effect): void {
        this.effects.push(effect);
        // Sort effects by z-index if available, or maintain order
        this.effects.sort((a, b) => (a as any).zIndex - (b as any).zIndex);
    }

    public removeEffect(effectId: string): void {
        this.effects = this.effects.filter(effect => effect.id !== effectId);
    }

    public clearEffects(): void {
        this.effects = [];
    }

    public play(): void {
        if (this.isPlaying) return;
        this.isPlaying = true;

        this.startTime = performance.now() / 1000 - this.pausedAt;
        this.loop();
    }

    public pause(): void {
        if (!this.isPlaying) return;
        this.isPlaying = false;
        
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        this.pausedAt = performance.now() / 1000 - this.startTime;
    }

    public async seek(timeSeconds: number): Promise<void> {
        this.pausedAt = Math.max(0, Math.min(timeSeconds, this.config.durationSeconds));
        
        // Seek all video sources
        const targetFrame = Math.floor(this.pausedAt * this.config.fps);
        
        for (const [videoId, videoSource] of this.videoSources.entries()) {
            await videoSource.seekToFrame(videoId, targetFrame);
        }

        if (this.isPlaying) {
            this.pause();
            this.play();
        } else {
            this.renderFrame(targetFrame);
        }
    }

    private loop(): void {
        if (!this.isPlaying) return;

        const currentTime = performance.now() / 1000 - this.startTime;
        
        if (currentTime >= this.config.durationSeconds) {
            this.pause();
            this.pausedAt = 0;
            return;
        }

        const currentFrame = Math.floor(currentTime * this.config.fps);
        this.renderFrame(currentFrame);

        this.animationFrameId = requestAnimationFrame(() => this.loop());
    }

    private renderFrame(frame: number): void {
        if (!this.activeVideoTexture) return;

        // Render the video texture with effects
        this.renderer.renderToCanvas(this.activeVideoTexture, this.effects);
    }

    // Method to create WebGL render context for custom rendering
    public createWebGLRenderContext(): WebGLRenderContext<T> {
        const gl = this.renderer['gl'];
        const program = this.renderer['currentProgram'] || gl.createProgram()!;
        
        return {
            frame: this.currentFrame,
            progress: this.currentFrame / (this.config.fps * this.config.durationSeconds),
            localFrame: 0,
            localProgress: 0,
            audioVolume: 0,
            audioBands: [],
            ctx: this.canvas.getContext('2d')!,
            canvas: this.canvas,
            width: this.config.width,
            height: this.config.height,
            fps: this.config.fps,
            data: this.config.data || {} as T,
            assets: {},
            videos: {},
            utils: TiramisuUtils.TiramisuUtils,
            layer: {
                create: () => {
                    throw new Error("2D layers not supported in WebGL mode. Use webglLayer.create() instead.");
                }
            },
            gl,
            program,
            applyShader: (shaderId: string, uniforms: Record<string, any>) => {
                if (this.activeVideoTexture) {
                    this.renderer.setUniform(shaderId, 'u_sourceTexture', this.activeVideoTexture);
                }
                Object.entries(uniforms).forEach(([name, value]) => {
                    this.renderer.setUniform(shaderId, name, value);
                });
            },
            sourceTexture: this.activeVideoTexture!,
            webglLayer: {
                create: (width?: number, height?: number) => {
                    return this.renderer.createWebGLLayer(width, height);
                }
            }
        };
    }

    // Getters for debugging and state management
    public getRenderer(): TiramisuRenderer {
        return this.renderer;
    }

    public getTextureManager(): TextureManager {
        return this.textureManager;
    }

    public getShaderManager(): ShaderManager {
        return this.shaderManager;
    }

    public getVideoSources(): Map<string, WebCodecsVideoSource> {
        return this.videoSources;
    }

    public getCurrentFrame(): number {
        return this.currentFrame;
    }

    public getIsPlaying(): boolean {
        return this.isPlaying;
    }

    public getEffects(): Effect[] {
        return [...this.effects];
    }

    public resize(width: number, height: number): void {
        this.config.width = width;
        this.config.height = height;
        this.renderer.resize(width, height);
        this.textureManager.setDefaultTextureSize(width, height);
    }

    public dispose(): void {
        this.pause();
        
        // Dispose video sources
        this.videoSources.forEach(source => source.dispose());
        this.videoSources.clear();
        
        // Dispose WebGL components
        this.textureManager.dispose();
        this.shaderManager.dispose();
        this.renderer.dispose();
        
        this.activeVideoTexture = null;
        this.effects = [];
    }
}