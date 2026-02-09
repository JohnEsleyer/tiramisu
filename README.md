
# 🍰 Tiramisu 2.0 - WebGL-Powered Video Editor Library

🍰 **Phase 1 Complete: WebGL Core & WebCodecs Integration**

Tiramisu has been completely rebuilt from a Canvas 2D engine to a WebGL-powered video editing library with WebCodecs integration for high-performance video processing.

## 🔗 Repository
[github.com/JohnEsleyer/tiramisu](https://github.com/JohnEsleyer/tiramisu)

## 🚀 What's New in 2.0

### WebGL Rendering Core
- **WebGL2 Texture Pipeline**: Replace CPU-based Canvas 2D with GPU-accelerated rendering
- **Ping-Pong Rendering**: Multi-pass effects with framebuffers for complex shader chains
- **High-Performance**: Native video frame uploads to GPU textures via `WebCodecs API`

### WebCodecs Integration
- **VideoDecoder API**: Hardware-accelerated video decoding
- **GOP Manager**: Instant seeking with keyframe-based navigation
- **Memory Efficient**: Automatic `VideoFrame` cleanup and texture pooling

### Real-time Effects
- **Fragment Shaders**: GPU-accelerated effects (grayscale, blur, brightness, tint, chromakey)
- **Effect Chains**: Stack multiple effects with zero CPU overhead
- **Custom Shaders**: Upload your own GLSL shaders for unique effects

## 🏗️ Architecture

```
Old Way (Tiramisu 1.x):
Video Element → Canvas 2D → CPU → Screen

New Way (Tiramisu 2.x):
MP4 → MP4Box.js → VideoDecoder → VideoFrame → GPU Texture → Fragment Shader → Screen
```

## 📦 Installation

```bash
npm install tiramisu
```

## 🎯 Quick Start - Hello Video

```typescript
import { TiramisuWebGLPlayer } from 'tiramisu/webgl';

// Create WebGL player
const player = new TiramisuWebGLPlayer({
    canvas: 'myCanvas',
    width: 1920,
    height: 1080,
    fps: 30,
    durationSeconds: 10,
    videos: ['path/to/video.mp4'],
    webgl: true,
    webcodecs: true
});

// Load video
await player.load();

// Add effects
player.addEffect(
    player.getShaderManager().createGrayscaleEffect(0.8)
);

// Play video
player.play();
```

## 📦 Installation

1. **Clone and Install:**
   ```bash
   git clone https://github.com/JohnEsleyer/tiramisu.git
   cd tiramisu
   pnpm install
   ```

2. **Build the Audio Analyzer (Required for Visualizers):**
   ```bash
   pnpm run build:wasm
   ```

3. **Try an Example:**
   ```bash
   pnpm run dev:visualizer  # Music Visualizer
   pnpm run dev:meme        # Meme Generator with Drag & Drop
   pnpm run dev:snow        # Deterministic Snow Overlay
   ```

## 🔧 API Reference

### WebGL Core Classes

#### `TiramisuRenderer`
Main WebGL rendering engine with ping-pong framebuffers and texture management.

```typescript
const renderer = new TiramisuRenderer(canvas, config);
renderer.renderToCanvas(texture, effects);
```

#### `TextureManager` 
Efficient GPU texture pool and video frame uploads.

```typescript
const textureManager = new TextureManager(gl);
const texture = textureManager.uploadVideoFrame(videoFrame);
```

#### `WebCodecsVideoSource`
Hardware-accelerated video decoding with seeking support.

```typescript
const videoSource = new WebCodecsVideoSource(videoUrl, config);
await videoSource.initialize();
await videoSource.seekToFrame(frameNumber);
```

#### `ShaderManager`
Pre-built effects and custom shader loading.

```typescript
const shaderManager = new ShaderManager(renderer);
const blurEffect = shaderManager.createBlurEffect(radius, resolution);
player.addEffect(blurEffect);
```

### Built-in Effects

- **Grayscale**: Luminance-based black & white conversion
- **Blur**: Gaussian blur with directional options
- **Brightness/Contrast**: Exposure and contrast adjustments  
- **Tint**: Color overlay with configurable strength
- **Chroma Key**: Green screen removal with spill reduction

## 🎬 Browser Support

### Required APIs
- **WebGL2**: For shader-based rendering
- **WebCodecs**: For hardware video decoding
- **MP4Box.js**: For MP4 demuxing

### Browser Compatibility
- Chrome 94+ ✅
- Edge 94+ ✅ 
- Safari 17+ (partial) ⚠️
- Firefox 100+ (experimental) ⚠️

## 🔨 Development

```bash
# Build the library
npm run build

# Run demo
npm run demo

# Type checking
npm run typecheck
```

### 2. Live Preview (Client-Side)
Ideal for editors and dashboards.
```typescript
import { TiramisuPlayer } from "tiramisu/client";

const player = new TiramisuPlayer({
    width: 1280, height: 720, fps: 60,
    durationSeconds: 5, canvas: "my-canvas-id"
});

player.addClip(0, 5, myClip);
await player.load();
player.play();
```

### 3. Final Render (Server-Side)
Pipes frames to FFmpeg to generate an `.mp4`.
```typescript
import { Tiramisu } from "tiramisu";

const engine = new Tiramisu({
    width: 1280, height: 720, fps: 30,
    durationSeconds: 5, outputFile: "output.mp4"
});

engine.addClip(0, 5, myClip);
await engine.render();
```

## 🎯 Phase 1 Goal Achieved

✅ **"Hello Video" WebGL Previewer**
- Load 4K MP4 via WebCodecs  
- Seek to any frame with slider
- Display in WebGL canvas
- Apply real-time effects with zero CPU lag

## 🗺️ Roadmap

### Phase 2: Advanced Features
- Multi-track timeline
- Transition effects
- Audio waveform visualization
- Export functionality

### Phase 3: Production Ready
- Performance optimization
- Error handling
- Documentation
- Test suite

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

**Tiramisu 2.0** - Where video editing meets WebGL performance 🚀