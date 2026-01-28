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
    data?: T;
}

export interface RenderContext<T = any> {
    frame: number;
    progress: number;
    ctx: CanvasRenderingContext2D;
    canvas: HTMLCanvasElement;
    width: number;
    height: number;
    fps: number;
    data: T;
    assets: Record<string, HTMLImageElement>;
    /** Utility functions for animation (Easing, Math) */
    utils: AnimationUtils;
}

export type DrawFunction<T = any> = (context: RenderContext<T>) => void;