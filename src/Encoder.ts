export class TiramisuEncoder {
    private process: any;

    constructor(fps: number, outputFile: string) {
        const ffmpegArgs = [
            "ffmpeg",
            "-y",
            "-f", "image2pipe",
            "-vcodec", "png",
            "-r", fps.toString(),
            "-i", "-",
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-preset", "medium",
            "-crf", "23",
            "-movflags", "+faststart",
            outputFile
        ];

        this.process = Bun.spawn(ffmpegArgs, {
            stdin: "pipe",
            stdout: "ignore", // Silence FFmpeg output for clean CLI
            stderr: "ignore",
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