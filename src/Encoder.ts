export class TiramisuEncoder {
    private process: any;

    constructor(fps: number, outputFile: string, audioFile?: string) {
        const ffmpegArgs = [
            "ffmpeg",
            "-y",
            // Input 0: Video Stream (Pipe)
            "-f", "image2pipe",
            "-vcodec", "png",
            "-r", fps.toString(),
            "-i", "-",
        ];

        // Input 1: Audio Stream (Optional)
        if (audioFile) {
            ffmpegArgs.push("-i", audioFile);
        }

        // Output Codecs & Mapping
        ffmpegArgs.push(
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-preset", "medium",
            "-crf", "23",
            "-movflags", "+faststart"
        );

        if (audioFile) {
            // Map video from stream 0, audio from stream 1
            ffmpegArgs.push("-c:a", "aac", "-map", "0:v", "-map", "1:a", "-shortest");
        }

        ffmpegArgs.push(outputFile);

        this.process = Bun.spawn(ffmpegArgs, {
            stdin: "pipe",
            stdout: "ignore",
            stderr: "inherit", // Keep stderr to see FFMpeg errors if any
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