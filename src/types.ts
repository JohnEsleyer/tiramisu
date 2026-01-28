export interface RenderConfig {
    width: number;
    height: number;
    fps: number;
    durationSeconds: number;
    outputFile: string;
    headless?: boolean;
}

export interface RenderContext {
    frame: number;
    progress: number;
    ctx: CanvasRenderingContext2D;
    canvas: HTMLCanvasElement;
    width: number;
    height: number;
    fps: number;
}

export type DrawFunction = (context: RenderContext) => void;
