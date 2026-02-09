import { ShaderManager } from '../ShaderManager.js';
import { Effect, ShaderUniform } from '../../types.js';

// gl-transitions compatible shader templates
export const GL_TRANSITIONS = {
    // Simple crossfade
    Crossfade: {
        vertex: `#version 300 es
            precision highp float;
            in vec2 a_position;
            in vec2 a_texCoord;
            out vec2 v_texCoord1;
            out vec2 v_texCoord2;
            
            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
                v_texCoord1 = a_texCoord;
                v_texCoord2 = a_texCoord;
            }
        `,
        fragment: `#version 300 es
            precision highp float;
            in vec2 v_texCoord1;
            in vec2 v_texCoord2;
            uniform sampler2D u_texture1;
            uniform sampler2D u_texture2;
            uniform float u_progress; // 0.0 to 1.0
            out vec4 fragColor;
            
            void main() {
                vec4 color1 = texture(u_texture1, v_texCoord1);
                vec4 color2 = texture(u_texture2, v_texCoord2);
                fragColor = mix(color1, color2, u_progress);
            }
        `,
        uniforms: {
            progress: { type: 'float', default: 0.0 }
        }
    },
    
    // Cross zoom transition
    CrossZoom: {
        vertex: `#version 300 es
            precision highp float;
            in vec2 a_position;
            in vec2 a_texCoord;
            out vec2 v_texCoord1;
            out vec2 v_texCoord2;
            
            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
                v_texCoord1 = a_texCoord;
                v_texCoord2 = a_texCoord;
            }
        `,
        fragment: `#version 300 es
            precision highp float;
            in vec2 v_texCoord1;
            in vec2 v_texCoord2;
            uniform sampler2D u_texture1;
            uniform sampler2D u_texture2;
            uniform float u_progress;
            uniform float u_strength;
            out vec4 fragColor;
            
            vec2 getDistortedUV(vec2 uv, float strength, vec2 center) {
                vec2 offset = uv - center;
                float distortion = 1.0 + strength * length(offset);
                return center + offset / distortion;
            }
            
            void main() {
                vec2 center = vec2(0.5);
                
                vec2 uv1 = getDistortedUV(v_texCoord1, -u_progress * u_strength, center);
                vec2 uv2 = getDistortedUV(v_texCoord2, (1.0 - u_progress) * u_strength, center);
                
                vec4 color1 = texture(u_texture1, uv1);
                vec4 color2 = texture(u_texture2, uv2);
                
                fragColor = mix(color1, color2, u_progress);
            }
        `,
        uniforms: {
            progress: { type: 'float', default: 0.0 },
            strength: { type: 'float', default: 0.4 }
        }
    },
    
    // Doorway transition
    Doorway: {
        vertex: `#version 300 es
            precision highp float;
            in vec2 a_position;
            in vec2 a_texCoord;
            out vec2 v_texCoord1;
            out vec2 v_texCoord2;
            
            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
                v_texCoord1 = a_texCoord;
                v_texCoord2 = a_texCoord;
            }
        `,
        fragment: `#version 300 es
            precision highp float;
            in vec2 v_texCoord1;
            in vec2 v_texCoord2;
            uniform sampler2D u_texture1;
            uniform sampler2D u_texture2;
            uniform float u_progress;
            uniform float u_division;
            out vec4 fragColor;
            
            void main() {
                vec2 uv = v_texCoord1;
                float divider = u_division * abs(u_progress - 0.5);
                
                vec4 color1, color2;
                
                if (uv.x > 0.5 - divider && uv.x < 0.5 + divider) {
                    // Show first texture in the middle
                    color1 = texture(u_texture1, uv);
                    color2 = vec4(0.0);
                } else if (uv.x < 0.5) {
                    // Left side - first texture with perspective
                    float perspective = 1.0 - u_progress * 2.0;
                    vec2 distortedUV = uv;
                    distortedUV.x = uv.x * (1.0 + perspective * (0.5 - uv.x));
                    color1 = texture(u_texture1, distortedUV);
                    color2 = vec4(0.0);
                } else {
                    // Right side - first texture with perspective
                    float perspective = 1.0 - u_progress * 2.0;
                    vec2 distortedUV = uv;
                    distortedUV.x = uv.x + perspective * (uv.x - 0.5);
                    color1 = texture(u_texture1, distortedUV);
                    color2 = vec4(0.0);
                }
                
                fragColor = mix(color1, color2, u_progress);
            }
        `,
        uniforms: {
            progress: { type: 'float', default: 0.0 },
            division: { type: 'float', default: 0.5 }
        }
    },
    
    // Swirl transition
    Swirl: {
        vertex: `#version 300 es
            precision highp float;
            in vec2 a_position;
            in vec2 a_texCoord;
            out vec2 v_texCoord1;
            out vec2 v_texCoord2;
            
            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
                v_texCoord1 = a_texCoord;
                v_texCoord2 = a_texCoord;
            }
        `,
        fragment: `#version 300 es
            precision highp float;
            in vec2 v_texCoord1;
            in vec2 v_texCoord2;
            uniform sampler2D u_texture1;
            uniform sampler2D u_texture2;
            uniform float u_progress;
            uniform float u_radius;
            uniform float u_strength;
            out vec4 fragColor;
            
            vec2 swirlUV(vec2 uv, float progress, vec2 center, float radius, float strength) {
                vec2 offset = uv - center;
                float distance = length(offset);
                
                if (distance < radius) {
                    float percent = (radius - distance) / radius;
                    float theta = percent * percent * strength * progress;
                    float s = sin(theta);
                    float c = cos(theta);
                    
                    offset = vec2(
                        offset.x * c - offset.y * s,
                        offset.x * s + offset.y * c
                    );
                }
                
                return center + offset;
            }
            
            void main() {
                vec2 center = vec2(0.5);
                
                vec2 uv1 = swirlUV(v_texCoord1, 1.0 - u_progress, center, u_radius, u_strength);
                vec2 uv2 = swirlUV(v_texCoord2, u_progress, center, u_radius, -u_strength);
                
                vec4 color1 = texture(u_texture1, uv1);
                vec4 color2 = texture(u_texture2, uv2);
                
                fragColor = mix(color1, color2, u_progress);
            }
        `,
        uniforms: {
            progress: { type: 'float', default: 0.0 },
            radius: { type: 'float', default: 1.0 },
            strength: { type: 'float', default: 2.0 }
        }
    },
    
    // Glitch transition
    Glitch: {
        vertex: `#version 300 es
            precision highp float;
            in vec2 a_position;
            in vec2 a_texCoord;
            out vec2 v_texCoord1;
            out vec2 v_texCoord2;
            
            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
                v_texCoord1 = a_texCoord;
                v_texCoord2 = a_texCoord;
            }
        `,
        fragment: `#version 300 es
            precision highp float;
            in vec2 v_texCoord1;
            in vec2 v_texCoord2;
            uniform sampler2D u_texture1;
            uniform sampler2D u_texture2;
            uniform float u_progress;
            uniform float u_strength;
            out vec4 fragColor;
            
            float random(vec2 st) {
                return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
            }
            
            void main() {
                vec2 uv = v_texCoord1;
                
                // Create glitch effect
                float glitch = random(vec2(u_progress * 1000.0, uv.y)) * u_strength;
                float threshold = 0.95;
                
                vec4 color1, color2;
                
                if (random(uv) > threshold) {
                    // Horizontal displacement
                    uv.x += glitch * 0.1;
                    color1 = texture(u_texture1, uv);
                } else if (random(uv + 0.1) > threshold) {
                    // Color channel separation
                    float r = texture(u_texture1, uv + vec2(glitch * 0.01, 0.0)).r;
                    float g = texture(u_texture1, uv).g;
                    float b = texture(u_texture1, uv - vec2(glitch * 0.01, 0.0)).b;
                    color1 = vec4(r, g, b, 1.0);
                } else {
                    color1 = texture(u_texture1, uv);
                }
                
                color2 = texture(u_texture2, v_texCoord2);
                
                fragColor = mix(color1, color2, u_progress);
            }
        `,
        uniforms: {
            progress: { type: 'float', default: 0.0 },
            strength: { type: 'float', default: 0.5 }
        }
    }
};

