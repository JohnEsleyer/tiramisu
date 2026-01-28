import { spawn } from "bun";

export class AudioAnalyzer {
    /**
     * Extracts volume levels (RMS) per frame from an audio file.
     * Returns an array of numbers between 0 and 1.
     */
    public async analyze(audioFile: string, fps: number, durationSeconds: number): Promise<number[]> {
        console.log("   🎵 Analyzing Audio...");

        const sampleRate = 44100;
        const totalFrames = Math.ceil(fps * durationSeconds);
        const samplesPerFrame = Math.floor(sampleRate / fps);
        
        // We spawn FFmpeg to output raw 16-bit Little Endian PCM mono audio
        const ffmpegArgs = [
            "ffmpeg",
            "-i", audioFile,
            "-ac", "1",              // Downmix to mono
            "-ar", sampleRate.toString(), // Set sample rate
            "-f", "s16le",           // Output raw PCM 16-bit
            "-acodec", "pcm_s16le",  // Codec
            "-t", durationSeconds.toString(), // Limit duration
            "-"                      // Pipe to stdout
        ];

        const proc = spawn(ffmpegArgs, {
            stdout: "pipe",
            stderr: "ignore" // We don't need logs here
        });

        const stream = proc.stdout;
        const reader = stream.getReader();
        
        let chunks: Uint8Array[] = [];
        let totalLength = 0;

        // Read all data into memory (audio is small enough)
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            totalLength += value.length;
        }

        // Merge chunks
        const fullBuffer = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
            fullBuffer.set(chunk, offset);
            offset += chunk.length;
        }

        // Process samples
        // 16-bit audio = 2 bytes per sample
        const dataView = new DataView(fullBuffer.buffer);
        const totalSamples = Math.floor(totalLength / 2);
        const levels: number[] = [];

        for (let f = 0; f < totalFrames; f++) {
            const startSample = f * samplesPerFrame;
            let sumSquares = 0;
            let count = 0;

            for (let i = 0; i < samplesPerFrame; i++) {
                const sampleIdx = startSample + i;
                if (sampleIdx >= totalSamples) break;

                // Read 16-bit signed integer (-32768 to 32767)
                const sample = dataView.getInt16(sampleIdx * 2, true);
                
                // Normalize to -1 to 1
                const norm = sample / 32768.0;
                sumSquares += norm * norm;
                count++;
            }

            if (count > 0) {
                // RMS (Root Mean Square)
                const rms = Math.sqrt(sumSquares / count);
                levels.push(rms);
            } else {
                levels.push(0);
            }
        }

        // Normalize the entire array so the loudest frame is 1.0 (optional, but good for vis)
        const maxLevel = Math.max(...levels) || 1;
        const normalizedLevels = levels.map(l => l / maxLevel);

        console.log(`   📊 Audio Analyzed: ${normalizedLevels.length} frames.`);
        return normalizedLevels;
    }
}