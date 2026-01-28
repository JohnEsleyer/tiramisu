import puppeteer from 'puppeteer';
import { join } from 'path';
import { readFileSync } from 'fs';

export interface RenderConfig {
    /** Output video width */
    width: number;
    /** Output video height */
    height: number;
    /** Frames per second */
    fps: number;
    /** Duration in seconds */
    durationSeconds: number;
    /** Output filename (e.g., video.mp4) */
    outputFile: string;
    /** Show browser window for debugging? */
    headless?: boolean;
}

export interface RenderContext {
    /** Current frame number (0-indexed) */
    frame: number;
    /** Progress from 0 to 1 */
    progress: number;
    /** The Canvas 2D Context */
    ctx: CanvasRenderingContext2D;
    /** The Canvas Element */
    canvas: HTMLCanvasElement;
    /** Width of the video */
    width: number;
    /** Height of the video */
    height: number;
    /** FPS */
    fps: number;
}

// The function signature the user writes
export type DrawFunction = (context: RenderContext) => void;

export class Tiramisu {
    private config: RenderConfig;
    private drawFunctionString: string;

    constructor(config: RenderConfig) {
        this.config = {
            headless: true,
            ...config
        };
        // Default empty render
        this.drawFunctionString = "() => {}";
    }

    /**
     * Define the drawing logic.
     * 
     * IMPORTANT: This function runs INSIDE the browser.
     * It cannot access variables from your Node/Bun scope unless passed explicitly (future feature).
     */
    public scene(fn: DrawFunction) {
        this.drawFunctionString = fn.toString();
    }

    public async render() {
        const { width, height, fps, durationSeconds, outputFile, headless } = this.config;
        const totalFrames = Math.ceil(fps * durationSeconds);

        console.log(`🍰 Tiramisu: Initializing...`);
        console.log(`   Config: ${width}x${height} @ ${fps}fps (${totalFrames} frames)`);

        // 1. Start Internal Server to serve the template
        const templatePath = join(import.meta.dir, "template.html");
        const htmlContent = readFileSync(templatePath, "utf-8");

        const server = Bun.serve({
            port: 0, // 0 lets the OS pick a random free port
            fetch(req) {
                return new Response(htmlContent, {
                    headers: { "Content-Type": "text/html" },
                });
            },
        });

        // 2. Launch Puppeteer
        const browser = await puppeteer.launch({ 
            // Fix: Use boolean instead of "new"
            headless: headless ?? true,
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                // This flag ensures precise rendering for headless
                '--font-render-hinting=none' 
            ] 
        });
        const page = await browser.newPage();
        
        // Set viewport precisely to video size
        await page.setViewport({ width, height, deviceScaleFactor: 1 });

        // Navigate to our local server
        await page.goto(server.url.toString());

        // 3. Inject the user's drawing function into the browser context
        await page.evaluate((fnString: string, w: number, h: number) => {
            // @ts-ignore - defined in template.html
            window.setupStage(w, h);
            
            // Reconstruct the function from string
            // We wrap it to match the signature expected by the template
            // @ts-ignore
            window.userDrawLogic = new Function('return ' + fnString)();

            // Override the renderFrame hook
            // @ts-ignore
            window.renderFrame = (frame, fps, totalFrames) => {
                 // @ts-ignore
                const canvas = document.getElementById('stage');
                 // @ts-ignore
                const ctx = canvas.getContext('2d');
                
                // Clear screen
                ctx.clearRect(0, 0, w, h);

                // Call user logic
                // @ts-ignore
                window.userDrawLogic({
                    frame,
                    progress: frame / (totalFrames - 1 || 1),
                    ctx,
                    canvas,
                    width: w,
                    height: h,
                    fps
                });
            };
        }, this.drawFunctionString, width, height);

        // 4. Spawn FFMpeg process
        // We pipe raw PNG images into stdin
        const ffmpegArgs = [
            "ffmpeg",
            "-y", // overwrite output
            "-f", "image2pipe", // input format is a pipe of images
            "-vcodec", "png",   // input codec
            "-r", fps.toString(), // input framerate
            "-i", "-",          // input from stdin
            "-c:v", "libx264",  // output video codec (H.264)
            "-pix_fmt", "yuv420p", // standard pixel format for player compatibility
            "-preset", "medium",
            "-crf", "23",       // Quality (lower is better)
            "-movflags", "+faststart",
            outputFile
        ];

        const ffmpegProc = Bun.spawn(ffmpegArgs, {
            stdin: "pipe",
            stdout: "inherit", // Pipe ffmpeg logs to console (or 'ignore' to hide)
            stderr: "inherit",
        });

        console.log("🎥 Rendering Started...");
        const startTime = performance.now();

        // 5. Render Loop
        for (let i = 0; i < totalFrames; i++) {
            // Tell browser to draw frame i
            await page.evaluate((f, r, tf) => {
                // @ts-ignore
                window.renderFrame(f, r, tf);
            }, i, fps, totalFrames);

            // Capture screenshot as buffer
            const screenshotBuffer = await page.screenshot({ 
                type: "png", 
                omitBackground: true 
            });

            // Write to ffmpeg
            if (ffmpegProc.stdin) {
                // Fix: Use Bun's FileSink write and flush
                ffmpegProc.stdin.write(screenshotBuffer);
                ffmpegProc.stdin.flush();
            }

            // Simple progress logging
            if (i % fps === 0) {
                const percent = Math.round((i / totalFrames) * 100);
                const seconds = (performance.now() - startTime) / 1000;
                process.stdout.write(`\r   Frame: ${i}/${totalFrames} (${percent}%) - Time: ${seconds.toFixed(1)}s`);
            }
        }

        console.log("\n✅ Rendering Frames Complete. Finalizing Video...");

        // Close streams
        if (ffmpegProc.stdin) {
            // Fix: Use end() to close Bun FileSink
            ffmpegProc.stdin.end();
        }

        // Wait for FFMpeg to finish encoding
        await ffmpegProc.exited;

        // Cleanup
        await browser.close();
        server.stop();

        const totalTime = ((performance.now() - startTime) / 1000).toFixed(2);
        console.log(`🎉 Done! Video saved to ${outputFile} in ${totalTime}s`);
    }
}