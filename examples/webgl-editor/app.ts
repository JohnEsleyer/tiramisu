import { TiramisuEditor } from '../../src/TiramisuEditor.js';

interface VideoFile {
    file: File;
    url: string;
    objectUrl: string;
}

class WebGLEditorApp {
    private editor: TiramisuEditor;
    private video1: VideoFile | null = null;
    private video2: VideoFile | null = null;
    private currentClip1: any = null;
    private currentClip2: any = null;
    private isPlaying = false;

    constructor() {
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
        this.loadSampleVideos();
    }

    private async loadSampleVideos() {
        // Create sample video URLs using common test videos
        const sampleVideos = [
            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4'
        ];

        try {
            // Try to load first sample video automatically
            const response = await fetch(sampleVideos[0], { method: 'HEAD' });
            if (response.ok) {
                // Update video status to show sample video is available
                this.updateVideoStatus('video1-status', 'Sample video ready (click to use custom video)');
                
                // Create a function to load sample when user clicks
                const loadSampleBtn = document.createElement('button');
                loadSampleBtn.textContent = 'Load Sample Video';
                loadSampleBtn.style.marginTop = '5px';
                loadSampleBtn.onclick = () => this.loadSampleVideo(sampleVideos[0], 1);
                
                const video1Status = document.getElementById('video1-status');
                if (video1Status) {
                    video1Status.appendChild(loadSampleBtn);
                }
            }
        } catch (error) {
            console.log('Sample videos not available, please upload your own videos');
        }
    }

    private async loadSampleVideo(url: string, videoNumber: number) {
        try {
            const videoFile: VideoFile = {
                file: new File([], 'sample.mp4'),
                url,
                objectUrl: url
            };

            if (videoNumber === 1) {
                this.video1 = videoFile;
                this.updateVideoStatus('video1-status', 'Sample video loaded');
                await this.addVideoToTimeline(this.video1, 0, 5);
            } else {
                this.video2 = videoFile;
                this.updateVideoStatus('video2-status', 'Sample video loaded');
                await this.addVideoToTimeline(this.video2, 4, 6);
            }
        } catch (error) {
            console.error('Failed to load sample video:', error);
            this.updateVideoStatus(`video${videoNumber}-status`, 'Failed to load sample video');
        }
    }

    private initializeUI() {
        // Set up initial UI state
        this.updatePlaybackControls();
        this.updateSliderValues();
    }

