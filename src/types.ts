export interface RenderConfig<T = any> {
    /** Output video width in pixels */
    width: number;
    /** Output video height in pixels */
    height: number;
    /** Frames per second */
    fps: number;
    /** Total video length in seconds */
    durationSeconds: number;
    /** Path to the output .mp4 file (Server only) */
    outputFile?: string;

    // Optional Fields
    headless?: boolean;
    audioFile?: string;
    assets?: string[];
    videos?: string[];
    fonts?: { name: string; url: string }[];
    data?: T;
    canvas?: HTMLCanvasElement | string;
    /** Number of parallel workers. Defaults to CPU core count. */
    parallel?: number;
    
    // WebGL-specific options
    /** Enable WebGL rendering (default: true) */
    webgl?: boolean;
    /** WebGL context attributes */
    webglContextAttributes?: WebGLContextAttributes;
    /** Enable WebCodecs for video processing (default: true) */
    webcodecs?: boolean;
}

export interface WorkerPayload {
    workerId: number;
    startFrame: number;
    endFrame: number;
    config: RenderConfig;
    clips: Clip[];
}

export type ProgressPayload = {
    frame: number;
    total: number;
    percent: number;
    eta: number; // Estimated seconds remaining
};

export interface Layer {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    width: number;
    height: number;
    clear: () => void;
    drawTo: (targetCtx: CanvasRenderingContext2D, x?: number, y?: number, dw?: number, dh?: number) => void;
    applyBlur: (radius: number) => void;
    applyBrightness: (amount: number) => void;
    applyContrast: (amount: number) => void;
    applyTint: (color: string) => void;
    applyGrayscale: () => void;
}

// WebGL-specific Layer (texture-based)
export interface WebGLLayer {
    texture: WebGLTexture;
    width: number;
    height: number;
    clear: () => void;
    applyShader: (shaderId: string, uniforms: Record<string, any>) => void;
}

export interface RenderContext<T = any> {
    frame: number;
    progress: number;
    localFrame: number;
    localProgress: number;
    audioVolume: number;
    audioBands: number[];
    ctx: CanvasRenderingContext2D;
    canvas: HTMLCanvasElement;
    width: number;
    height: number;
    fps: number;
    data: T;
    assets: Record<string, HTMLImageElement>;
    videos: Record<string, HTMLVideoElement>;
    utils: typeof import("./Utils.js").TiramisuUtils;
    layer: {
        create: (width?: number, height?: number) => Layer;
    };
}

export interface WebGLRenderContext<T = any> extends RenderContext<T> {
    gl: WebGL2RenderingContext;
    program: WebGLProgram;
    // Helper to apply a shader to a texture
    applyShader: (shaderId: string, uniforms: Record<string, any>) => void;
    // Current frame as a texture
    sourceTexture: WebGLTexture;
    // WebGL layer creation
    webglLayer: {
        create: (width?: number, height?: number) => WebGLLayer;
    };
}

export type DrawFunction<T = any> = (context: RenderContext<T>) => void;
export type WebGLDrawFunction<T = any> = (context: WebGLRenderContext<T>) => void;

export interface Clip<T = any> {
    id: string;
    startFrame: number;
    endFrame: number;
    zIndex: number;
    drawFunction: string | DrawFunction<T>;
}

// WebGL-specific interfaces
export interface ShaderProgram {
    id: string;
    program: WebGLProgram;
    uniforms: Map<string, WebGLUniformLocation>;
    attributes: Map<string, number>;
}

export interface VideoFrameInfo {
    frame: VideoFrame;
    timestamp: number;
    texture?: WebGLTexture;
}

export interface TexturePool {
    getTexture: () => WebGLTexture | null;
    releaseTexture: (texture: WebGLTexture) => void;
    clear: () => void;
}

export interface ITextureManager {
    uploadVideoFrame(frame: VideoFrame): WebGLTexture;
}

export interface GOPManager {
    keyframes: number[];
    seekToFrame: (frameNumber: number) => Promise<void>;
    getCurrentFrame: () => VideoFrame | null;
}

// WebCodecs configuration
export interface WebCodecsConfig {
    codec: string;
    width: number;
    height: number;
    bitrate?: number;
    framerate?: number;
    description?: BufferSource;
}

// Shader uniform types
export type ShaderUniform = number | number[] | boolean | WebGLTexture;

// Effect configuration
export interface Effect {
    id: string;
    shaderId: string;
    uniforms: Record<string, ShaderUniform>;
    enabled: boolean;
}
