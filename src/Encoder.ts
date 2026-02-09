import { spawn, $ } from "bun";

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

        this.process = spawn(ffmpegArgs, {
            stdin: "pipe",
            stdout: "ignore",
            stderr: "inherit",
        });
    }

    /**
     * Probes the system to see which encoder is actually functional.
     */
    private async getBestCodec(): Promise<string> {
        try {
            // 1. Check for NVIDIA NVENC
            const hasNvenc = (await $`ffmpeg -encoders`.text()).includes(
                "h264_nvenc",
            );
            if (hasNvenc) {
                // TEST if it actually works (prevents the libcuda.so.1 error)
                const testNvenc =
                    await $`ffmpeg -f lavfi -i color=c=black:s=64x64:d=0.1 -c:v h264_nvenc -f null -`.nothrow();
                if (testNvenc.exitCode === 0) return "h264_nvenc";
            }

            // 2. Check for Apple Silicon / Mac Hardware acceleration
            const hasVt = (await $`ffmpeg -encoders`.text()).includes(
                "h264_videotoolbox",
            );
            if (hasVt) {
                const testVt =
                    await $`ffmpeg -f lavfi -i color=c=black:s=64x64:d=0.1 -c:v h264_videotoolbox -f null -`.nothrow();
                if (testVt.exitCode === 0) return "h264_videotoolbox";
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
            await this.process.stdin.end();
        }
        await this.process?.exited;
    }
}
