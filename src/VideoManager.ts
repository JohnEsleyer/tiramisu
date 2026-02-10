import { spawn } from "node:child_process";
import { mkdir, readdir, writeFile, stat } from "node:fs/promises";
import { join, basename, isAbsolute } from "node:path";
import { existsSync } from "node:fs";

export class VideoManager {
    private cacheDir = ".tiramisu-cache";

    public async extractFrames(videoPath: string, fps: number): Promise<{ folder: string, count: number }> {
        // Resolve absolute path
        const absolutePath = isAbsolute(videoPath) ? videoPath : join(process.cwd(), videoPath);

        if (!existsSync(absolutePath)) {
            console.error(`   ❌ VideoManager Error: Input file does not exist at path: ${absolutePath}`);
            throw new Error("Video file not found for frame extraction.");
        }
        
        const stats = await stat(absolutePath);
        
        const videoId = [
            basename(videoPath).replace(/[^a-z0-9]/gi, '_'),
            stats.size,
            `${fps}fps`
        ].join('_');

        const outputDir = join(this.cacheDir, videoId);
        await mkdir(this.cacheDir, { recursive: true });

        const markerPath = join(outputDir, "done.marker");
        if (existsSync(markerPath)) {
            const files = await readdir(outputDir);
            return { folder: outputDir, count: files.filter(f => f.endsWith(".jpg")).length };
        }

        console.log(`   🔨 Extracting: ${basename(videoPath)} to ${outputDir}`);
        await mkdir(outputDir, { recursive: true });

        const ffmpegArgs = [
            "ffmpeg", "-y", 
            "-i", absolutePath, 
            "-vf", `fps=${fps}`,
            "-qscale:v", "1", 
            join(outputDir, "frame_%05d.jpg")
        ];

        const proc = spawn(ffmpegArgs[0], ffmpegArgs.slice(1), { 
            stdio: ["ignore", "ignore", "inherit"] 
        });
        await new Promise<void>((resolve, reject) => {
            proc.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`FFmpeg exited with code ${code}`));
            });
            proc.on('error', reject);
        });
        
        const tempFiles = await readdir(outputDir);
        const frameCount = tempFiles.filter(f => f.endsWith(".jpg")).length;
        
        if (frameCount === 0) {
             throw new Error("FFmpeg failed to extract video frames.");
        }
        
        await writeFile(join(outputDir, "done.marker"), "done");
        return { folder: outputDir, count: frameCount };
    }
}