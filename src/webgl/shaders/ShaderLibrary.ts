export const PASSTHROUGH_VERTEX_SHADER = `#version 300 es
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

export const VIGNETTE_FRAGMENT_SHADER = `#version 300 es
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

export const SATURATION_FRAGMENT_SHADER = `#version 300 es
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

export const LUT_FRAGMENT_SHADER = `#version 300 es
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

export const PASSTHROUGH_FRAGMENT_SHADER = `#version 300 es
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

export const GRAYSCALE_FRAGMENT_SHADER = `#version 300 es
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

export const BLUR_FRAGMENT_SHADER = `#version 300 es
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

export const BRIGHTNESS_FRAGMENT_SHADER = `#version 300 es
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

export const TINT_FRAGMENT_SHADER = `#version 300 es
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

export const CHROMA_KEY_FRAGMENT_SHADER = `#version 300 es
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
