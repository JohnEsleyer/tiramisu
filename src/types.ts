export interface Star {
    x: number;
    y: number;
    size: number;
    blinkOffset: number;
}

export interface SceneData {
    stars: Star[];
    gridOffset: number;
}

export interface AnimationUtils {
    lerp(start: number, end: number, t: number): number;
    clamp(val: number, min: number, max: number): number;
    remap(value: number, low1: number, high1: number, low2: number, high2: number): number;
    toRad(deg: number): number;
    easeInQuad(t: number): number;
    easeOutQuad(t: number): number;
    easeInOutQuad(t: number): number;
    easeInCubic(t: number): number;
    easeOutCubic(t: number): number;
    easeInElastic(t: number): number;
    easeOutElastic(t: number): number;
    easeOutBounce(t: number): number;
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
    frame: number;
    progress: number;
    localFrame: number;
    localProgress: number;
    audioVolume: number;
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