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

export type DrawFunction<T = any> = (context: RenderContext<T>) => void;

export interface Clip<T = any> {
    id: string;
    startFrame: number;
    endFrame: number;
    zIndex: number;
    drawFunction: string | DrawFunction<T>;
}
