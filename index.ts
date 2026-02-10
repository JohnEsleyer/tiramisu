// New WebGL-based Video Editor API (Phase 2)
export { TiramisuEditor } from './src/TiramisuEditor.js';

// WebGL Core Components
export {
    TiramisuRenderer,
    TextureManager,
    WebCodecsVideoSource,
    ShaderManager,
    PASSTHROUGH_VERTEX_SHADER,
    PASSTHROUGH_FRAGMENT_SHADER,
    GRAYSCALE_FRAGMENT_SHADER,
    BLUR_FRAGMENT_SHADER,
    BRIGHTNESS_FRAGMENT_SHADER,
    TINT_FRAGMENT_SHADER,
    CHROMA_KEY_FRAGMENT_SHADER,
    VIGNETTE_FRAGMENT_SHADER,
    SATURATION_FRAGMENT_SHADER,
    LUT_FRAGMENT_SHADER
} from './src/webgl/index.js';

// Additional WebGL Components
export { EffectStack, ClipEffectStack, AdjustmentLayerStack } from './src/webgl/EffectStack.js';
export { GLTransitionManager, GL_TRANSITIONS } from './src/webgl/transitions/GLTransitionManager.js';
export { LUTLoader } from './src/webgl/LUTLoader.js';

// Legacy compatibility
export { TiramisuWebGLPlayer } from './src/ClientWebGL.js';

// Types
export type {
    RenderConfig,
    WebGLRenderContext,
    WebGLLayer,
    ShaderProgram,
    VideoFrameInfo,
    TexturePool,
    GOPManager,
    WebCodecsConfig,
    ShaderUniform,
    Effect,
    WebGLDrawFunction
} from './src/types.js';

// Legacy compatibility (for existing Tiramisu users)
export { TiramisuPlayer } from './src/Client.js';
export * from './src/types.js';
export * from './src/Utils.js';

// Default export for backward compatibility
export { Tiramisu } from './src/Tiramisu.js';