    private setupEventListeners() {
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
            this.seek((e.target as HTMLInputElement).value);
        });

        // Adjustment sliders
        ['brightness', 'contrast', 'saturation'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', (e) => {
                this.handleAdjustmentChange(id, (e.target as HTMLInputElement).value);
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
            this.handleTransitionChange((e.target as HTMLSelectElement).value);
        });
    }

    private async handleVideoUpload(event: Event, videoNumber: number) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        
        if (!file) return;

        const objectUrl = URL.createObjectURL(file);
        const videoUrl = URL.createObjectURL(file);

        const videoFile: VideoFile = {
            file,
            url: videoUrl,
            objectUrl
        };

        try {
            if (videoNumber === 1) {
                if (this.video1) {
                    URL.revokeObjectURL(this.video1.objectUrl);
                }
                this.video1 = videoFile;
                this.updateVideoStatus('video1-status', `${file.name} (${this.formatFileSize(file.size)})`);
                await this.addVideoToTimeline(this.video1, 0, 5);
            } else {
                if (this.video2) {
                    URL.revokeObjectURL(this.video2.objectUrl);
                }
                this.video2 = videoFile;
                this.updateVideoStatus('video2-status', `${file.name} (${this.formatFileSize(file.size)})`);
                await this.addVideoToTimeline(this.video2, 4, 6);
            }
        } catch (error) {
            console.error('Failed to load video:', error);
            this.updateVideoStatus(`video${videoNumber}-status`, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async addVideoToTimeline(videoFile: VideoFile, start: number, duration: number) {
        try {
            const clip = this.editor.addVideo(videoFile.url, {
                start,
                duration,
                track: 1
            });

            if (videoFile === this.video1) {
                this.currentClip1 = clip;
            } else {
                this.currentClip2 = clip;
            }

            // Apply initial adjustments
            this.applyCurrentAdjustments(clip);
        } catch (error) {
            console.error('Failed to add video to timeline:', error);
            this.updateVideoStatus('video1-status', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private handleAdjustmentChange(type: string, value: string) {
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

    private applyAdjustment(clip: any, type: string, value: number) {
        // Get clip to access its effects
        const clipData = this.editor.getClip(clip.id);
        if (!clipData) return;
        
        // Clear existing effects by reinitializing effect stack
        clipData.effects.clearEffects();
        
        // Add new effect if value is not default
        if (type === 'brightness' && value !== 0) {
            this.editor.addEffectToClip(clip.id, 'BrightnessContrast', { brightness: value, contrast: 1 });
        } else if (type === 'contrast' && value !== 1) {
            this.editor.addEffectToClip(clip.id, 'BrightnessContrast', { brightness: 0, contrast: value });
        } else if (type === 'saturation' && value !== 1) {
            this.editor.addEffectToClip(clip.id, 'Saturation', { saturation: value });
        }
    }

    private applyCurrentAdjustments(clip: any) {
        const brightness = parseFloat((document.getElementById('brightness') as HTMLInputElement).value);
        const contrast = parseFloat((document.getElementById('contrast') as HTMLInputElement).value);
        const saturation = parseFloat((document.getElementById('saturation') as HTMLInputElement).value);

        // Apply all adjustments at once
        const clipData = this.editor.getClip(clip.id);
        if (!clipData) return;
        
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

    private addGrayscaleEffect() {
        if (this.currentClip1) {
            this.editor.addEffectToClip(this.currentClip1.id, 'Grayscale', { strength: 1.0 });
        }
        if (this.currentClip2) {
            this.editor.addEffectToClip(this.currentClip2.id, 'Grayscale', { strength: 1.0 });
        }
    }

    private addBlurEffect() {
        if (this.currentClip1) {
            this.editor.addEffectToClip(this.currentClip1.id, 'Blur', { radius: 5.0 });
        }
        if (this.currentClip2) {
            this.editor.addEffectToClip(this.currentClip2.id, 'Blur', { radius: 5.0 });
        }
    }

    private clearAllEffects() {
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

    private handleTransitionChange(transitionType: string) {
        if (this.currentClip1 && this.currentClip2 && transitionType !== 'none') {
            this.editor.addTransition(this.currentClip1, this.currentClip2, transitionType, {
                duration: 1.0,
                strength: 0.5
            });
        }
    }

    private play() {
        this.editor.play();
        this.isPlaying = true;
        this.updatePlaybackControls();
        this.startPlaybackLoop();
    }

    private pause() {
        this.editor.pause();
        this.isPlaying = false;
        this.updatePlaybackControls();
    }

    private seek(percentage: string) {
        const duration = 10; // durationSeconds from config
        const time = (parseFloat(percentage) / 100) * duration;
        this.editor.seek(time);
    }

    private startPlaybackLoop() {
        const updateLoop = () => {
            if (this.isPlaying) {
                this.updatePlaybackUI();
                requestAnimationFrame(updateLoop);
            }
        };
        updateLoop();
    }

    private updatePlaybackUI() {
        // Note: TiramisuEditor doesn't expose getCurrentTime/getDuration
        // For now, we'll use a simplified approach based on config
        const duration = 10; // durationSeconds from config
        const currentTime = this.isPlaying ? 0 : 0; // Simplified - would need actual time tracking
        
        const percentage = 0; // Simplified - would need actual percentage calculation

        const seekBar = document.getElementById('seek-bar') as HTMLInputElement;
        const timeDisplay = document.getElementById('time-display');

        if (seekBar) {
            seekBar.value = percentage.toString();
        }
        if (timeDisplay) {
            timeDisplay.textContent = `${this.formatTime(currentTime)} / ${this.formatTime(duration)}`;
        }
    }

    private updatePlaybackControls() {
        const playBtn = document.getElementById('play-btn') as HTMLButtonElement;
        const pauseBtn = document.getElementById('pause-btn') as HTMLButtonElement;

        if (playBtn && pauseBtn) {
            playBtn.disabled = this.isPlaying;
            pauseBtn.disabled = !this.isPlaying;
        }
    }

    private updateSliderValues() {
        ['brightness', 'contrast', 'saturation'].forEach(id => {
            const slider = document.getElementById(id) as HTMLInputElement;
            const valueElement = document.getElementById(`${id}-value`);
            if (slider && valueElement) {
                valueElement.textContent = parseFloat(slider.value).toFixed(2);
            }
        });
    }

    private updateVideoStatus(elementId: string, status: string) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = status;
        }
    }

    private formatTime(seconds: number): string {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    private formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    public dispose() {
        this.editor.dispose();
        if (this.video1) {
            URL.revokeObjectURL(this.video1.objectUrl);
        }
        if (this.video2) {
            URL.revokeObjectURL(this.video2.objectUrl);
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new WebGLEditorApp();
    
    // Make app available globally for debugging
    (window as any).webglEditorApp = app;
});

export { WebGLEditorApp };