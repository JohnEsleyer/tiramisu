import { spawn } from "bun";
import { mkdir, readdir } from "node:fs/promises";
import { join, basename } from "node:path";

export class VideoManager {
    private cacheDir = ".tiramisu-cache";

    public async extractFrames(videoPath: string, fps: number): Promise<{ folder: string, count: number }> {
        const file = Bun.file(videoPath);
        const stats = await file.stat();
        
        // ID depends on Filename + Size + FPS
        const videoId = [
            basename(videoPath).replace(/[^a-z0-9]/gi, '_'),
            stats.size,
            `${fps}fps`
        ].join('_');

        const outputDir = join(this.cacheDir, videoId);
        await mkdir(this.cacheDir, { recursive: true });

        const marker = Bun.file(join(outputDir, "done.marker"));
        if (await marker.exists()) {
            const files = await readdir(outputDir);
            return { folder: outputDir, count: files.filter(f => f.endsWith(".jpg")).length };
        }

        console.log(`   🔨 Extracting: ${basename(videoPath)} (${stats.size} bytes)`);
        await mkdir(outputDir, { recursive: true });

        const proc = spawn([
            "ffmpeg", "-y", "-i", videoPath,
            "-vf", `fps=${fps}`,
            "-q:v", "2", 
            join(outputDir, "frame_%05d.jpg")
        ], { stdout: "ignore", stderr: "ignore" });

        await proc.exited;
        await Bun.write(join(outputDir, "done.marker"), "done");

        const files = await readdir(outputDir);
        return { folder: outputDir, count: files.filter(f => f.endsWith(".jpg")).length };
    }
}