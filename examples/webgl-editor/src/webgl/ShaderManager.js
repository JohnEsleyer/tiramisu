import { PASSTHROUGH_VERTEX_SHADER, PASSTHROUGH_FRAGMENT_SHADER, GRAYSCALE_FRAGMENT_SHADER, BLUR_FRAGMENT_SHADER, BRIGHTNESS_FRAGMENT_SHADER, TINT_FRAGMENT_SHADER, CHROMA_KEY_FRAGMENT_SHADER, VIGNETTE_FRAGMENT_SHADER, SATURATION_FRAGMENT_SHADER, LUT_FRAGMENT_SHADER } from './shaders/ShaderLibrary.js';
export class ShaderManager {
    constructor(renderer) {
        this.loadedShaders = new Set();
        this.renderer = renderer;
        this.initializeDefaultShaders();
    }
    initializeDefaultShaders() {
        // Load all default shaders
        this.loadShader('passthrough', PASSTHROUGH_VERTEX_SHADER, PASSTHROUGH_FRAGMENT_SHADER);
        this.loadShader('grayscale', PASSTHROUGH_VERTEX_SHADER, GRAYSCALE_FRAGMENT_SHADER);
        this.loadShader('blur', PASSTHROUGH_VERTEX_SHADER, BLUR_FRAGMENT_SHADER);
        this.loadShader('brightness', PASSTHROUGH_VERTEX_SHADER, BRIGHTNESS_FRAGMENT_SHADER);
        this.loadShader('tint', PASSTHROUGH_VERTEX_SHADER, TINT_FRAGMENT_SHADER);
        this.loadShader('chromakey', PASSTHROUGH_VERTEX_SHADER, CHROMA_KEY_FRAGMENT_SHADER);
        this.loadShader('vignette', PASSTHROUGH_VERTEX_SHADER, VIGNETTE_FRAGMENT_SHADER);
        this.loadShader('saturation', PASSTHROUGH_VERTEX_SHADER, SATURATION_FRAGMENT_SHADER);
        this.loadShader('lut', PASSTHROUGH_VERTEX_SHADER, LUT_FRAGMENT_SHADER);
    }
    loadShader(id, vertexShader, fragmentShader) {
        try {
            this.renderer.createShaderProgram(id, vertexShader, fragmentShader);
            this.loadedShaders.add(id);
        }
        catch (error) {
            console.error(`Failed to load shader '${id}':`, error);
            throw error;
        }
    }
    isShaderLoaded(id) {
        return this.loadedShaders.has(id);
    }
    getLoadedShaders() {
        return Array.from(this.loadedShaders);
    }
    // Convenience methods for creating common effects
    createGrayscaleEffect(strength = 1.0) {
        return {
            id: `grayscale_${Date.now()}`,
            shaderId: 'grayscale',
            uniforms: {
                u_strength: strength
            },
            enabled: true
        };
    }
    createBlurEffect(radius, resolution, direction = 'both') {
        const directionMap = { horizontal: 0, vertical: 1, both: 2 };
        return {
            id: `blur_${Date.now()}`,
            shaderId: 'blur',
            uniforms: {
                u_radius: radius,
                u_resolution: [resolution.width, resolution.height],
                u_direction: directionMap[direction]
            },
            enabled: true
        };
    }
    createBrightnessEffect(brightness, contrast = 1.0) {
        return {
            id: `brightness_${Date.now()}`,
            shaderId: 'brightness',
            uniforms: {
                u_brightness: brightness,
                u_contrast: contrast
            },
            enabled: true
        };
    }
    createTintEffect(color, strength = 1.0) {
        return {
            id: `tint_${Date.now()}`,
            shaderId: 'tint',
            uniforms: {
                u_tintColor: [color.r, color.g, color.b],
                u_tintStrength: strength
            },
            enabled: true
        };
    }
    createChromaKeyEffect(keyColor, threshold = 0.3, softness = 0.1, spillReduction = 0.5) {
        return {
            id: `chromakey_${Date.now()}`,
            shaderId: 'chromakey',
            uniforms: {
                u_keyColor: [keyColor.r, keyColor.g, keyColor.b],
                u_threshold: threshold,
                u_softness: softness,
                u_spillReduction: spillReduction
            },
            enabled: true
        };
    }
    // Create custom effect with any shader
    createCustomEffect(shaderId, uniforms) {
        if (!this.isShaderLoaded(shaderId)) {
            throw new Error(`Shader '${shaderId}' is not loaded`);
        }
        return {
            id: `custom_${shaderId}_${Date.now()}`,
            shaderId,
            uniforms,
            enabled: true
        };
    }
    // Create effect chain (multiple effects applied in sequence)
    createEffectChain(effects) {
        return effects.map((effect, index) => ({
            ...effect,
            id: effect.id || `chain_${index}_${Date.now()}`
        }));
    }
    // Preset effect combinations
    createVintageEffect() {
        return [
            this.createBrightnessEffect(-0.1, 1.1),
            this.createTintEffect({ r: 1.0, g: 0.9, b: 0.7 }, 0.3),
            this.createBlurEffect(0.5, { width: 1920, height: 1080 }, 'both')
        ];
    }
    createCinematicEffect() {
        return [
            this.createBrightnessEffect(-0.05, 1.2),
            this.createTintEffect({ r: 0.9, g: 0.95, b: 1.0 }, 0.2)
        ];
    }
    createBlackAndWhiteEffect() {
        return [
            this.createGrayscaleEffect(1.0),
            this.createBrightnessEffect(0.1, 1.1)
        ];
    }
    // Utility method to update effect uniforms
    updateEffectUniform(effect, uniformName, value) {
        effect.uniforms[uniformName] = value;
    }
    // Convenience methods for additional effects
    createVignetteEffect(intensity = 0.5, radius = 0.8) {
        return {
            id: `vignette_${Date.now()}`,
            shaderId: 'vignette',
            uniforms: {
                u_intensity: intensity,
                u_radius: radius
            },
            enabled: true
        };
    }
    createSaturationEffect(saturation) {
        return {
            id: `saturation_${Date.now()}`,
            shaderId: 'saturation',
            uniforms: {
                u_saturation: saturation
            },
            enabled: true
        };
    }
    createLUTEffect(lutTexture, intensity = 1.0) {
        return {
            id: `lut_${Date.now()}`,
            shaderId: 'lut',
            uniforms: {
                u_lutTexture: lutTexture,
                u_intensity: intensity
            },
            enabled: true
        };
    }
    // Utility method to toggle effect on/off
    toggleEffect(effect) {
        effect.enabled = !effect.enabled;
    }
    dispose() {
        this.loadedShaders.clear();
    }
}
