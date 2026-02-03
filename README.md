
# 🍰 Tiramisu

**Tiramisu** is a high-performance, programmatic video creation engine built on [Bun](https://bun.sh). It allows you to generate high-quality MP4 videos and interactive web previews using a single, unified HTML5 Canvas API.

Unlike heavier frameworks, Tiramisu features a zero-disk-waste pipeline that streams frames directly into FFmpeg while providing a lightweight client-side player for real-time editing and previews.

## 🔗 Repository
[github.com/JohnEsleyer/tiramisu](https://github.com/JohnEsleyer/tiramisu)

## ✨ Key Features

- **Unified API**: Use the exact same `addClip()` logic for both your server-side renders and frontend live previews.
- **Live Preview Player**: Built-in `TiramisuPlayer` for the browser with support for scrubbing, play/pause, and real-time playback.
- **Timeline System**: Modular organization of animations with specific timing and layering (z-index).
- **Audio Reactivity**: Built-in audio analyzer providing real-time volume data (`audioVolume`) for reactive visuals in both Puppeteer and the browser.
- **Asset Preloading**: Automatic preloading for Images, Videos, and Custom Fonts (Google Fonts or local).
- **Animation Toolbox**: Built-in Easing functions (Bounce, Elastic, etc.), Lerp, Text Wrapping, and Rounded Shapes.
- **Zero-Disk Rendering**: Puppeteer screenshots are piped directly to FFmpeg via STDIN.

## 🛠 Prerequisites

Tiramisu requires **FFmpeg** to be installed on your system to encode the final video:

- **macOS**: `brew install ffmpeg`
- **Linux**: `sudo apt install ffmpeg`
- **Windows**: `winget install FFmpeg`

## 📦 Installation

1. **Clone and Install:**
   ```bash
   git clone https://github.com/JohnEsleyer/tiramisu.git
   cd tiramisu
   bun install
   ```

2. **Run the Interactive Editor Demo:**
   ```bash
   bun run dev:editor
   ```
   *Then open `http://localhost:3000/examples/video-editor/index.html` in your browser.*

## 🎬 Quick Start

### 1. Backend Rendering (Server)
Generate a high-quality MP4 file.

```typescript
import { Tiramisu } from "./src/Tiramisu";

const engine = new Tiramisu({
    width: 1280, height: 720, fps: 30,
    durationSeconds: 5, outputFile: "output.mp4"
});

engine.addClip(0, 5, ({ ctx, width, height, localProgress, utils }) => {
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, width, height);
    
    ctx.font = "bold 60px sans-serif";
    ctx.fillStyle = "white";
    ctx.fillText("🍰 Tiramisu Render", 100, 100);
});

await engine.render();
```

### 2. Live Preview (Client)
Run the animation in a web browser for an interactive editor.

```typescript
import { TiramisuPlayer } from "./src/Client";

const player = new TiramisuPlayer({
    width: 1280, height: 720, fps: 60,
    durationSeconds: 5, canvas: "preview-canvas"
});

// The exact same clip logic as above!
player.addClip(0, 5, ({ ctx, width, height }) => {
    /* ... same code ... */
});

await player.load();
player.play();
```

## 🧠 Architecture

Tiramisu is designed with a modular separation of concerns:

1. **The Server (`Tiramisu.ts`)**: The core engine that orchestrates the Puppeteer-to-FFmpeg pipeline.
2. **The Player (`Client.ts`)**: A browser-native implementation using `requestAnimationFrame` and Web Audio API for live previews.
3. **The Browser (`Browser.ts`)**: Manages the Puppeteer instance for frame-accurate headless rendering.
4. **The Encoder (`Encoder.ts`)**: Manages the FFmpeg process that converts raw data into the final video file.
5. **The Utilities (`Utils.ts`)**: A shared toolbox of math and drawing helpers available to both Server and Client.
6. **The Analyzer (`AudioAnalysis.ts`)**: Extracts PCM data to calculate RMS volume levels for reactive visuals.

## 📝 License
MIT
