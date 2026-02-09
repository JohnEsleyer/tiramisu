import { 
    WebGLRenderContext, 
    ShaderProgram, 
    Effect, 
    WebGLLayer, 
    ShaderUniform,
    RenderConfig 
} from '../types.js';

export class TiramisuRenderer {
    private gl: WebGL2RenderingContext;
    private canvas: HTMLCanvasElement;
    private width: number;
    private height: number;
    
    // Ping-pong framebuffers for multi-pass rendering
    private framebuffers!: [WebGLFramebuffer, WebGLFramebuffer];
    private frameTextures!: [WebGLTexture, WebGLTexture];
    private currentBufferIndex: number = 0;
    
    // Shared quad vertex buffer (covers entire viewport)
    private quadBuffer!: WebGLBuffer;
    
    // Shader management
    private shaders: Map<string, ShaderProgram> = new Map();
    private currentProgram: WebGLProgram | null = null;
    
    // Default pass-through shader
    private defaultShaderId: string = 'passthrough';
    
    constructor(canvas: HTMLCanvasElement, config: Partial<RenderConfig> = {}) {
        this.canvas = canvas;
        this.width = config.width || 1920;
        this.height = config.height || 1080;
        
        canvas.width = this.width;
        canvas.height = this.height;
        
        const gl = canvas.getContext('webgl2', config.webglContextAttributes);
        if (!gl) {
            throw new Error('WebGL2 not supported');
        }
        this.gl = gl;
        
        this.setupGLState();
        this.createFramebuffers();
        this.createSharedQuad();
        this.createDefaultShaders();
    }
    
    private setupGLState(): void {
        const gl = this.gl;
        
        // Set viewport to cover entire canvas
        gl.viewport(0, 0, this.width, this.height);
        
        // Enable blending for transparency
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        
        // Create and bind vertex array for the shared quad
        const vao = gl.createVertexArray();
        if (vao) {
            gl.bindVertexArray(vao);
        }
    }
    
    private createFramebuffers(): void {
        const gl = this.gl;
        
        // Create two framebuffers for ping-pong rendering
        this.framebuffers = [
            gl.createFramebuffer()!,
            gl.createFramebuffer()!
        ];
        
        // Create corresponding textures
        this.frameTextures = [
            gl.createTexture()!,
            gl.createTexture()!
        ];
        
        // Initialize framebuffers and textures
        for (let i = 0; i < 2; i++) {
            gl.bindTexture(gl.TEXTURE_2D, this.frameTextures[i]);
            gl.texImage2D(
                gl.TEXTURE_2D,
                0,
                gl.RGBA,
                this.width,
                this.height,
                0,
                gl.RGBA,
                gl.UNSIGNED_BYTE,
                null
            );
            
            // Set texture parameters for optimal rendering
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[i]);
            gl.framebufferTexture2D(
                gl.FRAMEBUFFER,
                gl.COLOR_ATTACHMENT0,
                gl.TEXTURE_2D,
                this.frameTextures[i],
                0
            );
        }
        
        // Clean up bindings
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    
    private createSharedQuad(): void {
        const gl = this.gl;
        
        // Create a quad that covers the entire viewport
        // Two triangles forming a square with UV coordinates
        const vertices = new Float32Array([
            // Position (x, y)  UV coordinates (u, v)
            -1.0, -1.0,       0.0, 1.0,  // Bottom-left
             1.0, -1.0,       1.0, 1.0,  // Bottom-right
            -1.0,  1.0,       0.0, 0.0,  // Top-left
             1.0,  1.0,       1.0, 0.0,  // Top-right
        ]);
        
        this.quadBuffer = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }
    
    private createDefaultShaders(): void {
        // Pass-through vertex shader
        const vertexShaderSource = `#version 300 es
            in vec2 a_position;
            in vec2 a_texCoord;
            out vec2 v_texCoord;
            
            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
                v_texCoord = a_texCoord;
            }
        `;
        
        // Pass-through fragment shader with alpha support
        const fragmentShaderSource = `#version 300 es
            precision highp float;
            in vec2 v_texCoord;
            uniform sampler2D u_sourceTexture;
            uniform float u_opacity;
            uniform vec2 u_resolution;
            out vec4 fragColor;
            
            void main() {
                vec4 color = texture(u_sourceTexture, v_texCoord);
                color.a *= u_opacity;
                fragColor = color;
            }
        `;
        
        this.createShaderProgram(
            this.defaultShaderId,
            vertexShaderSource,
            fragmentShaderSource
        );
    }
    
