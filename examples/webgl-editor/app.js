// src/webgl/TiramisuRenderer.ts
var TiramisuRenderer = class {
  gl;
  canvas;
  width;
  height;
  // Ping-pong framebuffers for multi-pass rendering
  framebuffers;
  frameTextures;
  currentBufferIndex = 0;
  // Shared quad vertex buffer (covers entire viewport)
  quadBuffer;
  // Shader management
  shaders = /* @__PURE__ */ new Map();
  currentProgram = null;
  // Default pass-through shader
  defaultShaderId = "passthrough";
  constructor(canvas, config = {}) {
    this.canvas = canvas;
    this.width = config.width || 1920;
    this.height = config.height || 1080;
    canvas.width = this.width;
    canvas.height = this.height;
    const gl = canvas.getContext("webgl2", config.webglContextAttributes);
    if (!gl) {
      throw new Error("WebGL2 not supported");
    }
    this.gl = gl;
    this.setupGLState();
    this.createFramebuffers();
    this.createSharedQuad();
    this.createDefaultShaders();
  }
  setupGLState() {
    const gl = this.gl;
    gl.viewport(0, 0, this.width, this.height);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    const vao = gl.createVertexArray();
    if (vao) {
      gl.bindVertexArray(vao);
    }
  }
  createFramebuffers() {
    const gl = this.gl;
    this.framebuffers = [
      gl.createFramebuffer(),
      gl.createFramebuffer()
    ];
    this.frameTextures = [
      gl.createTexture(),
      gl.createTexture()
    ];
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
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  createSharedQuad() {
    const gl = this.gl;
    const vertices = new Float32Array([
      // Position (x, y)  UV coordinates (u, v)
      -1,
      -1,
      0,
      1,
      // Bottom-left
      1,
      -1,
      1,
      1,
      // Bottom-right
      -1,
      1,
      0,
      0,
      // Top-left
      1,
      1,
      1,
      0
      // Top-right
    ]);
    this.quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }
  createDefaultShaders() {
    const vertexShaderSource = `#version 300 es
            in vec2 a_position;
            in vec2 a_texCoord;
            out vec2 v_texCoord;
            
            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
                v_texCoord = a_texCoord;
            }
        `;
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
  createShaderProgram(id, vertexShaderSource, fragmentShaderSource) {
    const gl = this.gl;
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(vertexShader);
      gl.deleteShader(vertexShader);
      throw new Error(`Vertex shader compilation failed: ${error}`);
    }
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(fragmentShader);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      throw new Error(`Fragment shader compilation failed: ${error}`);
    }
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const error = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`Shader program linking failed: ${error}`);
    }
    const uniforms = /* @__PURE__ */ new Map();
    const attributes = /* @__PURE__ */ new Map();
    uniforms.set("u_sourceTexture", gl.getUniformLocation(program, "u_sourceTexture"));
    attributes.set("a_position", gl.getAttribLocation(program, "a_position"));
    attributes.set("a_texCoord", gl.getAttribLocation(program, "a_texCoord"));
    this.shaders.set(id, {
      id,
      program,
      uniforms,
      attributes
    });
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
  }
  useShader(id) {
    const shader = this.shaders.get(id);
    if (!shader) {
      throw new Error(`Shader '${id}' not found`);
    }
    if (this.currentProgram !== shader.program) {
      const gl = this.gl;
      gl.useProgram(shader.program);
      this.currentProgram = shader.program;
      this.setupQuadAttributes(shader);
    }
  }
  setupQuadAttributes(shader) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    const positionLoc = shader.attributes.get("a_position");
    if (positionLoc !== void 0) {
      gl.enableVertexAttribArray(positionLoc);
      gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 16, 0);
    }
    const texCoordLoc = shader.attributes.get("a_texCoord");
    if (texCoordLoc !== void 0) {
      gl.enableVertexAttribArray(texCoordLoc);
      gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 16, 8);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }
  setUniform(shaderId, uniformName, value) {
    const shader = this.shaders.get(shaderId);
    if (!shader)
      return;
    const gl = this.gl;
    const location = shader.uniforms.get(uniformName);
    if (!location)
      return;
    this.useShader(shaderId);
    if (typeof value === "number") {
      gl.uniform1f(location, value);
    } else if (typeof value === "boolean") {
      gl.uniform1i(location, value ? 1 : 0);
    } else if (value instanceof WebGLTexture) {
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
  renderToTexture(sourceTexture, effects = []) {
    const gl = this.gl;
    let inputTexture = sourceTexture;
    for (let i = 0; i < effects.length; i++) {
      const effect = effects[i];
      if (!effect.enabled)
        continue;
      const targetBuffer = this.framebuffers[this.currentBufferIndex];
      gl.bindFramebuffer(gl.FRAMEBUFFER, targetBuffer);
      this.useShader(effect.shaderId);
      this.setUniform(effect.shaderId, "u_sourceTexture", inputTexture);
      Object.entries(effect.uniforms).forEach(([name, value]) => {
        this.setUniform(effect.shaderId, name, value);
      });
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      inputTexture = this.frameTextures[this.currentBufferIndex];
      this.currentBufferIndex = 1 - this.currentBufferIndex;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return inputTexture;
  }
  renderToCanvas(sourceTexture, effects = []) {
    const gl = this.gl;
    const finalTexture = effects.length > 0 ? this.renderToTexture(sourceTexture, effects) : sourceTexture;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.useShader(this.defaultShaderId);
    this.setUniform(this.defaultShaderId, "u_sourceTexture", finalTexture);
    this.setUniform(this.defaultShaderId, "u_opacity", 1);
    this.setUniform(this.defaultShaderId, "u_resolution", [this.width, this.height]);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  createTexture(width, height) {
    const gl = this.gl;
    const texture = gl.createTexture();
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
  updateTexture(texture, source) {
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
  createWebGLLayer(width, height) {
    const texture = this.createTexture(width, height);
    return {
      texture,
      width: width || this.width,
      height: height || this.height,
      clear: () => {
      },
      applyShader: (shaderId, uniforms) => {
        const effect = {
          id: `layer_${Date.now()}`,
          shaderId,
          uniforms,
          enabled: true
        };
        this.renderToTexture(texture, [effect]);
      }
    };
  }
  resize(newWidth, newHeight) {
    if (newWidth === this.width && newHeight === this.height)
      return;
    this.width = newWidth;
    this.height = newHeight;
    this.canvas.width = newWidth;
    this.canvas.height = newHeight;
    const gl = this.gl;
    gl.viewport(0, 0, newWidth, newHeight);
    this.createFramebuffers();
  }
  dispose() {
    const gl = this.gl;
    this.framebuffers.forEach((fb) => gl.deleteFramebuffer(fb));
    this.frameTextures.forEach((tex) => gl.deleteTexture(tex));
    gl.deleteBuffer(this.quadBuffer);
    this.shaders.forEach((shader) => {
      gl.deleteProgram(shader.program);
    });
    this.shaders.clear();
  }
};

// src/webgl/TextureManager.ts
var TextureManager = class {
  gl;
  texturePool = [];
  usedTextures = /* @__PURE__ */ new Set();
  assetToTextureMap = /* @__PURE__ */ new Map();
  videoFrameCache = /* @__PURE__ */ new Map();
  // Pool configuration
  maxPoolSize = 32;
  defaultTextureWidth;
  defaultTextureHeight;
  constructor(gl, maxPoolSize = 32) {
    this.gl = gl;
    this.maxPoolSize = maxPoolSize;
    this.defaultTextureWidth = 1920;
    this.defaultTextureHeight = 1080;
    this.initializePool();
  }
  initializePool() {
    for (let i = 0; i < Math.min(8, this.maxPoolSize); i++) {
      const texture = this.createTexture();
      this.texturePool.push(texture);
    }
  }
  createTexture(width, height) {
    const gl = this.gl;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width || this.defaultTextureWidth,
      height || this.defaultTextureHeight,
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
  getTexture() {
    if (this.texturePool.length > 0) {
      const texture = this.texturePool.pop();
      this.usedTextures.add(texture);
      return texture;
    }
    if (this.usedTextures.size < this.maxPoolSize) {
      const texture = this.createTexture();
      this.usedTextures.add(texture);
      return texture;
    }
    console.warn("TextureManager: Pool exhausted, consider increasing maxPoolSize");
    return null;
  }
  releaseTexture(texture) {
    if (this.usedTextures.has(texture)) {
      this.usedTextures.delete(texture);
      this.texturePool.push(texture);
    }
  }
  clear() {
    this.usedTextures.forEach((texture) => {
      this.texturePool.push(texture);
    });
    this.usedTextures.clear();
    this.assetToTextureMap.clear();
    this.videoFrameCache.clear();
  }
  // Asset mapping methods
  getAssetTexture(asset) {
    return this.assetToTextureMap.get(asset) || null;
  }
  setAssetTexture(asset, texture) {
    this.assetToTextureMap.set(asset, texture);
  }
  removeAssetTexture(asset) {
    const texture = this.assetToTextureMap.get(asset);
    if (texture) {
      this.releaseTexture(texture);
      this.assetToTextureMap.delete(asset);
    }
  }
  // Video frame upload methods
  uploadVideoFrame(frame, targetTexture) {
    const gl = this.gl;
    const texture = targetTexture || this.getTexture();
    if (!texture) {
      throw new Error("Failed to get texture for video frame upload");
    }
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      frame
    );
    gl.bindTexture(gl.TEXTURE_2D, null);
    frame.close();
    return texture;
  }
  uploadVideoFrameOptimized(frame, targetTexture) {
    const gl = this.gl;
    const texture = targetTexture || this.getTexture();
    if (!texture) {
      throw new Error("Failed to get texture for video frame upload");
    }
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      frame
    );
    gl.bindTexture(gl.TEXTURE_2D, null);
    frame.close();
    return texture;
  }
  // Image upload methods
  uploadImage(image, targetTexture) {
    const gl = this.gl;
    const texture = targetTexture || this.getTexture();
    if (!texture) {
      throw new Error("Failed to get texture for image upload");
    }
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      image
    );
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return texture;
  }
  // Canvas upload methods
  uploadCanvas(canvas, targetTexture) {
    const gl = this.gl;
    const texture = targetTexture || this.getTexture();
    if (!texture) {
      throw new Error("Failed to get texture for canvas upload");
    }
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      canvas
    );
    gl.bindTexture(gl.TEXTURE_2D, null);
    return texture;
  }
  // Video frame caching for better performance
  cacheVideoFrame(videoId, frame, timestamp) {
    const texture = this.uploadVideoFrame(frame);
    if (!this.videoFrameCache.has(videoId)) {
      this.videoFrameCache.set(videoId, []);
    }
    const frameInfo = {
      frame,
      timestamp,
      texture
    };
    this.videoFrameCache.get(videoId).push(frameInfo);
    const cache = this.videoFrameCache.get(videoId);
    if (cache.length > 10) {
      const removed = cache.shift();
      if (removed.texture) {
        this.releaseTexture(removed.texture);
      }
    }
    return texture;
  }
  getCachedVideoFrame(videoId, timestamp, tolerance = 0.1) {
    const cache = this.videoFrameCache.get(videoId);
    if (!cache)
      return null;
    let closestFrame = null;
    let closestDistance = Infinity;
    for (const frameInfo of cache) {
      const distance = Math.abs(frameInfo.timestamp - timestamp);
      if (distance <= tolerance && distance < closestDistance) {
        closestFrame = frameInfo;
        closestDistance = distance;
      }
    }
    return closestFrame?.texture || null;
  }
  clearVideoFrameCache(videoId) {
    if (videoId) {
      const cache = this.videoFrameCache.get(videoId);
      if (cache) {
        cache.forEach((frameInfo) => {
          if (frameInfo.texture) {
            this.releaseTexture(frameInfo.texture);
          }
        });
        this.videoFrameCache.delete(videoId);
      }
    } else {
      this.videoFrameCache.forEach((cache) => {
        cache.forEach((frameInfo) => {
          if (frameInfo.texture) {
            this.releaseTexture(frameInfo.texture);
          }
        });
      });
      this.videoFrameCache.clear();
    }
  }
  // Memory management
  getMemoryUsage() {
    return {
      totalTextures: this.usedTextures.size + this.texturePool.length,
      usedTextures: this.usedTextures.size,
      pooledTextures: this.texturePool.length,
      cachedFrames: Array.from(this.videoFrameCache.values()).reduce((total, cache) => total + cache.length, 0)
    };
  }
  setDefaultTextureSize(width, height) {
    this.defaultTextureWidth = width;
    this.defaultTextureHeight = height;
  }
  // Cleanup
  dispose() {
    const gl = this.gl;
    this.texturePool.forEach((texture) => gl.deleteTexture(texture));
    this.texturePool = [];
    this.usedTextures.forEach((texture) => gl.deleteTexture(texture));
    this.usedTextures.clear();
    this.assetToTextureMap.clear();
    this.videoFrameCache.clear();
  }
};

// src/webgl/shaders/ShaderLibrary.ts
var PASSTHROUGH_VERTEX_SHADER = `#version 300 es
precision highp float;

// Input attributes
in vec2 a_position;
in vec2 a_texCoord;

// Output varyings to fragment shader
out vec2 v_texCoord;

void main() {
    // Pass through position (clip space coordinates)
    gl_Position = vec4(a_position, 0.0, 1.0);
    
    // Pass through texture coordinates
    // Note: Y-axis is flipped to handle WebGL's inverted texture coordinates
    v_texCoord = a_texCoord;
}
`;
var VIGNETTE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

// Input from vertex shader
in vec2 v_texCoord;

// Uniforms
uniform sampler2D u_sourceTexture;
uniform float u_intensity; // Vignette intensity (0.0 to 1.0)
uniform float u_radius;    // Vignette radius (0.0 to 2.0)

// Output color
out vec4 fragColor;

void main() {
    // Sample the source texture
    vec4 color = texture(u_sourceTexture, v_texCoord);
    
    // Calculate distance from center (0.5, 0.5)
    vec2 center = vec2(0.5);
    float dist = distance(v_texCoord, center);
    
    // Create vignette effect
    float vignette = 1.0 - smoothstep(u_radius, u_radius + 0.5, dist);
    vignette = mix(vignette, 1.0, 1.0 - u_intensity);
    
    // Apply vignette to color
    fragColor = vec4(color.rgb * vignette, color.a);
}
`;
var SATURATION_FRAGMENT_SHADER = `#version 300 es
precision highp float;

// Input from vertex shader
in vec2 v_texCoord;

// Uniforms
uniform sampler2D u_sourceTexture;
uniform float u_saturation; // Saturation level (0.0 = grayscale, 1.0 = normal, >1.0 = oversaturated)

// Output color
out vec4 fragColor;

void main() {
    // Sample the source texture
    vec4 color = texture(u_sourceTexture, v_texCoord);
    
    // Calculate grayscale using standard luminance weights
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    
    // Mix between grayscale and original color based on saturation
    vec3 finalColor = mix(vec3(gray), color.rgb, u_saturation);
    
    // Output the final color with original alpha
    fragColor = vec4(finalColor, color.a);
}
`;
var LUT_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp sampler2D;
precision highp sampler3D;

// Input from vertex shader
in vec2 v_texCoord;

// Uniforms
uniform sampler2D u_sourceTexture;
uniform sampler3D u_lutTexture; // 3D LUT texture
uniform float u_intensity;       // LUT intensity (0.0 to 1.0)

// Output color
out vec4 fragColor;

void main() {
    // Sample the source texture
    vec4 color = texture(u_sourceTexture, v_texCoord);
    
    // Sample LUT using color as coordinates
    vec3 lutColor = texture(u_lutTexture, color.rgb).rgb;
    
    // Mix original color with LUT color
    vec3 finalColor = mix(color.rgb, lutColor, u_intensity);
    
    // Output the final color with original alpha
    fragColor = vec4(finalColor, color.a);
}
`;
var PASSTHROUGH_FRAGMENT_SHADER = `#version 300 es
precision highp float;

// Input from vertex shader
in vec2 v_texCoord;

// Uniforms
uniform sampler2D u_sourceTexture;
uniform float u_opacity; // Optional opacity control
uniform vec2 u_resolution; // Optional resolution for effects

// Output color
out vec4 fragColor;

void main() {
    // Sample the source texture
    vec4 color = texture(u_sourceTexture, v_texCoord);
    
    // Apply opacity if provided
    color.a *= u_opacity;
    
    // Output the final color
    fragColor = color;
}
`;
var GRAYSCALE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

// Input from vertex shader
in vec2 v_texCoord;

// Uniforms
uniform sampler2D u_sourceTexture;
uniform float u_strength; // 0.0 = original, 1.0 = full grayscale

// Output color
out vec4 fragColor;

void main() {
    // Sample the source texture
    vec4 color = texture(u_sourceTexture, v_texCoord);
    
    // Calculate grayscale using standard luminance weights
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    
    // Mix between original color and grayscale
    vec3 finalColor = mix(color.rgb, vec3(gray), u_strength);
    
    // Output the final color with original alpha
    fragColor = vec4(finalColor, color.a);
}
`;
var BLUR_FRAGMENT_SHADER = `#version 300 es
precision highp float;

// Input from vertex shader
in vec2 v_texCoord;

// Uniforms
uniform sampler2D u_sourceTexture;
uniform float u_radius; // Blur radius in pixels
uniform vec2 u_resolution; // Texture resolution for pixel-perfect blur
uniform int u_direction; // 0 = horizontal, 1 = vertical, 2 = both (separable blur)

// Output color
out vec4 fragColor;

void main() {
    vec2 texelSize = 1.0 / u_resolution;
    vec4 color = vec4(0.0);
    
    if (u_direction == 0 || u_direction == 2) {
        // Horizontal blur
        for (int x = -5; x <= 5; x++) {
            float weight = exp(-0.5 * pow(float(x) / max(u_radius, 0.1), 2.0));
            vec2 offset = vec2(float(x) * texelSize.x, 0.0);
            color += texture(u_sourceTexture, v_texCoord + offset) * weight;
        }
    } else if (u_direction == 1) {
        // Vertical blur
        for (int y = -5; y <= 5; y++) {
            float weight = exp(-0.5 * pow(float(y) / max(u_radius, 0.1), 2.0));
            vec2 offset = vec2(0.0, float(y) * texelSize.y);
            color += texture(u_sourceTexture, v_texCoord + offset) * weight;
        }
    }
    
    // Normalize weights
    float totalWeight = 0.0;
    for (int i = -5; i <= 5; i++) {
        totalWeight += exp(-0.5 * pow(float(i) / max(u_radius, 0.1), 2.0));
    }
    
    fragColor = color / totalWeight;
}
`;
var BRIGHTNESS_FRAGMENT_SHADER = `#version 300 es
precision highp float;

// Input from vertex shader
in vec2 v_texCoord;

// Uniforms
uniform sampler2D u_sourceTexture;
uniform float u_brightness; // -1.0 to 1.0
uniform float u_contrast;   // 0.0 to 2.0

// Output color
out vec4 fragColor;

void main() {
    // Sample the source texture
    vec4 color = texture(u_sourceTexture, v_texCoord);
    
    // Apply brightness
    vec3 rgb = color.rgb + u_brightness;
    
    // Apply contrast
    rgb = (rgb - vec3(0.5)) * u_contrast + vec3(0.5);
    
    // Clamp values to valid range
    rgb = clamp(rgb, 0.0, 1.0);
    
    // Output the final color
    fragColor = vec4(rgb, color.a);
}
`;
var TINT_FRAGMENT_SHADER = `#version 300 es
precision highp float;

// Input from vertex shader
in vec2 v_texCoord;

// Uniforms
uniform sampler2D u_sourceTexture;
uniform vec3 u_tintColor; // RGB tint color
uniform float u_tintStrength; // 0.0 = no tint, 1.0 = full tint

// Output color
out vec4 fragColor;

void main() {
    // Sample the source texture
    vec4 color = texture(u_sourceTexture, v_texCoord);
    
    // Apply tint by mixing with the tint color
    vec3 finalColor = mix(color.rgb, color.rgb * u_tintColor, u_tintStrength);
    
    // Output the final color
    fragColor = vec4(finalColor, color.a);
}
`;
var CHROMA_KEY_FRAGMENT_SHADER = `#version 300 es
precision highp float;

// Input from vertex shader
in vec2 v_texCoord;

// Uniforms
uniform sampler2D u_sourceTexture;
uniform vec3 u_keyColor;     // Color to make transparent
uniform float u_threshold;   // Color similarity threshold (0.0 - 1.0)
uniform float u_softness;    // Edge softness (0.0 = hard edge, 1.0 = soft edge)
uniform float u_spillReduction; // How much to reduce color spill (0.0 - 1.0)

// Output color
out vec4 fragColor;

void main() {
    // Sample the source texture
    vec4 color = texture(u_sourceTexture, v_texCoord);
    
    // Calculate color difference from key color
    vec3 colorDiff = abs(color.rgb - u_keyColor);
    float maxDiff = max(max(colorDiff.r, colorDiff.g), colorDiff.b);
    
    // Create alpha based on color similarity
    float alpha = smoothstep(u_threshold - u_softness, u_threshold + u_softness, maxDiff);
    
    // Reduce color spill by desaturating areas near the key color
    float spillAmount = 1.0 - smoothstep(u_threshold, u_threshold + u_softness, maxDiff);
    vec3 desaturatedColor = vec3(dot(color.rgb, vec3(0.299, 0.587, 0.114)));
    vec3 finalColor = mix(color.rgb, desaturatedColor, spillAmount * u_spillReduction);
    
    // Output the final color with calculated alpha
    fragColor = vec4(finalColor, alpha * color.a);
}
`;

// src/webgl/ShaderManager.ts
var ShaderManager = class {
  renderer;
  loadedShaders = /* @__PURE__ */ new Set();
  constructor(renderer) {
    this.renderer = renderer;
    this.initializeDefaultShaders();
  }
  initializeDefaultShaders() {
    this.loadShader("passthrough", PASSTHROUGH_VERTEX_SHADER, PASSTHROUGH_FRAGMENT_SHADER);
    this.loadShader("grayscale", PASSTHROUGH_VERTEX_SHADER, GRAYSCALE_FRAGMENT_SHADER);
    this.loadShader("blur", PASSTHROUGH_VERTEX_SHADER, BLUR_FRAGMENT_SHADER);
    this.loadShader("brightness", PASSTHROUGH_VERTEX_SHADER, BRIGHTNESS_FRAGMENT_SHADER);
    this.loadShader("tint", PASSTHROUGH_VERTEX_SHADER, TINT_FRAGMENT_SHADER);
    this.loadShader("chromakey", PASSTHROUGH_VERTEX_SHADER, CHROMA_KEY_FRAGMENT_SHADER);
    this.loadShader("vignette", PASSTHROUGH_VERTEX_SHADER, VIGNETTE_FRAGMENT_SHADER);
    this.loadShader("saturation", PASSTHROUGH_VERTEX_SHADER, SATURATION_FRAGMENT_SHADER);
    this.loadShader("lut", PASSTHROUGH_VERTEX_SHADER, LUT_FRAGMENT_SHADER);
  }
  loadShader(id, vertexShader, fragmentShader) {
    try {
      this.renderer.createShaderProgram(id, vertexShader, fragmentShader);
      this.loadedShaders.add(id);
    } catch (error) {
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
  createGrayscaleEffect(strength = 1) {
    return {
      id: `grayscale_${Date.now()}`,
      shaderId: "grayscale",
      uniforms: {
        u_strength: strength
      },
      enabled: true
    };
  }
  createBlurEffect(radius, resolution, direction = "both") {
    const directionMap = { horizontal: 0, vertical: 1, both: 2 };
    return {
      id: `blur_${Date.now()}`,
      shaderId: "blur",
      uniforms: {
        u_radius: radius,
        u_resolution: [resolution.width, resolution.height],
        u_direction: directionMap[direction]
      },
      enabled: true
    };
  }
  createBrightnessEffect(brightness, contrast = 1) {
    return {
      id: `brightness_${Date.now()}`,
      shaderId: "brightness",
      uniforms: {
        u_brightness: brightness,
        u_contrast: contrast
      },
      enabled: true
    };
  }
  createTintEffect(color, strength = 1) {
    return {
      id: `tint_${Date.now()}`,
      shaderId: "tint",
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
      shaderId: "chromakey",
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
      this.createTintEffect({ r: 1, g: 0.9, b: 0.7 }, 0.3),
      this.createBlurEffect(0.5, { width: 1920, height: 1080 }, "both")
    ];
  }
  createCinematicEffect() {
    return [
      this.createBrightnessEffect(-0.05, 1.2),
      this.createTintEffect({ r: 0.9, g: 0.95, b: 1 }, 0.2)
    ];
  }
  createBlackAndWhiteEffect() {
    return [
      this.createGrayscaleEffect(1),
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
      shaderId: "vignette",
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
      shaderId: "saturation",
      uniforms: {
        u_saturation: saturation
      },
      enabled: true
    };
  }
  createLUTEffect(lutTexture, intensity = 1) {
    return {
      id: `lut_${Date.now()}`,
      shaderId: "lut",
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
};

// src/webgl/WebCodecsVideoSource.ts
var WebCodecsVideoSource = class {
  videoSources = /* @__PURE__ */ new Map();
  // Event handlers
  onFrameDecoded = null;
  onSeekComplete = null;
  onError = null;
  constructor() {
    if (typeof MP4Box !== "undefined") {
      MP4Box.setLogLevel(0);
    }
  }
  async loadVideo(sourceId, videoUrl, config = {}) {
    const defaultConfig = {
      codec: "avc1.64001F",
      // H.264 High Profile Level 4.0
      width: 1920,
      height: 1080,
      bitrate: 1e7,
      // 10 Mbps
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
      decodedFrames: /* @__PURE__ */ new Map(),
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
      const response = await fetch(sourceData.url);
      const arrayBuffer = await response.arrayBuffer();
      if (typeof MP4Box === "undefined") {
        throw new Error("MP4Box library not loaded. Please include mp4box.js");
      }
      sourceData.mp4BoxFile = MP4Box.createFile();
      this.setupMP4BoxHandlers(sourceId);
    arrayBuffer.fileStart = 0;
    sourceData.mp4BoxFile.appendBuffer(arrayBuffer);
    sourceData.mp4BoxFile.flush();
    await sourceData.readyPromise;
      this.initializeDecoder(sourceId);
      await this.extractKeyframeInfo(sourceId);
      sourceData.isInitialized = true;
    } catch (error) {
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
        } catch (error) {
          console.warn(`MP4Box extraction config failed for ${sourceId}:`, error);
        }
      }
      sourceData.totalFrames = Math.floor(sourceData.duration * sourceData.frameRate);
      sourceData.resolveReady?.();
    };
    sourceData.mp4BoxFile.onSamples = (trackId, user, samples) => {
      samples.forEach((sample) => {
        const chunk = new EncodedVideoChunk({
          type: sample.is_sync ? "key" : "delta",
          timestamp: sample.cts * 1e6 / sourceData.timescale,
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
      return void 0;
    const stream = new DataStreamCtor(void 0, 0, DataStreamCtor.BIG_ENDIAN);
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
    framesToRemove.forEach((index) => {
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
      try {
        await this.seekToFrame(sourceId, frameNumber);
        frame = sourceData.decodedFrames.get(frameNumber);
      } catch (error) {
        console.error(`Failed to seek to frame ${frameNumber} for source ${sourceId}:`, error);
        return null;
      }
    }
    if (!frame)
      return null;
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
    return sourceData?.isInitialized && sourceData.videoDecoder?.state === "configured" || false;
  }
  on(event, callback) {
    switch (event) {
      case "frameDecoded":
        this.onFrameDecoded = callback;
        break;
      case "seekComplete":
        this.onSeekComplete = callback;
        break;
      case "error":
        this.onError = callback;
        break;
    }
  }
  off(event) {
    switch (event) {
      case "frameDecoded":
        this.onFrameDecoded = null;
        break;
      case "seekComplete":
        this.onSeekComplete = null;
        break;
      case "error":
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
    sourceData.decodedFrames.forEach((frame) => frame.close());
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
};
var GOPManagerImpl = class {
  keyframes = [];
  currentFrame = null;
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
    const nextKeyframeIndex = this.keyframes.findIndex((kf) => kf === currentKeyframe) + 1;
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
};

// src/webgl/EffectStack.ts
var EffectStack = class {
  effects = [];
  enabled = true;
  addEffect(effect) {
    this.effects.push(effect);
  }
  removeEffect(effectId) {
    const index = this.effects.findIndex((effect) => effect.id === effectId);
    if (index !== -1) {
      this.effects.splice(index, 1);
      return true;
    }
    return false;
  }
  getEffect(effectId) {
    return this.effects.find((effect) => effect.id === effectId);
  }
  updateEffect(effectId, uniforms) {
    const effect = this.getEffect(effectId);
    if (effect) {
      Object.assign(effect.uniforms, uniforms);
      return true;
    }
    return false;
  }
  toggleEffect(effectId) {
    const effect = this.getEffect(effectId);
    if (effect) {
      effect.enabled = !effect.enabled;
      return true;
    }
    return false;
  }
  setEffectEnabled(effectId, enabled) {
    const effect = this.getEffect(effectId);
    if (effect) {
      effect.enabled = enabled;
      return true;
    }
    return false;
  }
  getActiveEffects() {
    if (!this.enabled)
      return [];
    return this.effects.filter((effect) => effect.enabled);
  }
  getAllEffects() {
    return [...this.effects];
  }
  clearEffects() {
    this.effects = [];
  }
  setEnabled(enabled) {
    this.enabled = enabled;
  }
  isEnabled() {
    return this.enabled;
  }
  // Reorder effects (change rendering order)
  moveEffect(effectId, newIndex) {
    const index = this.effects.findIndex((effect2) => effect2.id === effectId);
    if (index === -1)
      return false;
    if (newIndex < 0 || newIndex >= this.effects.length)
      return false;
    const [effect] = this.effects.splice(index, 1);
    this.effects.splice(newIndex, 0, effect);
    return true;
  }
  // Duplicate an effect
  duplicateEffect(effectId) {
    const effect = this.getEffect(effectId);
    if (!effect)
      return null;
    const duplicatedEffect = {
      ...effect,
      id: `${effect.id}_copy_${Date.now()}`,
      uniforms: { ...effect.uniforms }
    };
    this.addEffect(duplicatedEffect);
    return duplicatedEffect.id;
  }
  // Get effect chain as array (for rendering)
  getEffectChain() {
    return this.getActiveEffects();
  }
};
var ClipEffectStack = class extends EffectStack {
  clipId;
  constructor(clipId) {
    super();
    this.clipId = clipId;
  }
  getClipId() {
    return this.clipId;
  }
};

// src/TiramisuEditor.ts
var TiramisuEditor = class {
  canvas;
  config;
  // WebGL Components
  renderer;
  textureManager;
  shaderManager;
  webCodecsSource;
  // Virtual Track System
  tracks = /* @__PURE__ */ new Map();
  adjustmentLayers = /* @__PURE__ */ new Map();
  // Transitions
  transitions = /* @__PURE__ */ new Map();
  // State
  currentFrame = 0;
  isPlaying = false;
  animationFrameId = null;
  constructor(options) {
    if (typeof options.canvas === "string") {
      this.canvas = document.getElementById(options.canvas);
    } else {
      this.canvas = options.canvas;
    }
    if (!this.canvas) {
      throw new Error("TiramisuEditor: Canvas element not found");
    }
    this.config = {
      width: 1920,
      height: 1080,
      fps: 30,
      durationSeconds: 10,
      webgl: true,
      webcodecs: true,
      ...options
    };
    this.renderer = new TiramisuRenderer(this.canvas, this.config);
    this.textureManager = new TextureManager(this.renderer["gl"], 32);
    this.shaderManager = new ShaderManager(this.renderer);
    this.webCodecsSource = new WebCodecsVideoSource();
    this.createTrack(1, "Main Track");
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
      track.clips.sort((a, b) => a.startFrame - b.startFrame);
    } else {
      throw new Error(`Track ${options.track} not found`);
    }
    this.webCodecsSource.loadVideo(clip.id, source).catch((error) => {
      console.error(`Failed to load video source for clip ${clip.id}:`, error);
    });
    return clip;
  }
  getClip(clipId) {
    for (const track of this.tracks.values()) {
      const clip = track.clips.find((c) => c.id === clipId);
      if (clip)
        return clip;
    }
    return void 0;
  }
  // Effect Management (simplified API for users)
  addEffectToClip(clipId, effectType, uniforms) {
    const clip = this.getClip(clipId);
    if (!clip)
      throw new Error(`Clip ${clipId} not found`);
    let effect;
    switch (effectType) {
      case "BrightnessContrast":
        effect = this.shaderManager.createBrightnessEffect(
          uniforms.brightness || 0,
          uniforms.contrast || 1
        );
        break;
      case "Vignette":
        effect = this.shaderManager.createCustomEffect("vignette", uniforms);
        break;
      case "ChromaKey":
        effect = this.shaderManager.createChromaKeyEffect(
          uniforms.color ? this.hexToRgb(uniforms.color) : { r: 0, g: 1, b: 0 },
          uniforms.similarity || 0.3,
          uniforms.softness || 0.1,
          uniforms.spillReduction || 0.5
        );
        break;
      default:
        effect = this.shaderManager.createCustomEffect(effectType, uniforms);
    }
    clip.effects.addEffect(effect);
  }
  // Transition Management
  addTransition(fromClip, toClip, type, options = { duration: 1 }) {
    const transition = {
      id: crypto.randomUUID(),
      fromClipId: fromClip.id,
      toClipId: toClip.id,
      type,
      duration: Math.floor(options.duration * this.config.fps),
      uniforms: { ...options }
    };
    delete transition.uniforms.duration;
    this.transitions.set(transition.id, transition);
  }
  // Rendering
  async renderFrame(frame) {
    const gl = this.renderer["gl"];
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const visibleTracks = this.getVisibleTracks();
    for (const track of visibleTracks) {
      await this.renderTrack(track, frame);
    }
    await this.renderAdjustmentLayers(frame);
  }
  getVisibleTracks() {
    const soloedTracks = Array.from(this.tracks.values()).filter((t) => t.solo);
    if (soloedTracks.length > 0) {
      return soloedTracks;
    }
    return Array.from(this.tracks.values()).filter((t) => !t.muted);
  }
  async renderTrack(track, frame) {
    for (const clip of track.clips) {
      if (frame >= clip.startFrame && frame < clip.endFrame) {
        await this.renderClip(clip, frame);
      }
    }
  }
  async renderClip(clip, frame) {
    const frameTexture = await this.webCodecsSource.getFrameTexture(
      clip.id,
      frame,
      this.textureManager
    );
    if (!frameTexture)
      return;
    const effects = clip.effects.getActiveEffects();
    const processedTexture = effects.length > 0 ? this.renderer.renderToTexture(frameTexture, effects) : frameTexture;
    if (clip.transform) {
    }
    this.renderer.renderToCanvas(processedTexture);
  }
  async renderAdjustmentLayers(frame) {
  }
  // Playback Controls
  play() {
    if (this.isPlaying)
      return;
    this.isPlaying = true;
    this.startTime = performance.now() / 1e3 - this.currentFrame / this.config.fps;
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
  startTime = 0;
  loop() {
    if (!this.isPlaying)
      return;
    const currentTime = performance.now() / 1e3 - this.startTime;
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
      codec: "avc1.42001f",
      // H.264 baseline profile
      width: this.config.width,
      height: this.config.height,
      bitrate: 5e6,
      // 5 Mbps
      framerate: this.config.fps
    };
    throw new Error("WebCodecs export not yet implemented");
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
};

// examples/webgl-editor/app.ts
var WebGLEditorApp = class {
  editor;
  video1 = null;
  video2 = null;
  currentClip1 = null;
  currentClip2 = null;
  isPlaying = false;
  constructor() {
    this.editor = new TiramisuEditor({
      canvas: "gl-canvas",
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
  async loadSampleVideos() {
    const sampleVideos = [
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4"
    ];
    try {
      const response = await fetch(sampleVideos[0], { method: "HEAD" });
      if (response.ok) {
        this.updateVideoStatus("video1-status", "Sample video ready (click to use custom video)");
        const loadSampleBtn = document.createElement("button");
        loadSampleBtn.textContent = "Load Sample Video";
        loadSampleBtn.style.marginTop = "5px";
        loadSampleBtn.onclick = () => this.loadSampleVideo(sampleVideos[0], 1);
        const video1Status = document.getElementById("video1-status");
        if (video1Status) {
          video1Status.appendChild(loadSampleBtn);
        }
      }
    } catch (error) {
      console.log("Sample videos not available, please upload your own videos");
    }
  }
  async loadSampleVideo(url, videoNumber) {
    try {
      const videoFile = {
        file: new File([], "sample.mp4"),
        url,
        objectUrl: url
      };
      if (videoNumber === 1) {
        this.video1 = videoFile;
        this.updateVideoStatus("video1-status", "Sample video loaded");
        await this.addVideoToTimeline(this.video1, 0, 5);
      } else {
        this.video2 = videoFile;
        this.updateVideoStatus("video2-status", "Sample video loaded");
        await this.addVideoToTimeline(this.video2, 4, 6);
      }
    } catch (error) {
      console.error("Failed to load sample video:", error);
      this.updateVideoStatus(`video${videoNumber}-status`, "Failed to load sample video");
    }
  }
  initializeUI() {
    this.updatePlaybackControls();
    this.updateSliderValues();
  }
  setupEventListeners() {
    document.getElementById("video1-input")?.addEventListener("change", (e) => {
      this.handleVideoUpload(e, 1);
    });
    document.getElementById("video2-input")?.addEventListener("change", (e) => {
      this.handleVideoUpload(e, 2);
    });
    document.getElementById("play-btn")?.addEventListener("click", () => {
      this.play();
    });
    document.getElementById("pause-btn")?.addEventListener("click", () => {
      this.pause();
    });
    document.getElementById("seek-bar")?.addEventListener("input", (e) => {
      this.seek(e.target.value);
    });
    ["brightness", "contrast", "saturation"].forEach((id) => {
      document.getElementById(id)?.addEventListener("input", (e) => {
        this.handleAdjustmentChange(id, e.target.value);
      });
    });
    document.getElementById("add-grayscale")?.addEventListener("click", () => {
      this.addGrayscaleEffect();
    });
    document.getElementById("add-blur")?.addEventListener("click", () => {
      this.addBlurEffect();
    });
    document.getElementById("clear-effects")?.addEventListener("click", () => {
      this.clearAllEffects();
    });
    document.getElementById("transition-select")?.addEventListener("change", (e) => {
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
    try {
      if (videoNumber === 1) {
        if (this.video1) {
          URL.revokeObjectURL(this.video1.objectUrl);
        }
        this.video1 = videoFile;
        this.updateVideoStatus("video1-status", `${file.name} (${this.formatFileSize(file.size)})`);
        await this.addVideoToTimeline(this.video1, 0, 5);
      } else {
        if (this.video2) {
          URL.revokeObjectURL(this.video2.objectUrl);
        }
        this.video2 = videoFile;
        this.updateVideoStatus("video2-status", `${file.name} (${this.formatFileSize(file.size)})`);
        await this.addVideoToTimeline(this.video2, 4, 6);
      }
    } catch (error) {
      console.error("Failed to load video:", error);
      this.updateVideoStatus(`video${videoNumber}-status`, `Error: ${error instanceof Error ? error.message : "Unknown error"}`);
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
      } else {
        this.currentClip2 = clip;
      }
      this.applyCurrentAdjustments(clip);
    } catch (error) {
      console.error("Failed to add video to timeline:", error);
      this.updateVideoStatus("video1-status", `Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
  handleAdjustmentChange(type, value) {
    const numValue = parseFloat(value);
    const valueElement = document.getElementById(`${type}-value`);
    if (valueElement) {
      valueElement.textContent = numValue.toFixed(2);
    }
    if (this.currentClip1) {
      this.applyAdjustment(this.currentClip1, type, numValue);
    }
    if (this.currentClip2) {
      this.applyAdjustment(this.currentClip2, type, numValue);
    }
  }
  applyAdjustment(clip, type, value) {
    const clipData = this.editor.getClip(clip.id);
    if (!clipData)
      return;
    clipData.effects.clearEffects();
    if (type === "brightness" && value !== 0) {
      this.editor.addEffectToClip(clip.id, "BrightnessContrast", { brightness: value, contrast: 1 });
    } else if (type === "contrast" && value !== 1) {
      this.editor.addEffectToClip(clip.id, "BrightnessContrast", { brightness: 0, contrast: value });
    } else if (type === "saturation" && value !== 1) {
      this.editor.addEffectToClip(clip.id, "Saturation", { saturation: value });
    }
  }
  applyCurrentAdjustments(clip) {
    const brightness = parseFloat(document.getElementById("brightness").value);
    const contrast = parseFloat(document.getElementById("contrast").value);
    const saturation = parseFloat(document.getElementById("saturation").value);
    const clipData = this.editor.getClip(clip.id);
    if (!clipData)
      return;
    clipData.effects.clearEffects();
    if (brightness !== 0) {
      this.editor.addEffectToClip(clip.id, "BrightnessContrast", { brightness, contrast: 1 });
    }
    if (contrast !== 1) {
      this.editor.addEffectToClip(clip.id, "BrightnessContrast", { brightness: 0, contrast });
    }
    if (saturation !== 1) {
      this.editor.addEffectToClip(clip.id, "Saturation", { saturation });
    }
  }
  addGrayscaleEffect() {
    if (this.currentClip1) {
      this.editor.addEffectToClip(this.currentClip1.id, "Grayscale", { strength: 1 });
    }
    if (this.currentClip2) {
      this.editor.addEffectToClip(this.currentClip2.id, "Grayscale", { strength: 1 });
    }
  }
  addBlurEffect() {
    if (this.currentClip1) {
      this.editor.addEffectToClip(this.currentClip1.id, "Blur", { radius: 5 });
    }
    if (this.currentClip2) {
      this.editor.addEffectToClip(this.currentClip2.id, "Blur", { radius: 5 });
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
    if (this.currentClip1 && this.currentClip2 && transitionType !== "none") {
      this.editor.addTransition(this.currentClip1, this.currentClip2, transitionType, {
        duration: 1,
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
    const duration = 10;
    const time = parseFloat(percentage) / 100 * duration;
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
    const duration = 10;
    const currentTime = this.isPlaying ? 0 : 0;
    const percentage = 0;
    const seekBar = document.getElementById("seek-bar");
    const timeDisplay = document.getElementById("time-display");
    if (seekBar) {
      seekBar.value = percentage.toString();
    }
    if (timeDisplay) {
      timeDisplay.textContent = `${this.formatTime(currentTime)} / ${this.formatTime(duration)}`;
    }
  }
  updatePlaybackControls() {
    const playBtn = document.getElementById("play-btn");
    const pauseBtn = document.getElementById("pause-btn");
    if (playBtn && pauseBtn) {
      playBtn.disabled = this.isPlaying;
      pauseBtn.disabled = !this.isPlaying;
    }
  }
  updateSliderValues() {
    ["brightness", "contrast", "saturation"].forEach((id) => {
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
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }
  formatFileSize(bytes) {
    if (bytes === 0)
      return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
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
};
document.addEventListener("DOMContentLoaded", () => {
  const app = new WebGLEditorApp();
  window.webglEditorApp = app;
});
export {
  WebGLEditorApp
};
//# sourceMappingURL=app.js.map
