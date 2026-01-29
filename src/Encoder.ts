import { spawn } from "bun";

export class TiramisuEncoder {
    private process: any;

    constructor(fps: number, outputFile: string, audioFile?: string) {
        const ffmpegArgs = [
            "ffmpeg",
            "-y",
            "-f", "image2pipe",
            "-vcodec", "png",
            "-r", fps.toString(),
            "-i", "-",
        ];

        if (audioFile) {
            ffmpegArgs.push("-i", audioFile);
        }

        ffmpegArgs.push(
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-preset", "medium",
            "-crf", "23",
            "-movflags", "+faststart",
            "-loglevel", "error" // Silence FFmpeg output
        );

        if (audioFile) {
            ffmpegArgs.push("-c:a", "aac", "-map", "0:v", "-map", "1:a", "-shortest");
        }

        ffmpegArgs.push(outputFile);

        this.process = spawn(ffmpegArgs, {
            stdin: "pipe",
            stdout: "ignore",
            stderr: "ignore", // Prevent FFmpeg stats from breaking CLI
        });
    }

    public async writeFrame(buffer: Uint8Array) {
        if (this.process.stdin) {
            this.process.stdin.write(buffer);
            await this.process.stdin.flush();
        }
    }

    public async close() {
        if (this.process.stdin) {
            this.process.stdin.end();
        }
        await this.process.exited;
    }
}