    createShaderProgram(
        id: string, 
        vertexShaderSource: string, 
        fragmentShaderSource: string
    ): void {
        const gl = this.gl;
        
        // Compile vertex shader
        const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
        gl.shaderSource(vertexShader, vertexShaderSource);
        gl.compileShader(vertexShader);
        
        if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
            const error = gl.getShaderInfoLog(vertexShader);
            gl.deleteShader(vertexShader);
            throw new Error(`Vertex shader compilation failed: ${error}`);
        }
        
        // Compile fragment shader
        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
        gl.shaderSource(fragmentShader, fragmentShaderSource);
        gl.compileShader(fragmentShader);
        
        if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
            const error = gl.getShaderInfoLog(fragmentShader);
            gl.deleteShader(vertexShader);
            gl.deleteShader(fragmentShader);
            throw new Error(`Fragment shader compilation failed: ${error}`);
        }
        
        // Create and link program
        const program = gl.createProgram()!;
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const error = gl.getProgramInfoLog(program);
            gl.deleteProgram(program);
            throw new Error(`Shader program linking failed: ${error}`);
        }
        
        // Store uniform and attribute locations
        const uniforms = new Map<string, WebGLUniformLocation>();
        const attributes = new Map<string, number>();
        
        // Get standard uniforms
        uniforms.set('u_sourceTexture', gl.getUniformLocation(program, 'u_sourceTexture')!);
        
        // Get standard attributes
        attributes.set('a_position', gl.getAttribLocation(program, 'a_position')!);
        attributes.set('a_texCoord', gl.getAttribLocation(program, 'a_texCoord')!);
        
        // Store shader program
        this.shaders.set(id, {
            id,
            program,
            uniforms,
            attributes
        });
        
        // Clean up shader objects (they're now linked to the program)
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
    }
    
    useShader(id: string): void {
        const shader = this.shaders.get(id);
        if (!shader) {
            throw new Error(`Shader '${id}' not found`);
        }
        
        if (this.currentProgram !== shader.program) {
            const gl = this.gl;
            gl.useProgram(shader.program);
            this.currentProgram = shader.program;
            
            // Set up shared quad attributes (they're the same for all shaders)
            this.setupQuadAttributes(shader);
        }
    }
    
    private setupQuadAttributes(shader: ShaderProgram): void {
        const gl = this.gl;
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        
        // Set up position attribute
        const positionLoc = shader.attributes.get('a_position');
        if (positionLoc !== undefined) {
            gl.enableVertexAttribArray(positionLoc);
            gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 16, 0);
        }
        
        // Set up texture coordinate attribute
        const texCoordLoc = shader.attributes.get('a_texCoord');
        if (texCoordLoc !== undefined) {
            gl.enableVertexAttribArray(texCoordLoc);
            gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 16, 8);
        }
        
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }
    
    setUniform(shaderId: string, uniformName: string, value: ShaderUniform): void {
        const shader = this.shaders.get(shaderId);
        if (!shader) return;
        
        const gl = this.gl;
        const location = shader.uniforms.get(uniformName);
        if (!location) return;
        
        this.useShader(shaderId);
        
        if (typeof value === 'number') {
            gl.uniform1f(location, value);
        } else if (typeof value === 'boolean') {
            gl.uniform1i(location, value ? 1 : 0);
        } else if (value instanceof WebGLTexture) {
            // For textures, we need to bind to a texture unit
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, value);
            gl.uniform1i(location, 0);
        } else if (Array.isArray(value)) {
            if (value.length === 2) {
                gl.uniform2fv(location, value);
            } else if (value.length === 3) {
                gl.uniform3fv(location, value);
            } else if (value.length === 4) {
                gl.uniform4fv(location, value);
            }
        }
    }
    
    renderToTexture(sourceTexture: WebGLTexture, effects: Effect[] = []): WebGLTexture {
        const gl = this.gl;
        
        // Use ping-pong rendering for multiple effects
        let inputTexture = sourceTexture;
        
        for (let i = 0; i < effects.length; i++) {
            const effect = effects[i];
            if (!effect.enabled) continue;
            
            // Bind to the current framebuffer
            const targetBuffer = this.framebuffers[this.currentBufferIndex];
            gl.bindFramebuffer(gl.FRAMEBUFFER, targetBuffer);
            
            // Use the effect's shader
            this.useShader(effect.shaderId);
            
            // Set the input texture
            this.setUniform(effect.shaderId, 'u_sourceTexture', inputTexture);
            
            // Apply effect-specific uniforms
            Object.entries(effect.uniforms).forEach(([name, value]) => {
                this.setUniform(effect.shaderId, name, value);
            });
            
            // Render the quad
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            
            // Swap buffers: the rendered texture becomes the input for the next pass
            inputTexture = this.frameTextures[this.currentBufferIndex];
            this.currentBufferIndex = 1 - this.currentBufferIndex; // Toggle between 0 and 1
        }
        
        // Clean up
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        
        return inputTexture;
    }
    
    renderToCanvas(sourceTexture: WebGLTexture, effects: Effect[] = []): void {
        const gl = this.gl;
        
        // First render to texture if there are effects
        const finalTexture = effects.length > 0 
            ? this.renderToTexture(sourceTexture, effects)
            : sourceTexture;
        
        // Then render to canvas
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        
        // Use default pass-through shader
        this.useShader(this.defaultShaderId);
        this.setUniform(this.defaultShaderId, 'u_sourceTexture', finalTexture);
        this.setUniform(this.defaultShaderId, 'u_opacity', 1.0);
        this.setUniform(this.defaultShaderId, 'u_resolution', [this.width, this.height]);
        
        // Clear canvas
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        
        // Render the quad
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    
    createTexture(width?: number, height?: number): WebGLTexture {
        const gl = this.gl;
        const texture = gl.createTexture()!;
        
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            width || this.width,
            height || this.height,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            null
        );
        
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        
        gl.bindTexture(gl.TEXTURE_2D, null);
        
        return texture;
    }
    
    updateTexture(texture: WebGLTexture, source: HTMLImageElement | HTMLCanvasElement | VideoFrame): void {
        const gl = this.gl;
        
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texSubImage2D(
            gl.TEXTURE_2D,
            0,
            0,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            source
        );
        gl.bindTexture(gl.TEXTURE_2D, null);
    }
    
    createWebGLLayer(width?: number, height?: number): WebGLLayer {
        const texture = this.createTexture(width, height);
        
        return {
            texture,
            width: width || this.width,
            height: height || this.height,
            clear: () => {
                // Implementation would require rendering a transparent quad to the texture
                // For now, this is a placeholder
            },
            applyShader: (shaderId: string, uniforms: Record<string, ShaderUniform>) => {
                // Apply shader to this layer's texture
                const effect: Effect = {
                    id: `layer_${Date.now()}`,
                    shaderId,
                    uniforms,
                    enabled: true
                };
                this.renderToTexture(texture, [effect]);
            }
        };
    }
    
    resize(newWidth: number, newHeight: number): void {
        if (newWidth === this.width && newHeight === this.height) return;
        
        this.width = newWidth;
        this.height = newHeight;
        this.canvas.width = newWidth;
        this.canvas.height = newHeight;
        
        const gl = this.gl;
        gl.viewport(0, 0, newWidth, newHeight);
        
        // Recreate framebuffers with new dimensions
        this.createFramebuffers();
    }
    
    dispose(): void {
        const gl = this.gl;
        
        // Clean up framebuffers and textures
        this.framebuffers.forEach(fb => gl.deleteFramebuffer(fb));
        this.frameTextures.forEach(tex => gl.deleteTexture(tex));
        gl.deleteBuffer(this.quadBuffer);
        
        // Clean up shaders
        this.shaders.forEach(shader => {
            gl.deleteProgram(shader.program);
        });
        
        this.shaders.clear();
    }
}