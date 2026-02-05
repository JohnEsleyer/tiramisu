import { spawn } from "bun";
import { join, isAbsolute } from 'path';
import { existsSync } from 'fs';

// Remove top-level WASM import to prevent crash if build:visualizer wasn't run
// import { AudioVisualizer } from './wasm/tiramisu_audio_analyzer'; 

export class AudioAnalyzer {
    public async analyze(audioFile: string, fps: number, durationSeconds: number): Promise<{ rms: number, bands: number[] }[]> {
        
        // 1. DYNAMIC IMPORT: Load WASM only when analyze is actually called
        let AudioVisualizer;
        try {
            // When installed as a library, the WASM glue code is compiled into ./wasm relative to this file
            // @ts-ignore
            const module = await import('./wasm/tiramisu_audio_analyzer.js');
            AudioVisualizer = module.AudioVisualizer;
        } catch (e) {
            console.warn("⚠️ WASM Audio Module failed to load.");
            console.warn(`Error: ${e}`);
            console.warn("Ensure you have Rust installed and 'bun install' ran successfully.");
            
            // Fallback: Return silent data
            const totalFrames = Math.ceil(fps * durationSeconds);
            return Array(totalFrames).fill({ rms: 0, bands: Array(32).fill(0) });
        }

        console.log(`   🎵 Analyzing Audio (DC Filtered + Web Audio Physics): ${audioFile}`);

        const absolutePath = isAbsolute(audioFile) ? audioFile : join(process.cwd(), audioFile);
        if (!existsSync(absolutePath)) return [];

        const sampleRate = 44100;
        const totalFrames = Math.ceil(fps * durationSeconds);
        const samplesPerFrame = Math.floor(sampleRate / fps);
        const BANDS_COUNT = 32; 
        
        const ffmpegArgs = [
            "ffmpeg", "-i", absolutePath,
            "-ac", "1", "-ar", sampleRate.toString(), 
            "-f", "s16le", "-acodec", "pcm_s16le",  
            "-t", durationSeconds.toString(), "-"
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

        if (totalLength === 0) return Array(totalFrames).fill({ rms: 0, bands: Array(BANDS_COUNT).fill(0) });

        const fullBuffer = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
            fullBuffer.set(chunk, offset);
            offset += chunk.length;
        }

        // Initialize from the dynamically imported module
        const visualizer = new AudioVisualizer();
        const fullInt16Array = new Int16Array(fullBuffer.buffer);
        const analysisData: { rms: number, bands: number[] }[] = [];
        const totalSamples = Math.floor(totalLength / 2);

        for (let f = 0; f < totalFrames; f++) {
            const startSample = f * samplesPerFrame;
            const endSample = Math.min(startSample + samplesPerFrame, totalSamples);
            const frameSamples = fullInt16Array.slice(startSample, endSample);
            
            const bandsFloat = visualizer.process_frame(frameSamples);
            const bands = Array.from(bandsFloat) as number[];

            let sumSq = 0;
            for(let i=0; i<frameSamples.length; i++) {
                const val = frameSamples[i] / 32768.0;
                sumSq += val * val;
            }
            const rms = Math.min(Math.sqrt(sumSq / (frameSamples.length || 1)) * 2.0, 1.0);

            analysisData.push({ rms, bands });
        }

        if ((visualizer as any).free) (visualizer as any).free();

        console.log(`   📊 Audio Analyzed: ${analysisData.length} frames.`);
        return analysisData;
    }
}