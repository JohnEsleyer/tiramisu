import { TiramisuEditor } from '../../src/TiramisuEditor.js';
class WebGLEditorApp {
    constructor() {
        this.video1 = null;
        this.video2 = null;
        this.currentClip1 = null;
        this.currentClip2 = null;
        this.isPlaying = false;
        this.editor = new TiramisuEditor({
            canvas: 'gl-canvas',
            width: 1920,
            height: 1080,
            fps: 30,
            durationSeconds: 10,
            webgl: true,
            webcodecs: true
        });
        this.initializeUI();
        this.setupEventListeners();
    }
    initializeUI() {
        // Set up initial UI state
        this.updatePlaybackControls();
        this.updateSliderValues();
    }
    setupEventListeners() {
        // Video input handlers
        document.getElementById('video1-input')?.addEventListener('change', (e) => {
            this.handleVideoUpload(e, 1);
        });
        document.getElementById('video2-input')?.addEventListener('change', (e) => {
            this.handleVideoUpload(e, 2);
        });
        // Playback controls
        document.getElementById('play-btn')?.addEventListener('click', () => {
            this.play();
        });
        document.getElementById('pause-btn')?.addEventListener('click', () => {
            this.pause();
        });
        document.getElementById('seek-bar')?.addEventListener('input', (e) => {
            this.seek(e.target.value);
        });
        // Adjustment sliders
        ['brightness', 'contrast', 'saturation'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', (e) => {
                this.handleAdjustmentChange(id, e.target.value);
            });
        });
        // Effects buttons
        document.getElementById('add-grayscale')?.addEventListener('click', () => {
            this.addGrayscaleEffect();
        });
        document.getElementById('add-blur')?.addEventListener('click', () => {
            this.addBlurEffect();
        });
        document.getElementById('clear-effects')?.addEventListener('click', () => {
            this.clearAllEffects();
        });
        // Transition select
        document.getElementById('transition-select')?.addEventListener('change', (e) => {
            this.handleTransitionChange(e.target.value);
        });
    }
    async handleVideoUpload(event, videoNumber) {
        const input = event.target;
        const file = input.files?.[0];
        if (!file)
            return;
        const objectUrl = URL.createObjectURL(file);
        const videoUrl = URL.createObjectURL(file);
        const videoFile = {
            file,
            url: videoUrl,
            objectUrl
        };
        if (videoNumber === 1) {
            if (this.video1) {
                URL.revokeObjectURL(this.video1.objectUrl);
            }
            this.video1 = videoFile;
            this.updateVideoStatus('video1-status', `${file.name} (${this.formatFileSize(file.size)})`);
            await this.addVideoToTimeline(this.video1, 0, 5);
        }
        else {
            if (this.video2) {
                URL.revokeObjectURL(this.video2.objectUrl);
            }
            this.video2 = videoFile;
            this.updateVideoStatus('video2-status', `${file.name} (${this.formatFileSize(file.size)})`);
            await this.addVideoToTimeline(this.video2, 4, 6);
        }
    }
    async addVideoToTimeline(videoFile, start, duration) {
        try {
            const clip = this.editor.addVideo(videoFile.url, {
                start,
                duration,
                track: 1
            });
            if (videoFile === this.video1) {
                this.currentClip1 = clip;
            }
            else {
                this.currentClip2 = clip;
            }
            // Apply initial adjustments
            this.applyCurrentAdjustments(clip);
        }
        catch (error) {
            console.error('Failed to add video to timeline:', error);
        }
    }
    handleAdjustmentChange(type, value) {
        const numValue = parseFloat(value);
        const valueElement = document.getElementById(`${type}-value`);
        if (valueElement) {
            valueElement.textContent = numValue.toFixed(2);
        }
        // Apply to both clips
        if (this.currentClip1) {
            this.applyAdjustment(this.currentClip1, type, numValue);
        }
        if (this.currentClip2) {
            this.applyAdjustment(this.currentClip2, type, numValue);
        }
    }
    applyAdjustment(clip, type, value) {
        // Get the clip to access its effects
        const clipData = this.editor.getClip(clip.id);
        if (!clipData)
            return;
        // Clear existing effects by reinitializing the effect stack
        clipData.effects.clearEffects();
        // Add new effect if value is not default
        if (type === 'brightness' && value !== 0) {
            this.editor.addEffectToClip(clip.id, 'BrightnessContrast', { brightness: value, contrast: 1 });
        }
        else if (type === 'contrast' && value !== 1) {
            this.editor.addEffectToClip(clip.id, 'BrightnessContrast', { brightness: 0, contrast: value });
        }
        else if (type === 'saturation' && value !== 1) {
            this.editor.addEffectToClip(clip.id, 'Saturation', { saturation: value });
        }
    }
    applyCurrentAdjustments(clip) {
        const brightness = parseFloat(document.getElementById('brightness').value);
        const contrast = parseFloat(document.getElementById('contrast').value);
        const saturation = parseFloat(document.getElementById('saturation').value);
        // Apply all adjustments at once
        const clipData = this.editor.getClip(clip.id);
        if (!clipData)
            return;
        clipData.effects.clearEffects();
        if (brightness !== 0) {
            this.editor.addEffectToClip(clip.id, 'BrightnessContrast', { brightness, contrast: 1 });
        }
        if (contrast !== 1) {
            this.editor.addEffectToClip(clip.id, 'BrightnessContrast', { brightness: 0, contrast });
        }
        if (saturation !== 1) {
            this.editor.addEffectToClip(clip.id, 'Saturation', { saturation });
        }
    }
    addGrayscaleEffect() {
        if (this.currentClip1) {
            this.editor.addEffectToClip(this.currentClip1.id, 'Grayscale', { intensity: 1.0 });
        }
        if (this.currentClip2) {
            this.editor.addEffectToClip(this.currentClip2.id, 'Grayscale', { intensity: 1.0 });
        }
    }
    addBlurEffect() {
        if (this.currentClip1) {
            this.editor.addEffectToClip(this.currentClip1.id, 'Blur', { radius: 5.0 });
        }
        if (this.currentClip2) {
            this.editor.addEffectToClip(this.currentClip2.id, 'Blur', { radius: 5.0 });
        }
    }
    clearAllEffects() {
        if (this.currentClip1) {
            const clipData = this.editor.getClip(this.currentClip1.id);
            if (clipData) {
                clipData.effects.clearEffects();
                this.applyCurrentAdjustments(this.currentClip1);
            }
        }
        if (this.currentClip2) {
            const clipData = this.editor.getClip(this.currentClip2.id);
            if (clipData) {
                clipData.effects.clearEffects();
                this.applyCurrentAdjustments(this.currentClip2);
            }
        }
    }
    handleTransitionChange(transitionType) {
        if (this.currentClip1 && this.currentClip2 && transitionType !== 'none') {
            this.editor.addTransition(this.currentClip1, this.currentClip2, transitionType, {
                duration: 1.0,
                strength: 0.5
            });
        }
    }
    play() {
        this.editor.play();
        this.isPlaying = true;
        this.updatePlaybackControls();
        this.startPlaybackLoop();
    }
    pause() {
        this.editor.pause();
        this.isPlaying = false;
        this.updatePlaybackControls();
    }
    seek(percentage) {
        const duration = 10; // durationSeconds from config
        const time = (parseFloat(percentage) / 100) * duration;
        this.editor.seek(time);
    }
    startPlaybackLoop() {
        const updateLoop = () => {
            if (this.isPlaying) {
                this.updatePlaybackUI();
                requestAnimationFrame(updateLoop);
            }
        };
        updateLoop();
    }
    updatePlaybackUI() {
        // Note: TiramisuEditor doesn't expose getCurrentTime/getDuration
        // For now, we'll use a simplified approach based on the config
        const duration = 10; // durationSeconds from config
        const currentTime = this.isPlaying ? 0 : 0; // Simplified - would need actual time tracking
        const percentage = 0; // Simplified - would need actual percentage calculation
        const seekBar = document.getElementById('seek-bar');
        const timeDisplay = document.getElementById('time-display');
        if (seekBar) {
            seekBar.value = percentage.toString();
        }
        if (timeDisplay) {
            timeDisplay.textContent = `${this.formatTime(currentTime)} / ${this.formatTime(duration)}`;
        }
    }
    updatePlaybackControls() {
        const playBtn = document.getElementById('play-btn');
        const pauseBtn = document.getElementById('pause-btn');
        if (playBtn && pauseBtn) {
            playBtn.disabled = this.isPlaying;
            pauseBtn.disabled = !this.isPlaying;
        }
    }
    updateSliderValues() {
        ['brightness', 'contrast', 'saturation'].forEach(id => {
            const slider = document.getElementById(id);
            const valueElement = document.getElementById(`${id}-value`);
            if (slider && valueElement) {
                valueElement.textContent = parseFloat(slider.value).toFixed(2);
            }
        });
    }
    updateVideoStatus(elementId, status) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = status;
        }
    }
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    formatFileSize(bytes) {
        if (bytes === 0)
            return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    dispose() {
        this.editor.dispose();
        if (this.video1) {
            URL.revokeObjectURL(this.video1.objectUrl);
        }
        if (this.video2) {
            URL.revokeObjectURL(this.video2.objectUrl);
        }
    }
}
// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new WebGLEditorApp();
    // Make app available globally for debugging
    window.webglEditorApp = app;
});
export { WebGLEditorApp };
