import { GOPManager, WebCodecsConfig, VideoFrameInfo, ITextureManager } from '../types.js';

interface MP4Box {
    createFile: () => MP4File;
    setLogLevel: (level: number) => void;
}

interface MP4File {
    flush: () => void;
    appendBuffer: (buffer: ArrayBuffer) => void;
    seek: (time: number, onSuccess: () => void) => void;
    getSample: (sampleId: number) => any;
    release: () => void;
}

declare global {
    const MP4Box: MP4Box;
}

interface VideoSourceData {
    url: string;
    config: WebCodecsConfig;
    mp4BoxFile: MP4File | null;
    videoDecoder: VideoDecoder | null;
    gopManager: GOPManagerImpl;
    duration: number;
    timescale: number;
    frameRate: number;
    totalFrames: number;
    decodedFrames: Map<number, VideoFrame>;
    currentFrameIndex: number;
    keyframes: number[];
    isInitialized: boolean;
    isDecoding: boolean;
    trackId: number | null;
    readyPromise: Promise<void>;
    resolveReady: (() => void) | null;
}

export class WebCodecsVideoSource {
    private videoSources: Map<string, VideoSourceData> = new Map();
    
    // Event handlers
    private onFrameDecoded: ((sourceId: string, frame: VideoFrame, index: number) => void) | null = null;
    private onSeekComplete: ((sourceId: string) => void) | null = null;
    private onError: ((sourceId: string, error: Error) => void) | null = null;
    
    constructor() {
        if (typeof MP4Box !== 'undefined' && typeof MP4Box.setLogLevel === 'function') {
            MP4Box.setLogLevel(0);
        }
    }
    
    async loadVideo(sourceId: string, videoUrl: string, config: Partial<WebCodecsConfig> = {}): Promise<void> {
        const defaultConfig: WebCodecsConfig = {
            codec: 'avc1.64001F', // H.264 High Profile Level 4.0
            width: 1920,
            height: 1080,
            bitrate: 10000000, // 10 Mbps
            framerate: 30
        };
        
        const finalConfig = { ...defaultConfig, ...config };
        
        const sourceData: VideoSourceData = {
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
        
        sourceData.readyPromise = new Promise<void>((resolve) => {
            sourceData.resolveReady = resolve;
        });
        
        this.videoSources.set(sourceId, sourceData);
        await this.initializeSource(sourceId);
    }
    
    private async initializeSource(sourceId: string): Promise<void> {
        const sourceData = this.videoSources.get(sourceId);
        if (!sourceData) throw new Error(`Source ${sourceId} not found`);
        
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
            (arrayBuffer as any).fileStart = 0;
            sourceData.mp4BoxFile.appendBuffer(arrayBuffer);
            sourceData.mp4BoxFile.flush();
            
            // Wait for MP4Box to parse metadata
            await sourceData.readyPromise;
            
            // Initialize video decoder
            this.initializeDecoder(sourceId);
            
            // Extract keyframe information
            await this.extractKeyframeInfo(sourceId);
            
            sourceData.isInitialized = true;
        } catch (error) {
            this.handleError(sourceId, error as Error);
            throw error;
        }
    }
    
    private setupMP4BoxHandlers(sourceId: string): void {
        const sourceData = this.videoSources.get(sourceId);
        if (!sourceData?.mp4BoxFile) return;
        
        (sourceData.mp4BoxFile as any).onReady = (info: any) => {
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
                    (sourceData.mp4BoxFile as any).setExtractionConfig(videoTrack.id, null, { nb_samples: 1000 });
                    (sourceData.mp4BoxFile as any).start();
                } catch (error) {
                    console.warn(`MP4Box extraction config failed for ${sourceId}:`, error);
                }
            }
            
