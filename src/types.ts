export interface AnimationUtils {
    // Math
    lerp(start: number, end: number, t: number): number;
    clamp(val: number, min: number, max: number): number;
    remap(value: number, low1: number, high1: number, low2: number, high2: number): number;
    toRad(deg: number): number;

    // Easing
    easeInQuad(t: number): number;
    easeOutQuad(t: number): number;
    easeInOutQuad(t: number): number;
    easeInCubic(t: number): number;
    easeOutCubic(t: number): number;
    easeInElastic(t: number): number;
    easeOutElastic(t: number): number;
    easeOutBounce(t: number): number;

    // Helpers
    drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void;
    drawParagraph(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number;
}

export interface RenderConfig<T = any> {
    width: number;
    height: number;
    fps: number;
    durationSeconds: number;
    outputFile: string;
    headless?: boolean;
    audioFile?: string;
    assets?: string[];
    videos?: string[];
    fonts?: { name: string, url: string }[];
    data?: T;
}

export interface RenderContext<T = any> {
    // Global Time
    frame: number;
    progress: number;
    
    // Local Time
    localFrame: number;
    localProgress: number;

    // Audio Data
    /** Current audio volume (0.0 to 1.0) for this frame */
    audioVolume: number;

    // Canvas & Resources
    ctx: CanvasRenderingContext2D;
    canvas: HTMLCanvasElement;
    width: number;
    height: number;
    fps: number;
    data: T;
    assets: Record<string, HTMLImageElement>;
    videos: Record<string, HTMLVideoElement>;
    utils: AnimationUtils;
}

export type DrawFunction<T = any> = (context: RenderContext<T>) => void;

export interface Clip<T = any> {
    id: string;
    startFrame: number;
    endFrame: number;
    zIndex: number;
    drawFunction: string;
}