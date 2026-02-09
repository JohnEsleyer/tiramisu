import mp4box, { type MP4File, type MP4Info, type MP4Sample } from "mp4box";

/**
 * Manages video decoding using WebCodecs and MP4Box.
 * This ensures frame-perfect seeking and zero-disk usage.
 */
export class VideoController {
    private file: MP4File;
    private decoder: VideoDecoder;
    private samples: MP4Sample[] = [];
    private info: MP4Info | null = null;
    private currentFrame: VideoFrame | ImageBitmap | null = null;
    private trackId: number = 0;
    private description: Uint8Array | null = null;
    private url: string;
    
    public ready: boolean = false;
    public duration: number = 0;
    public width: number = 0;
    public height: number = 0;

    constructor(url: string) {
        this.url = url;
        this.file = mp4box.createFile();
        
        this.decoder = new VideoDecoder({
            output: (frame) => {
                if (this.currentFrame) this.currentFrame.close();
                this.currentFrame = frame;
            },
            error: (e) => console.error("VideoDecoder Error:", e),
        });
    }

    public async load(): Promise<void> {
        return new Promise(async (resolve, reject) => {
            try {
                const response = await fetch(this.url);
                const buffer = await response.arrayBuffer();
                
                // MP4Box requires ArrayBuffer with a slightly different signature in some envs,
                // but standard ArrayBuffer works for the browser build.
                (buffer as any).fileStart = 0;

                this.file.onReady = (info: MP4Info) => {
                    this.info = info;
                    const track = info.videoTracks[0];
                    if (!track) {
                        reject(new Error("No video track found"));
                        return;
                    }

                    this.trackId = track.id;
                    this.duration = info.duration / info.timescale; // Seconds
                    this.width = track.video.width;
                    this.height = track.video.height;

                    this.file.setExtractionOptions(this.trackId, null, { nbSamples: 10000 });
                    this.file.start();
                };

                this.file.onSamples = (id: number, user: any, samples: MP4Sample[]) => {
                    if (id === this.trackId) {
                        this.samples = samples;
                        
                        // Extract codec config (AVCDecoderConfigurationRecord)
                        const track = this.info?.videoTracks[0];
                        this.description = this.getExtradata(this.file);
                        
                        this.decoder.configure({
                            codec: track?.codec || "avc1.42001f",
                            codedWidth: this.width,
                            codedHeight: this.height,
                            description: this.description || undefined,
                        });

                        this.ready = true;
                        resolve();
                    }
                };

                this.file.appendBuffer(buffer as any);
                this.file.flush();
            } catch (e) {
                reject(e);
            }
        });
    }

    /**
     * Seeks to a specific time (seconds) and decodes the frame.
     * Returns a promise that resolves when the frame is ready in `this.currentFrame`.
     */
    public async seek(time: number): Promise<void> {
        if (!this.ready || this.samples.length === 0) return;

        const timescale = this.info!.timescale;
        const timeTicks = time * timescale;

        // 1. Find the sample at the specific time
        let sampleIndex = this.samples.findIndex(s => s.cts >= timeTicks);
        if (sampleIndex === -1) sampleIndex = this.samples.length - 1;
        if (sampleIndex < 0) sampleIndex = 0;

        const targetSample = this.samples[sampleIndex];

        // 2. Find the nearest preceding Keyframe (Sync Sample)
        // WebCodecs requires us to decode from the Keyframe up to the target
        let keyframeIndex = sampleIndex;
        while (keyframeIndex > 0 && !this.samples[keyframeIndex].is_sync) {
            keyframeIndex--;
        }

        // 3. Decode sequence
        // We flush to clear the pipeline for a seek
        await this.decoder.flush();

        for (let i = keyframeIndex; i <= sampleIndex; i++) {
            const s = this.samples[i];
            
            const chunk = new EncodedVideoChunk({
                type: s.is_sync ? "key" : "delta",
                timestamp: (s.cts * 1000000) / timescale, // Convert to microseconds
                duration: (s.duration * 1000000) / timescale, // Convert to microseconds
                data: s.data,
            });

            this.decoder.decode(chunk);
        }

        // Wait for the decoder to output the specific frame we want
        // This is a simplification; for high-perf linear playback, we wouldn't flush every frame.
        // But for "seek" logic, flushing ensures we get exactly what we asked for.
        return await this.decoder.flush(); 
    }

    public draw(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
        if (this.currentFrame) {
            ctx.drawImage(this.currentFrame, x, y, w, h);
        }
    }

    // Helper to extract AVCC atom for description
    private getExtradata(mp4file: any): Uint8Array | null {
        // This logic accesses internal MP4Box structures to find the "avcC" atom
        // Simplification for the example:
        const track = mp4file.getTrackById(this.trackId);
        if (!track) return null;
        
        const stsd = track.mdia?.minf?.stbl?.stsd;
        if (!stsd) return null;
        
        const avc1 = stsd.entries?.find((e: any) => e.type === "avc1");
        if (avc1 && avc1.avcC) {
             return new Uint8Array(avc1.avcC.data);
        }
        return null;
    }
}