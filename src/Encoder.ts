import { spawn, $ } from "bun";

export class TiramisuEncoder {
    private process: any;

    constructor(fps: number, outputFile: string, audioFile?: string, durationSeconds?: number) {
        this.init(fps, outputFile, audioFile, durationSeconds);
    }

    private async init(fps: number, outputFile: string, audioFile?: string, durationSeconds?: number) {
        // 1. Detect Hardware Acceleration
        const codec = await this.getBestCodec();
        
        const ffmpegArgs = [
            "ffmpeg", "-y",
            "-loglevel", "error", // Silence verbose headers/info
            "-f", "image2pipe",
            "-vcodec", "png",
            "-r", fps.toString(),
            "-i", "-", 
        ];

        if (audioFile) ffmpegArgs.push("-i", audioFile);

        // 2. Apply Hardware vs CPU settings
        if (codec === "h264_nvenc") {
            ffmpegArgs.push("-c:v", "h264_nvenc", "-preset", "p1", "-tune", "ll");
        } else if (codec === "h264_videotoolbox") {
            ffmpegArgs.push("-c:v", "h264_videotoolbox", "-realtime", "true");
        } else {
            ffmpegArgs.push("-c:v", "libx264", "-preset", "ultrafast", "-crf", "23");
        }

        ffmpegArgs.push("-pix_fmt", "yuv420p");

        if (audioFile) {
            ffmpegArgs.push("-map", "0:v:0", "-map", "1:a:0?", "-c:a", "aac");
        }
        
        if (durationSeconds) ffmpegArgs.push("-t", durationSeconds.toString());

        ffmpegArgs.push(outputFile);

        this.process = spawn(ffmpegArgs, {
            stdin: "pipe",
            stdout: "ignore", 
            stderr: "inherit", // Only show actual errors
        });
    }

    private async getBestCodec(): Promise<string> {
        try {
            const encoders = await $`ffmpeg -encoders`.text();
            if (encoders.includes("h264_nvenc")) return "h264_nvenc";
            if (encoders.includes("h264_videotoolbox")) return "h264_videotoolbox";
        } catch (e) { /* ffmpeg not found or error */ }
        return "libx264";
    }

    public async writeFrame(buffer: Uint8Array) {
        if (this.process?.stdin) {
            this.process.stdin.write(buffer);
        }
    }

    public async close() {
        if (this.process?.stdin) {
            await this.process.stdin.end();
        }
        await this.process?.exited;
    }
}