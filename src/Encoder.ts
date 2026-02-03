import { spawn } from "bun";

export class TiramisuEncoder {
    private process: any;

    constructor(fps: number, outputFile: string, audioFile?: string) {
        const ffmpegArgs = [
            "ffmpeg", "-y",
            "-f", "image2pipe",
            "-vcodec", "png",
            "-r", fps.toString(),
            "-i", "-", // Input 0: The frames from Puppeteer
        ];

        if (audioFile) {
            ffmpegArgs.push("-i", audioFile); // Input 1: Audio source
        }

        ffmpegArgs.push(
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-preset", "ultrafast", // Use ultrafast to prevent timeouts during dev
            "-crf", "23"
        );

        if (audioFile) {
            // Updated mapping: Use audio from input 1, video from input 0.
            // We remove -shortest to prevent early exits if audio metadata is weird.
            ffmpegArgs.push("-map", "0:v:0", "-map", "1:a:0?", "-c:a", "aac");
        }

        ffmpegArgs.push(outputFile);

        this.process = spawn(ffmpegArgs, {
            stdin: "pipe",
            stdout: "inherit", // Changed to inherit so you can see FFmpeg errors in your terminal
            stderr: "inherit",
        });
    }

    public async writeFrame(buffer: Uint8Array) {
        if (this.process.stdin) {
            // Write to the pipe and wait for the drain
            this.process.stdin.write(buffer);
            // In Bun, we don't strictly need flush() here, but it doesn't hurt.
        }
    }

    public async close() {
        if (this.process.stdin) {
            await this.process.stdin.end();
        }
        await this.process.exited;
    }
}
