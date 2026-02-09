export const WEBCODECS_LOGIC = `
class VideoController {
    constructor(url) {
        this.url = url;
        this.samples = [];
        this.info = null;
        this.decoder = null;
        this.frameCache = new Map();
        this.isReady = false;
    }

    async init() {
        const response = await fetch(this.url);
        const buffer = await response.arrayBuffer();
        return new Promise((resolve) => {
            const mp4boxfile = MP4Box.createFile();
            mp4boxfile.onReady = (info) => {
                this.info = info.videoTracks[0];
                mp4boxfile.setExtractionConfig(this.info.id, null, { nb_samples: 10000 });
                mp4boxfile.start();
            };
            mp4boxfile.onSamples = (id, user, samples) => {
                this.samples = samples;
                this.isReady = true;
                resolve();
            };
            buffer.fileStart = 0;
            mp4boxfile.appendBuffer(buffer);
        });
    }

    async getFrame(time) {
        const sampleIndex = this.samples.findIndex(s => (s.cts / s.timescale) >= time);
        const sample = this.samples[sampleIndex] || this.samples[this.samples.length - 1];
        
        if (this.frameCache.has(sampleIndex)) return this.frameCache.get(sampleIndex);

        return new Promise((resolve) => {
            const decoder = new VideoDecoder({
                output: async (frame) => {
                    const bitmap = await createImageBitmap(frame);
                    this.frameCache.set(sampleIndex, bitmap);
                    frame.close();
                    resolve(bitmap);
                },
                error: (e) => console.error(e)
            });

            const config = {
                codec: this.info.codec,
                codedWidth: this.info.track_width,
                codedHeight: this.info.track_height,
                description: this.getExtradata()
            };
            decoder.configure(config);

            // Decode from nearest keyframe
            let i = sampleIndex;
            while (i > 0 && !this.samples[i].is_sync) i--;
            for (; i <= sampleIndex; i++) {
                const s = this.samples[i];
                decoder.decode(new EncodedVideoChunk({
                    type: s.is_sync ? 'key' : 'delta',
                    timestamp: s.cts,
                    duration: s.duration,
                    data: s.data
                }));
            }
            decoder.flush();
        });
    }

    getExtradata() {
        const entry = this.info.stsd.entries[0];
        const box = entry.avcC || entry.hvcC || entry.vpcC;
        if (!box) return null;
        const stream = new DataStream(undefined, 0, DataStream.BIG_ENDIAN);
        box.write(stream);
        return new Uint8Array(stream.buffer, 8);
    }
}
window.VideoControllers = new Map();
`;