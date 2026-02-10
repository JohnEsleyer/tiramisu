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

export const HUE_ROTATION_FRAGMENT_SHADER = `#version 300 es
precision highp float;

// Input from vertex shader
in vec2 v_texCoord;

// Uniforms
uniform sampler2D u_sourceTexture;
uniform float u_hue; // Hue rotation in degrees (0 to 360)

// Output color
out vec4 fragColor;

// Helper function to convert RGB to HSL
vec3 rgb2hsl(vec3 c) {
    float maxc = max(max(c.r, c.g), c.b);
    float minc = min(min(c.r, c.g), c.b);
    float l = (maxc + minc) / 2.0;
    
    if (maxc == minc) {
        return vec3(0.0, 0.0, l);
    }
    
    float h = 0.0;
    float s = 0.0;
    float d = maxc - minc;
    
    if (l > 0.5) {
        s = d / (2.0 - maxc - minc);
    } else {
        s = d / (maxc + minc);
    }
    
    if (maxc == c.r) {
        h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
    } else if (maxc == c.g) {
        h = (c.b - c.r) / d + 2.0;
    } else {
        h = (c.r - c.g) / d + 4.0;
    }
    
    h /= 6.0;
    
    return vec3(h, s, l);
}

// Helper function to convert HSL to RGB
vec3 hsl2rgb(vec3 c) {
    float h = c.x;
    float s = c.y;
    float l = c.z;
    
    float a = s * min(l, 1.0 - l);
    float f = 6.28318 * (h + 0.0);
    
    float r = l + a * cos(f);
    float g = l + a * cos(f + 2.09439);
    float b = l + a * cos(f + 4.18879);
    
    return clamp(vec3(r, g, b), 0.0, 1.0);
}

void main() {
    // Sample the source texture
    vec4 color = texture(u_sourceTexture, v_texCoord);
    
    // Convert to HSL
    vec3 hsl = rgb2hsl(color.rgb);
    
    // Add hue rotation (convert degrees to normalized value)
    hsl.x = fract(hsl.x + u_hue / 360.0);
    
    // Convert back to RGB
    vec3 finalColor = hsl2rgb(hsl);
    
    // Output the final color with original alpha
    fragColor = vec4(finalColor, color.a);
}
`;

export const COLOR_BALANCE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

// Input from vertex shader
in vec2 v_texCoord;

// Uniforms
uniform sampler2D u_sourceTexture;
uniform vec3 u_shadows;   // Color balance for shadows (lift)
uniform vec3 u_midtones;  // Color balance for midtones (gamma)
uniform vec3 u_highlights; // Color balance for highlights (gain)

// Output color
out vec4 fragColor;

void main() {
    // Sample the source texture
    vec4 color = texture(u_sourceTexture, v_texCoord);
    
    // Calculate luminance for weighting
    float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    
    // Create weights for shadows, midtones, and highlights
    float shadowWeight = 1.0 - smoothstep(0.0, 0.5, luminance);
    float highlightWeight = smoothstep(0.5, 1.0, luminance);
    float midtoneWeight = 1.0 - shadowWeight - highlightWeight;
    
    // Apply color balance
    vec3 balancedColor = color.rgb;
    balancedColor *= mix(vec3(1.0), u_shadows, shadowWeight);
    balancedColor = pow(balancedColor, mix(vec3(1.0), u_midtones, midtoneWeight));
    balancedColor *= mix(vec3(1.0), u_highlights, highlightWeight);
    
    // Output the final color with original alpha
    fragColor = vec4(balancedColor, color.a);
}
`;

export const FILM_GRAIN_FRAGMENT_SHADER = `#version 300 es
precision highp float;

// Input from vertex shader
in vec2 v_texCoord;

// Uniforms
uniform sampler2D u_sourceTexture;
uniform float u_strength;   // Grain strength (0.0 to 1.0)
uniform float u_scale;      // Grain scale (1.0 to 100.0)
uniform float u_time;       // Animated time value

// Output color
out vec4 fragColor;

// Random function
float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

// Noise function
float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    
    vec2 u = f * f * (3.0 - 2.0 * f);
    
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

void main() {
    // Sample the source texture
    vec4 color = texture(u_sourceTexture, v_texCoord);
    
    // Generate animated grain
    vec2 grainUV = v_texCoord * u_scale + u_time * 0.1;
    float grain = noise(grainUV);
    grain = grain * 2.0 - 1.0; // Convert to -1 to 1 range
    
    // Apply grain
    vec3 finalColor = color.rgb + grain * u_strength * 0.1;
    finalColor = clamp(finalColor, 0.0, 1.0);
    
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