export class GLTransitionManager {
    private shaderManager: ShaderManager;
    private loadedTransitions: Set<string> = new Set();
    
    constructor(shaderManager: ShaderManager) {
        this.shaderManager = shaderManager;
        this.loadDefaultTransitions();
    }
    
    private loadDefaultTransitions(): void {
        Object.entries(GL_TRANSITIONS).forEach(([name, transition]) => {
            this.loadTransition(name, transition.vertex, transition.fragment, transition.uniforms);
        });
    }
    
    loadTransition(name: string, vertexShader: string, fragmentShader: string, uniforms: Record<string, any>): void {
        try {
            this.shaderManager.loadShader(name, vertexShader, fragmentShader);
            this.loadedTransitions.add(name);
            console.log(`Loaded transition: ${name}`);
        } catch (error) {
            console.error(`Failed to load transition '${name}':`, error);
        }
    }
    
    createTransitionEffect(name: string, progress: number, customUniforms: Record<string, ShaderUniform> = {}): Effect | null {
        if (!this.loadedTransitions.has(name)) {
            console.error(`Transition '${name}' not loaded`);
            return null;
        }
        
        const transition = GL_TRANSITIONS[name as keyof typeof GL_TRANSITIONS];
        if (!transition) return null;
        
        // Merge default uniforms with custom uniforms
        const uniforms: Record<string, ShaderUniform> = { ...transition.uniforms };
        
        // Set progress value
        uniforms.u_progress = progress;
        
        // Override with custom uniforms
        Object.entries(customUniforms).forEach(([key, value]) => {
            if (key.startsWith('u_')) {
                uniforms[key] = value;
            }
        });
        
        return this.shaderManager.createCustomEffect(name, uniforms);
    }
    
    getAvailableTransitions(): string[] {
        return Array.from(this.loadedTransitions);
    }
    
    isTransitionLoaded(name: string): boolean {
        return this.loadedTransitions.has(name);
    }
    
    // Get transition parameters for UI
    getTransitionParameters(name: string): Record<string, any> | null {
        const transition = GL_TRANSITIONS[name as keyof typeof GL_TRANSITIONS];
        if (!transition) return null;
        
        return transition.uniforms;
    }
}