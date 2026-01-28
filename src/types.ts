export interface RenderConfig<T = any> {
    width: number;
    height: number;
    fps: number;
    durationSeconds: number;
    outputFile: string;
    headless?: boolean;
    audioFile?: string;
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
}

export type DrawFunction<T = any> = (context: RenderContext<T>) => void;