import { spawn } from "node:child_process";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export class TiramisuEncoder {
    private process: any;

    constructor(
        fps: number,
        outputFile: string,
        audioFile?: string,
        durationSeconds?: number,
    ) {
        this.init(fps, outputFile, audioFile, durationSeconds);
    }

    private async init(
        fps: number,
        outputFile: string,
        audioFile?: string,
        durationSeconds?: number,
    ) {
        const codec = await this.getBestCodec();
        console.log(`   🎥 Using Encoder: ${codec}`);

        const ffmpegArgs = [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-f",
            "image2pipe",
            "-vcodec",
            "png",
            "-r",
            fps.toString(),
            "-i",
            "-",
        ];

        if (audioFile) ffmpegArgs.push("-i", audioFile);

        if (codec === "h264_nvenc") {
            ffmpegArgs.push(
                "-c:v",
                "h264_nvenc",
                "-preset",
                "p1",
                "-tune",
                "ll",
            );
        } else if (codec === "h264_videotoolbox") {
            ffmpegArgs.push("-c:v", "h264_videotoolbox", "-realtime", "true");
        } else {
            // Standard CPU Fallback
            ffmpegArgs.push(
                "-c:v",
                "libx264",
                "-preset",
                "ultrafast",
                "-crf",
                "23",
            );
        }

        ffmpegArgs.push("-pix_fmt", "yuv420p");

        if (audioFile) {
            ffmpegArgs.push("-map", "0:v:0", "-map", "1:a:0?", "-c:a", "aac");
        }

        if (durationSeconds) ffmpegArgs.push("-t", durationSeconds.toString());

        ffmpegArgs.push(outputFile);

        this.process = spawn(ffmpegArgs[0], ffmpegArgs.slice(1), {
            stdio: ["pipe", "ignore", "inherit"]
        });
    }

    /**
     * Probes the system to see which encoder is actually functional.
     */
    private async getBestCodec(): Promise<string> {
        try {
            // 1. Check for NVIDIA NVENC
            const { stdout: encodersOutput } = await execAsync("ffmpeg -encoders");
            const hasNvenc = encodersOutput.includes("h264_nvenc");
            if (hasNvenc) {
                // TEST if it actually works (prevents the libcuda.so.1 error)
                try {
                    await execAsync("ffmpeg -f lavfi -i color=c=black:s=64x64:d=0.1 -c:v h264_nvenc -f null -");
                    return "h264_nvenc";
                } catch {
                    // NVENC test failed, continue to next option
                }
            }

            // 2. Check for Apple Silicon / Mac Hardware acceleration
            const hasVt = encodersOutput.includes("h264_videotoolbox");
            if (hasVt) {
                try {
                    await execAsync("ffmpeg -f lavfi -i color=c=black:s=64x64:d=0.1 -c:v h264_videotoolbox -f null -");
                    return "h264_videotoolbox";
                } catch {
                    // VideoToolbox test failed, continue to next option
                }
            }
        } catch (e) {
            // Fallback to CPU if probe fails
        }
        return "libx264";
    }

    public async writeFrame(buffer: Uint8Array) {
        if (this.process?.stdin) {
            this.process.stdin.write(buffer);
        }
    }

    public async close() {
        if (this.process?.stdin) {
            this.process.stdin.end();
        }
        await new Promise<void>((resolve, reject) => {
            if (!this.process) {
                resolve();
                return;
            }
            this.process.on('close', (code: number | null) => {
                if (code === 0) resolve();
                else reject(new Error(`FFmpeg exited with code ${code}`));
            });
            this.process.on('error', reject);
        });
    }
}
