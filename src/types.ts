export interface RenderConfig<T = any> {
    width: number;
    height: number;
    fps: number;
    durationSeconds: number;
    outputFile: string;
    headless?: boolean;
    audioFile?: string;
    /** List of image paths (local or remote) to preload */
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
    /** Map of preloaded image assets (key is the path provided in config) */
    assets: Record<string, HTMLImageElement>;
}

export type DrawFunction<T = any> = (context: RenderContext<T>) => void;