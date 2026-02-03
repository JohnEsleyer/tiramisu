import { spawn } from "bun";
import { join, isAbsolute } from 'path';
import { existsSync } from 'fs';

// --- WASM IMPORT ---
// Note: This import will fail until you run 'bun run build:visualizer' 
// because the generated files don't exist yet.
import { AudioVisualizer } from './wasm/tiramisu_audio_analyzer'; 
// -------------------

export class AudioAnalyzer {
    /**
     * Extracts full 32-band FFT data per frame from an audio file using Wasm.
     * Uses a stateful AudioVisualizer that replicates Web Audio API behavior.
     */
    public async analyze(audioFile: string, fps: number, durationSeconds: number): Promise<{ rms: number, bands: number[] }[]> {
        console.log(`   🎵 Analyzing Audio (Universal Wasm Engine): ${audioFile}`);

        // 1. Resolve Absolute Path
        const absolutePath = isAbsolute(audioFile) ? audioFile : join(process.cwd(), audioFile);
        if (!existsSync(absolutePath)) {
            console.error(`   ❌ Audio Analysis Failed: File not found at ${absolutePath}`);
            return [];
        }

        const sampleRate = 44100;
        const totalFrames = Math.ceil(fps * durationSeconds);
        const samplesPerFrame = Math.floor(sampleRate / fps);
        const BANDS_COUNT = 32; 
        
        // 2. Spawn FFmpeg for Raw PCM
        const ffmpegArgs = [
            "ffmpeg",
            "-i", absolutePath,
            "-ac", "1",              // Downmix to mono
            "-ar", sampleRate.toString(), 
            "-f", "s16le",           // Output raw PCM 16-bit
            "-acodec", "pcm_s16le",  
            "-t", durationSeconds.toString(),
            "-"                      
        ];

        const proc = spawn(ffmpegArgs, { stdout: "pipe", stderr: "inherit" });
        const reader = proc.stdout.getReader();
        
        let chunks: Uint8Array[] = [];
        let totalLength = 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            totalLength += value.length;
        }

        if (totalLength === 0) {
            return Array(totalFrames).fill({ rms: 0, bands: Array(BANDS_COUNT).fill(0) });
        }

        // Merge Buffer
        const fullBuffer = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
            fullBuffer.set(chunk, offset);
            offset += chunk.length;
        }

        // 3. Initialize Universal Wasm Visualizer
        const visualizer = new AudioVisualizer();
        
        const totalSamples = Math.floor(totalLength / 2);
        const analysisData: { rms: number, bands: number[] }[] = [];
        const fullInt16Array = new Int16Array(fullBuffer.buffer);

        for (let f = 0; f < totalFrames; f++) {
            const startSample = f * samplesPerFrame;
            const endSample = Math.min(startSample + samplesPerFrame, totalSamples);
            
            // For 1:1 match: pass the chunk leading up to this frame.
            // The Wasm visualizer will take the *last 64 samples* of this chunk.
            const frameSamples = fullInt16Array.slice(startSample, endSample);
            
            // Call Wasm (State is maintained internally)
            const bandsFloat = visualizer.process_frame(frameSamples);
            
            // --- FIX FOR TYPE ERROR ---
            // Explicitly cast to number[] to satisfy TypeScript
            const bands = Array.from(bandsFloat) as number[];

            // Simple RMS for the "Pulse" effect
            let sumSq = 0;
            for(let i=0; i<frameSamples.length; i++) {
                const val = frameSamples[i] / 32768.0;
                sumSq += val * val;
            }
            const frameRms = Math.sqrt(sumSq / (frameSamples.length || 1));
            // Boost RMS slightly for visual impact
            const rms = Math.min(frameRms * 2.0, 1.0);

            analysisData.push({ rms, bands });
        }

        // Cleanup Wasm memory
        if ((visualizer as any).free) (visualizer as any).free();

        console.log(`   📊 Audio Analyzed: ${analysisData.length} frames (1:1 Client Match).`);
        return analysisData;
    }
}