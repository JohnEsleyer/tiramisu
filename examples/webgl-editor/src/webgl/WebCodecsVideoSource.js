export class WebCodecsVideoSource {
    constructor() {
        this.videoSources = new Map();
        // Event handlers
        this.onFrameDecoded = null;
        this.onSeekComplete = null;
        this.onError = null;
        // Set MP4Box log level to reduce console spam
        if (typeof MP4Box !== 'undefined' && typeof MP4Box.setLogLevel === 'function') {
            MP4Box.setLogLevel(0);
        }
    }
    async loadVideo(sourceId, videoUrl, config = {}) {
        const defaultConfig = {
            codec: 'avc1.64001F', // H.264 High Profile Level 4.0
            width: 1920,
            height: 1080,
            bitrate: 10000000, // 10 Mbps
            framerate: 30
        };
        const finalConfig = { ...defaultConfig, ...config };
        const sourceData = {
            url: videoUrl,
            config: finalConfig,
            mp4BoxFile: null,
            videoDecoder: null,
            gopManager: new GOPManagerImpl(),
            duration: 0,
            timescale: 0,
            frameRate: finalConfig.framerate || 30,
            totalFrames: 0,
            decodedFrames: new Map(),
            currentFrameIndex: 0,
            keyframes: [],
            isInitialized: false,
            isDecoding: false,
            trackId: null,
            readyPromise: Promise.resolve(),
            resolveReady: null
        };
        sourceData.readyPromise = new Promise((resolve) => {
            sourceData.resolveReady = resolve;
        });
        this.videoSources.set(sourceId, sourceData);
        await this.initializeSource(sourceId);
    }
    async initializeSource(sourceId) {
        const sourceData = this.videoSources.get(sourceId);
        if (!sourceData)
            throw new Error(`Source ${sourceId} not found`);
        try {
            // Load MP4 file
            const response = await fetch(sourceData.url);
            const arrayBuffer = await response.arrayBuffer();
            // Initialize MP4Box for demuxing
            if (typeof MP4Box === 'undefined') {
                throw new Error('MP4Box library not loaded. Please include mp4box.js');
            }
            sourceData.mp4BoxFile = MP4Box.createFile();
            this.setupMP4BoxHandlers(sourceId);
            // Parse file
            arrayBuffer.fileStart = 0;
            sourceData.mp4BoxFile.appendBuffer(arrayBuffer);
            sourceData.mp4BoxFile.flush();
            await sourceData.readyPromise;
            // Initialize video decoder
            this.initializeDecoder(sourceId);
            // Extract keyframe information
            await this.extractKeyframeInfo(sourceId);
            sourceData.isInitialized = true;
        }
        catch (error) {
            this.handleError(sourceId, error);
            throw error;
        }
    }
    setupMP4BoxHandlers(sourceId) {
        const sourceData = this.videoSources.get(sourceId);
        if (!sourceData?.mp4BoxFile)
            return;
        sourceData.mp4BoxFile.onReady = (info) => {
            console.log(`MP4 file ready for ${sourceId}:`, info);
            const videoTrack = info.videoTracks?.[0];
            sourceData.duration = info.duration / info.timescale;
            sourceData.timescale = info.timescale;
            if (videoTrack) {
                sourceData.trackId = videoTrack.id;
                sourceData.frameRate = videoTrack.frame_rate || sourceData.frameRate;
                sourceData.config.codec = videoTrack.codec || sourceData.config.codec;
                sourceData.config.width = videoTrack.track_width || sourceData.config.width;
                sourceData.config.height = videoTrack.track_height || sourceData.config.height;
                const description = this.getDecoderDescription(videoTrack);
                if (description) {
                    sourceData.config.description = description;
                }
                try {
                    sourceData.mp4BoxFile.setExtractionConfig(videoTrack.id, null, { nb_samples: 1000 });
                    sourceData.mp4BoxFile.start();
                }
                catch (error) {
                    console.warn(`MP4Box extraction config failed for ${sourceId}:`, error);
                }
            }
            sourceData.totalFrames = Math.floor(sourceData.duration * sourceData.frameRate);
            sourceData.resolveReady?.();
        };
        sourceData.mp4BoxFile.onSamples = (trackId, user, samples) => {
            samples.forEach(sample => {
                const chunk = new EncodedVideoChunk({
                    type: sample.is_sync ? 'key' : 'delta',
                    timestamp: sample.cts * 1000000 / sourceData.timescale,
                    data: sample.data
                });
                sourceData.videoDecoder?.decode(chunk);
            });
        };
    }
    initializeDecoder(sourceId) {
        const sourceData = this.videoSources.get(sourceId);
        if (!sourceData)
            return;
        sourceData.videoDecoder = new VideoDecoder({
            output: (frame) => {
                this.handleDecodedFrame(sourceId, frame);
            },
            error: (error) => {
                this.handleError(sourceId, error);
            }
        });
        sourceData.videoDecoder.configure(sourceData.config);
    }
    getDecoderDescription(track) {
        const entry = track?.stsd?.entries?.[0];
        const box = entry?.avcC || entry?.hvcC || entry?.vpcC;
        const DataStreamCtor = globalThis.DataStream;
        if (!box || !DataStreamCtor)
            return undefined;
        const stream = new DataStreamCtor(undefined, 0, DataStreamCtor.BIG_ENDIAN);
        box.write(stream);
        return new Uint8Array(stream.buffer, 8);
    }
    handleDecodedFrame(sourceId, frame) {
        const sourceData = this.videoSources.get(sourceId);
        if (!sourceData)
            return;
        sourceData.decodedFrames.set(sourceData.currentFrameIndex++, frame);
        if (this.onFrameDecoded) {
            this.onFrameDecoded(sourceId, frame, sourceData.currentFrameIndex - 1);
        }
        this.cleanupOldFrames(sourceId);
    }
    cleanupOldFrames(sourceId, maxFramesToKeep = 30) {
        const sourceData = this.videoSources.get(sourceId);
        if (!sourceData)
            return;
        if (sourceData.decodedFrames.size <= maxFramesToKeep)
            return;
        const framesToRemove = [];
        const targetFrame = Math.max(0, sourceData.currentFrameIndex - maxFramesToKeep);
        sourceData.decodedFrames.forEach((frame, index) => {
            if (index < targetFrame) {
                framesToRemove.push(index);
            }
        });
        framesToRemove.forEach(index => {
            const frame = sourceData.decodedFrames.get(index);
            if (frame) {
                frame.close();
                sourceData.decodedFrames.delete(index);
            }
        });
    }
    async extractKeyframeInfo(sourceId) {
        const sourceData = this.videoSources.get(sourceId);
        if (!sourceData)
            return;
        const estimatedKeyframeInterval = Math.floor(sourceData.frameRate);
        for (let i = 0; i < sourceData.totalFrames; i += estimatedKeyframeInterval) {
            sourceData.keyframes.push(i);
        }
        if (sourceData.keyframes.length === 0 || sourceData.keyframes[0] !== 0) {
            sourceData.keyframes.unshift(0);
        }
        sourceData.gopManager.setKeyframes(sourceData.keyframes);
    }
    async seekToFrame(sourceId, frameNumber) {
        const sourceData = this.videoSources.get(sourceId);
        if (!sourceData?.isInitialized) {
            throw new Error(`Video source ${sourceId} not initialized`);
        }
        frameNumber = Math.max(0, Math.min(frameNumber, sourceData.totalFrames - 1));
        const nearestKeyframe = this.findNearestKeyframe(sourceId, frameNumber);
        this.clearDecodedFrames(sourceId);
        await this.seekToTime(sourceId, nearestKeyframe / sourceData.frameRate);
        sourceData.currentFrameIndex = nearestKeyframe;
        await this.decodeFramesToTarget(sourceId, nearestKeyframe, frameNumber);
        if (this.onSeekComplete) {
            this.onSeekComplete(sourceId);
        }
    }
    findNearestKeyframe(sourceId, frameNumber) {
        const sourceData = this.videoSources.get(sourceId);
        if (!sourceData)
            return 0;
        for (let i = sourceData.keyframes.length - 1; i >= 0; i--) {
            if (sourceData.keyframes[i] <= frameNumber) {
                return sourceData.keyframes[i];
            }
        }
        return 0;
    }
    async seekToTime(sourceId, timeInSeconds) {
        const sourceData = this.videoSources.get(sourceId);
        if (!sourceData?.mp4BoxFile)
            return;
        return new Promise((resolve) => {
            const originalOnSeek = sourceData.mp4BoxFile.onSeek;
            sourceData.mp4BoxFile.onSeek = () => {
                originalOnSeek?.();
                resolve();
            };
            sourceData.mp4BoxFile.seek(timeInSeconds * sourceData.timescale, () => {
                sourceData.mp4BoxFile.flush();
            });
        });
    }
    async decodeFramesToTarget(sourceId, startFrame, targetFrame) {
        const sourceData = this.videoSources.get(sourceId);
        if (!sourceData)
            return;
        return new Promise((resolve) => {
            const originalOnFrameDecoded = this.onFrameDecoded;
            let framesDecoded = 0;
            const framesToDecode = targetFrame - startFrame + 1;
            this.onFrameDecoded = (srcId, frame, index) => {
                if (srcId !== sourceId)
                    return;
                framesDecoded++;
                if (originalOnFrameDecoded) {
                    originalOnFrameDecoded(srcId, frame, index);
                }
                if (framesDecoded >= framesToDecode) {
                    this.onFrameDecoded = originalOnFrameDecoded;
                    resolve();
                }
            };
            sourceData.mp4BoxFile.flush();
        });
    }
    async getFrameTexture(sourceId, frameNumber, textureManager) {
        const sourceData = this.videoSources.get(sourceId);
        if (!sourceData)
            return null;
        let frame = sourceData.decodedFrames.get(frameNumber);
        if (!frame) {
            // Try to seek to the frame if not already decoded
            try {
                await this.seekToFrame(sourceId, frameNumber);
                frame = sourceData.decodedFrames.get(frameNumber);
            }
            catch (error) {
                console.error(`Failed to seek to frame ${frameNumber} for source ${sourceId}:`, error);
                return null;
            }
        }
        if (!frame)
            return null;
        // Upload the frame as a texture
        return textureManager.uploadVideoFrame(frame);
    }
    getCurrentFrame(sourceId) {
        const sourceData = this.videoSources.get(sourceId);
        if (!sourceData)
            return null;
        return sourceData.decodedFrames.get(sourceData.currentFrameIndex) || null;
    }
    getFrame(sourceId, frameNumber) {
        const sourceData = this.videoSources.get(sourceId);
        if (!sourceData)
            return null;
        return sourceData.decodedFrames.get(frameNumber) || null;
    }
    getDuration(sourceId) {
        const sourceData = this.videoSources.get(sourceId);
        return sourceData?.duration || 0;
    }
    getTotalFrames(sourceId) {
        const sourceData = this.videoSources.get(sourceId);
        return sourceData?.totalFrames || 0;
    }
    getFrameRate(sourceId) {
        const sourceData = this.videoSources.get(sourceId);
        return sourceData?.frameRate || 30;
    }
    getKeyframes(sourceId) {
        const sourceData = this.videoSources.get(sourceId);
        return sourceData ? [...sourceData.keyframes] : [];
    }
    isReady(sourceId) {
        const sourceData = this.videoSources.get(sourceId);
        return sourceData?.isInitialized && sourceData.videoDecoder?.state === 'configured' || false;
    }
    on(event, callback) {
        switch (event) {
            case 'frameDecoded':
                this.onFrameDecoded = callback;
                break;
            case 'seekComplete':
                this.onSeekComplete = callback;
                break;
            case 'error':
                this.onError = callback;
                break;
        }
    }
    off(event) {
        switch (event) {
            case 'frameDecoded':
                this.onFrameDecoded = null;
                break;
            case 'seekComplete':
                this.onSeekComplete = null;
                break;
            case 'error':
                this.onError = null;
                break;
        }
    }
    handleError(sourceId, error) {
        console.error(`WebCodecsVideoSource error for ${sourceId}:`, error);
        if (this.onError) {
            this.onError(sourceId, error);
        }
    }
    clearDecodedFrames(sourceId) {
        const sourceData = this.videoSources.get(sourceId);
        if (!sourceData)
            return;
        sourceData.decodedFrames.forEach(frame => frame.close());
        sourceData.decodedFrames.clear();
    }
    dispose() {
        this.videoSources.forEach((sourceData, sourceId) => {
            if (sourceData.videoDecoder) {
                sourceData.videoDecoder.close();
            }
            this.clearDecodedFrames(sourceId);
            if (sourceData.mp4BoxFile) {
                sourceData.mp4BoxFile.release();
            }
        });
        this.videoSources.clear();
        this.onFrameDecoded = null;
        this.onSeekComplete = null;
        this.onError = null;
    }
}
// GOP Manager implementation
class GOPManagerImpl {
    constructor() {
        this.keyframes = [];
        this.currentFrame = null;
    }
    setKeyframes(keyframes) {
        this.keyframes = [...keyframes].sort((a, b) => a - b);
    }
    async seekToFrame(frameNumber) {
        const nearestKeyframe = this.findNearestKeyframe(frameNumber);
        console.log(`Seeking to frame ${frameNumber} via keyframe ${nearestKeyframe}`);
    }
    getCurrentFrame() {
        return this.currentFrame;
    }
    setCurrentFrame(frame) {
        if (this.currentFrame) {
            this.currentFrame.close();
        }
        this.currentFrame = frame;
    }
    findNearestKeyframe(frameNumber) {
        for (let i = this.keyframes.length - 1; i >= 0; i--) {
            if (this.keyframes[i] <= frameNumber) {
                return this.keyframes[i];
            }
        }
        return 0;
    }
    getKeyframeInterval(frameNumber) {
        const currentKeyframe = this.findNearestKeyframe(frameNumber);
        const nextKeyframeIndex = this.keyframes.findIndex(kf => kf === currentKeyframe) + 1;
        const nextKeyframe = this.keyframes[nextKeyframeIndex];
        return nextKeyframe ? nextKeyframe - currentKeyframe : this.keyframes[this.keyframes.length - 1] - currentKeyframe;
    }
    dispose() {
        if (this.currentFrame) {
            this.currentFrame.close();
            this.currentFrame = null;
        }
        this.keyframes = [];
    }
}
