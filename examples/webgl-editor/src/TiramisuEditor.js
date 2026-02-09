import { TiramisuRenderer } from './webgl/TiramisuRenderer.js';
import { TextureManager } from './webgl/TextureManager.js';
import { ShaderManager } from './webgl/ShaderManager.js';
import { WebCodecsVideoSource } from './webgl/WebCodecsVideoSource.js';
import { ClipEffectStack } from './webgl/EffectStack.js';
export class TiramisuEditor {
    constructor(options) {
        // Virtual Track System
        this.tracks = new Map();
        this.adjustmentLayers = new Map();
        // Transitions
        this.transitions = new Map();
        // State
        this.currentFrame = 0;
        this.isPlaying = false;
        this.animationFrameId = null;
        this.startTime = 0;
        // Setup canvas
        if (typeof options.canvas === 'string') {
            this.canvas = document.getElementById(options.canvas);
        }
        else {
            this.canvas = options.canvas;
        }
        if (!this.canvas) {
            throw new Error('TiramisuEditor: Canvas element not found');
        }
        // Setup config with defaults
        this.config = {
            width: 1920,
            height: 1080,
            fps: 30,
            durationSeconds: 10,
            webgl: true,
            webcodecs: true,
            ...options
        };
        // Initialize WebGL components
        this.renderer = new TiramisuRenderer(this.canvas, this.config);
        this.textureManager = new TextureManager(this.renderer['gl'], 32);
        this.shaderManager = new ShaderManager(this.renderer);
        this.webCodecsSource = new WebCodecsVideoSource();
        // Initialize with one default track
        this.createTrack(1, 'Main Track');
    }
    // Track Management
    createTrack(trackId, name = `Track ${trackId}`) {
        const track = {
            id: trackId.toString(),
            name,
            zIndex: trackId,
            muted: false,
            solo: false,
            clips: [],
            adjustmentLayers: []
        };
        this.tracks.set(trackId, track);
        return track;
    }
    getTrack(trackId) {
        return this.tracks.get(trackId);
    }
    getAllTracks() {
        return Array.from(this.tracks.values()).sort((a, b) => a.zIndex - b.zIndex);
    }
    // Clip Management
    addVideo(source, options) {
        const clip = {
            id: crypto.randomUUID(),
            source,
            startFrame: Math.floor(options.start * this.config.fps),
            endFrame: Math.floor((options.start + options.duration) * this.config.fps),
            track: options.track,
            effects: new ClipEffectStack(crypto.randomUUID()),
            transform: {
                x: 0,
                y: 0,
                scaleX: 1,
                scaleY: 1,
                rotation: 0
            }
        };
        const track = this.tracks.get(options.track);
        if (track) {
            track.clips.push(clip);
            // Sort clips by start frame
            track.clips.sort((a, b) => a.startFrame - b.startFrame);
        }
        else {
            throw new Error(`Track ${options.track} not found`);
        }
        // Load the video source (sourceId first, then URL)
        this.webCodecsSource.loadVideo(clip.id, source).catch((error) => {
            console.error(`Failed to load video source for clip ${clip.id}:`, error);
        });
        return clip;
    }
    getClip(clipId) {
        for (const track of this.tracks.values()) {
            const clip = track.clips.find(c => c.id === clipId);
            if (clip)
                return clip;
        }
        return undefined;
    }
    // Effect Management (simplified API for users)
    addEffectToClip(clipId, effectType, uniforms) {
        const clip = this.getClip(clipId);
        if (!clip)
            throw new Error(`Clip ${clipId} not found`);
        let effect;
        // Use convenience methods from ShaderManager
        switch (effectType) {
            case 'BrightnessContrast':
                effect = this.shaderManager.createBrightnessEffect(uniforms.brightness || 0, uniforms.contrast || 1);
                break;
            case 'Vignette':
                effect = this.shaderManager.createCustomEffect('vignette', uniforms);
                break;
            case 'ChromaKey':
                effect = this.shaderManager.createChromaKeyEffect(uniforms.color ? this.hexToRgb(uniforms.color) : { r: 0, g: 1, b: 0 }, uniforms.similarity || 0.3, uniforms.softness || 0.1, uniforms.spillReduction || 0.5);
                break;
            default:
                effect = this.shaderManager.createCustomEffect(effectType, uniforms);
        }
        clip.effects.addEffect(effect);
    }
    // Transition Management
    addTransition(fromClip, toClip, type, options = { duration: 1.0 }) {
        const transition = {
            id: crypto.randomUUID(),
            fromClipId: fromClip.id,
            toClipId: toClip.id,
            type,
            duration: Math.floor(options.duration * this.config.fps),
            uniforms: { ...options }
        };
        delete transition.uniforms.duration; // Remove duration from uniforms
        this.transitions.set(transition.id, transition);
    }
    // Rendering
    async renderFrame(frame) {
        const gl = this.renderer['gl'];
        // Clear the canvas
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        // Get all visible tracks (respecting solo/mute)
        const visibleTracks = this.getVisibleTracks();
        // Render each track
        for (const track of visibleTracks) {
            await this.renderTrack(track, frame);
        }
        // Apply adjustment layers
        await this.renderAdjustmentLayers(frame);
    }
    getVisibleTracks() {
        const soloedTracks = Array.from(this.tracks.values()).filter(t => t.solo);
        if (soloedTracks.length > 0) {
            return soloedTracks;
        }
        return Array.from(this.tracks.values()).filter(t => !t.muted);
    }
    async renderTrack(track, frame) {
        for (const clip of track.clips) {
            if (frame >= clip.startFrame && frame < clip.endFrame) {
                await this.renderClip(clip, frame);
            }
        }
    }
    async renderClip(clip, frame) {
        // Get video frame texture
        const frameTexture = await this.webCodecsSource.getFrameTexture(clip.id, frame, this.textureManager);
        if (!frameTexture)
            return;
        // Apply clip effects
        const effects = clip.effects.getActiveEffects();
        const processedTexture = effects.length > 0
            ? this.renderer.renderToTexture(frameTexture, effects)
            : frameTexture;
        // Apply transform if present
        if (clip.transform) {
            // TODO: Implement transform in shader or vertex manipulation
        }
        // Render to canvas
        this.renderer.renderToCanvas(processedTexture);
    }
    async renderAdjustmentLayers(frame) {
        // TODO: Implement adjustment layers that affect all tracks below
    }
    // Playback Controls
    play() {
        if (this.isPlaying)
            return;
        this.isPlaying = true;
        this.startTime = performance.now() / 1000 - (this.currentFrame / this.config.fps);
        this.loop();
    }
    pause() {
        this.isPlaying = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }
    seek(timeSeconds) {
        this.currentFrame = Math.floor(timeSeconds * this.config.fps);
        this.renderFrame(this.currentFrame);
    }
    loop() {
        if (!this.isPlaying)
            return;
        const currentTime = performance.now() / 1000 - this.startTime;
        this.currentFrame = Math.floor(currentTime * this.config.fps);
        if (this.currentFrame >= this.config.fps * this.config.durationSeconds) {
            this.pause();
            this.currentFrame = 0;
            return;
        }
        this.renderFrame(this.currentFrame);
        this.animationFrameId = requestAnimationFrame(() => this.loop());
    }
    // Export using WebCodecs
    async export(onProgress) {
        const webCodecsConfig = {
            codec: 'avc1.42001f', // H.264 baseline profile
            width: this.config.width,
            height: this.config.height,
            bitrate: 5000000, // 5 Mbps
            framerate: this.config.fps
        };
        // TODO: Implement WebCodecs export
        throw new Error('WebCodecs export not yet implemented');
    }
    // Utility methods
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16) / 255,
            g: parseInt(result[2], 16) / 255,
            b: parseInt(result[3], 16) / 255
        } : { r: 0, g: 1, b: 0 };
    }
    // Cleanup
    dispose() {
        this.pause();
        this.renderer.dispose();
        this.textureManager.dispose();
        this.shaderManager.dispose();
        this.webCodecsSource.dispose();
        this.tracks.clear();
        this.transitions.clear();
    }
}
