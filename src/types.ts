export interface RenderConfig<T = any> {
    /** Output video width in pixels */
    width: number;
    /** Output video height in pixels */
    height: number;
    /** Frames per second */
    fps: number;
    /** Total video length in seconds */
    durationSeconds: number;
    /** Path to the output .mp4 file */
    outputFile: string;
    
    // Optional Fields
    /** Run Puppeteer in headless mode (default: true) */
    headless?: boolean;
    /** Path to an audio file for reactivity and encoding */
    audioFile?: string;
    /** Array of image paths to preload */
    assets?: string[];
    /** Array of video paths to preload and sync */
    videos?: string[];
    /** Custom fonts to load via URL */
    fonts?: { name: string, url: string }[];
    /** Custom state/data accessible in every draw call */
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
    utils: any;
}

export type DrawFunction<T = any> = (context: RenderContext<T>) => void;

export interface Clip<T = any> {
    id: string;
    startFrame: number;
    endFrame: number;
    zIndex: number;
    drawFunction: string;
}