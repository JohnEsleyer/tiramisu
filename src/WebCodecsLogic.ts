/*
   This code is stringified and injected into the Browser/Puppeteer context.
   It handles demuxing via MP4Box and decoding via WebCodecs.
*/
export const WEBCODECS_LOGIC = `
class VideoDecoderController {
    constructor(url, canvasWidth, canvasHeight) {
        this.url = url;
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        this.decoder = null;
        this.samples = [];
        this.info = null;
        this.frameCache = new Map();
        this.isReady = false;
        this.lastDecodedFrame = -1;
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
            mp4boxfile.flush();
        });
    }

    async getFrame(frameIndex, fps) {
        // Simple logic: Find sample by timestamp
        const targetTime = frameIndex / fps;
        const sampleIndex = this.samples.findIndex(s => (s.cts / s.timescale) >= targetTime);
        const sample = this.samples[sampleIndex] || this.samples[this.samples.length - 1];

        if (this.frameCache.has(frameIndex)) return this.frameCache.get(frameIndex);

        return new Promise((resolve) => {
            const decoder = new VideoDecoder({
                output: (videoFrame) => {
                    // Create an ImageBitmap from the VideoFrame for easy drawing
                    createImageBitmap(videoFrame).then(bitmap => {
                        this.frameCache.set(frameIndex, bitmap);
                        videoFrame.close();
                        resolve(bitmap);
                    });
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

            // WebCodecs requires decoding from the nearest Keyframe (I-frame)
            let startIdx = sampleIndex;
            while (startIdx > 0 && !this.samples[startIdx].is_sync) {
                startIdx--;
            }

            for (let i = startIdx; i <= sampleIndex; i++) {
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
        // Extracts the avcC/hvcC box for the decoder configuration
        const entry = this.info.stsd.entries[0];
        const box = entry.avcC || entry.hvcC || entry.vpcC;
        if (!box) return null;
        const stream = new DataStream(undefined, 0, DataStream.BIG_ENDIAN);
        box.write(stream);
        return new Uint8Array(stream.buffer, 8); // Skip size and type
    }
}

window.VideoDecoders = new Map();
window.initVideo = async (url) => {
    const controller = new VideoDecoderController(url);
    await controller.init();
    window.VideoDecoders.set(url, controller);
};
`;