            sourceData.totalFrames = Math.floor(sourceData.duration * sourceData.frameRate);
            sourceData.resolveReady?.();
        };
        
        (sourceData.mp4BoxFile as any).onSamples = (trackId: number, user: any, samples: any[]) => {
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
    
    private initializeDecoder(sourceId: string): void {
        const sourceData = this.videoSources.get(sourceId);
        if (!sourceData) return;
        
        sourceData.videoDecoder = new VideoDecoder({
            output: (frame: VideoFrame) => {
                this.handleDecodedFrame(sourceId, frame);
            },
            error: (error: Error) => {
                this.handleError(sourceId, error);
            }
        });
        
        sourceData.videoDecoder.configure(sourceData.config);
    }

    private getDecoderDescription(track: any): BufferSource | undefined {
        const entry = track?.stsd?.entries?.[0];
        const box = entry?.avcC || entry?.hvcC || entry?.vpcC;
        const DataStreamCtor = (globalThis as any).DataStream;
        if (!box || !DataStreamCtor) return undefined;
        const stream = new DataStreamCtor(undefined, 0, DataStreamCtor.BIG_ENDIAN);
        box.write(stream);
        const buffer = stream.buffer instanceof ArrayBuffer
            ? stream.buffer
            : new Uint8Array(stream.buffer).slice().buffer;
        const view = new Uint8Array(buffer);
        return view.slice(8).buffer;
    }
    
    private handleDecodedFrame(sourceId: string, frame: VideoFrame): void {
        const sourceData = this.videoSources.get(sourceId);
        if (!sourceData) return;
        
        sourceData.decodedFrames.set(sourceData.currentFrameIndex++, frame);
        
        if (this.onFrameDecoded) {
            this.onFrameDecoded(sourceId, frame, sourceData.currentFrameIndex - 1);
        }
        
        this.cleanupOldFrames(sourceId);
    }
    
    private cleanupOldFrames(sourceId: string, maxFramesToKeep: number = 30): void {
        const sourceData = this.videoSources.get(sourceId);
        if (!sourceData) return;
        
        if (sourceData.decodedFrames.size <= maxFramesToKeep) return;
        
        const framesToRemove: number[] = [];
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
    
    private async extractKeyframeInfo(sourceId: string): Promise<void> {
        const sourceData = this.videoSources.get(sourceId);
        if (!sourceData) return;
        
        const estimatedKeyframeInterval = Math.floor(sourceData.frameRate);
        
        for (let i = 0; i < sourceData.totalFrames; i += estimatedKeyframeInterval) {
            sourceData.keyframes.push(i);
        }
        
        if (sourceData.keyframes.length === 0 || sourceData.keyframes[0] !== 0) {
            sourceData.keyframes.unshift(0);
        }
        
        sourceData.gopManager.setKeyframes(sourceData.keyframes);
    }
    
    async seekToFrame(sourceId: string, frameNumber: number): Promise<void> {
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
    
    private findNearestKeyframe(sourceId: string, frameNumber: number): number {
        const sourceData = this.videoSources.get(sourceId);
        if (!sourceData) return 0;
        
        for (let i = sourceData.keyframes.length - 1; i >= 0; i--) {
            if (sourceData.keyframes[i] <= frameNumber) {
                return sourceData.keyframes[i];
            }
        }
        return 0;
    }
    
    private async seekToTime(sourceId: string, timeInSeconds: number): Promise<void> {
        const sourceData = this.videoSources.get(sourceId);
        if (!sourceData?.mp4BoxFile) return;
        
        return new Promise<void>((resolve) => {
            const originalOnSeek = (sourceData.mp4BoxFile as any).onSeek;
            
            (sourceData.mp4BoxFile as any).onSeek = () => {
                originalOnSeek?.();
                resolve();
            };
            
            sourceData.mp4BoxFile!.seek(timeInSeconds * sourceData.timescale, () => {
                sourceData.mp4BoxFile!.flush();
            });
        });
    }
    
    private async decodeFramesToTarget(sourceId: string, startFrame: number, targetFrame: number): Promise<void> {
        const sourceData = this.videoSources.get(sourceId);
        if (!sourceData) return;
        
        return new Promise<void>((resolve) => {
            const originalOnFrameDecoded = this.onFrameDecoded;
            let framesDecoded = 0;
            const framesToDecode = targetFrame - startFrame + 1;
            
            this.onFrameDecoded = (srcId: string, frame: VideoFrame, index: number) => {
                if (srcId !== sourceId) return;
                
                framesDecoded++;
                
                if (originalOnFrameDecoded) {
                    originalOnFrameDecoded(srcId, frame, index);
                }
                
                if (framesDecoded >= framesToDecode) {
                    this.onFrameDecoded = originalOnFrameDecoded;
                    resolve();
                }
            };
            
            sourceData.mp4BoxFile!.flush();
        });
    }
    
    async getFrameTexture(sourceId: string, frameNumber: number, textureManager: ITextureManager): Promise<WebGLTexture | null> {
        const sourceData = this.videoSources.get(sourceId);
        if (!sourceData) return null;
        
        let frame = sourceData.decodedFrames.get(frameNumber);
        
        if (!frame) {
            // Try to seek to the frame if not already decoded
            try {
                await this.seekToFrame(sourceId, frameNumber);
                frame = sourceData.decodedFrames.get(frameNumber);
            } catch (error) {
                console.error(`Failed to seek to frame ${frameNumber} for source ${sourceId}:`, error);
                return null;
            }
        }
        
        if (!frame) return null;
        
        // Upload the frame as a texture
        return textureManager.uploadVideoFrame(frame);
    }
    
    getCurrentFrame(sourceId: string): VideoFrame | null {
        const sourceData = this.videoSources.get(sourceId);
        if (!sourceData) return null;
        
        return sourceData.decodedFrames.get(sourceData.currentFrameIndex) || null;
    }
    
    getFrame(sourceId: string, frameNumber: number): VideoFrame | null {
        const sourceData = this.videoSources.get(sourceId);
        if (!sourceData) return null;
        
        return sourceData.decodedFrames.get(frameNumber) || null;
    }
    
    getDuration(sourceId: string): number {
        const sourceData = this.videoSources.get(sourceId);
        return sourceData?.duration || 0;
    }
    
    getTotalFrames(sourceId: string): number {
        const sourceData = this.videoSources.get(sourceId);
        return sourceData?.totalFrames || 0;
    }
    
    getFrameRate(sourceId: string): number {
        const sourceData = this.videoSources.get(sourceId);
        return sourceData?.frameRate || 30;
    }
    
    getKeyframes(sourceId: string): number[] {
        const sourceData = this.videoSources.get(sourceId);
        return sourceData ? [...sourceData.keyframes] : [];
    }
    
    isReady(sourceId: string): boolean {
        const sourceData = this.videoSources.get(sourceId);
        return sourceData?.isInitialized && sourceData.videoDecoder?.state === 'configured' || false;
    }
    
    // Event setter methods
    on(event: 'frameDecoded', callback: (sourceId: string, frame: VideoFrame, index: number) => void): void;
    on(event: 'seekComplete', callback: (sourceId: string) => void): void;
    on(event: 'error', callback: (sourceId: string, error: Error) => void): void;
    on(event: string, callback: any): void {
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
    
    off(event: string): void {
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
    
    private handleError(sourceId: string, error: Error): void {
        console.error(`WebCodecsVideoSource error for ${sourceId}:`, error);
        if (this.onError) {
            this.onError(sourceId, error);
        }
    }
    
    private clearDecodedFrames(sourceId: string): void {
        const sourceData = this.videoSources.get(sourceId);
        if (!sourceData) return;
        
        sourceData.decodedFrames.forEach(frame => frame.close());
        sourceData.decodedFrames.clear();
    }
    
    dispose(): void {
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
class GOPManagerImpl implements GOPManager {
    public keyframes: number[] = [];
    private currentFrame: VideoFrame | null = null;
    
    setKeyframes(keyframes: number[]): void {
        this.keyframes = [...keyframes].sort((a, b) => a - b);
    }
    
    async seekToFrame(frameNumber: number): Promise<void> {
        const nearestKeyframe = this.findNearestKeyframe(frameNumber);
        console.log(`Seeking to frame ${frameNumber} via keyframe ${nearestKeyframe}`);
    }
    
    getCurrentFrame(): VideoFrame | null {
        return this.currentFrame;
    }
    
    setCurrentFrame(frame: VideoFrame): void {
        if (this.currentFrame) {
            this.currentFrame.close();
        }
        this.currentFrame = frame;
    }
    
    findNearestKeyframe(frameNumber: number): number {
        for (let i = this.keyframes.length - 1; i >= 0; i--) {
            if (this.keyframes[i] <= frameNumber) {
                return this.keyframes[i];
            }
        }
        return 0;
    }
    
    getKeyframeInterval(frameNumber: number): number {
        const currentKeyframe = this.findNearestKeyframe(frameNumber);
        const nextKeyframeIndex = this.keyframes.findIndex(kf => kf === currentKeyframe) + 1;
        const nextKeyframe = this.keyframes[nextKeyframeIndex];
        
        return nextKeyframe ? nextKeyframe - currentKeyframe : this.keyframes[this.keyframes.length - 1] - currentKeyframe;
    }
    
    dispose(): void {
        if (this.currentFrame) {
            this.currentFrame.close();
            this.currentFrame = null;
        }
        this.keyframes = [];
    }
}
