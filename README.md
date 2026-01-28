# 🍰 Tiramisu

**Tiramisu** is a high-performance, programmatic video creation engine built on [Bun](https://bun.sh). It allows you to generate high-quality MP4 videos by describing scenes using the standard HTML5 Canvas API.

Unlike heavier frameworks, Tiramisu is lightweight, modular, and optimized for speed, featuring a zero-disk-waste pipeline that streams frames directly into FFmpeg.

## 🔗 Repository
[github.com/JohnEsleyer/tiramisu](https://github.com/JohnEsleyer/tiramisu)

## ✨ Key Features

- **Timeline System**: Modular `addClip()` API to organize animations with specific timing and layering (z-index).
- **Audio Reactivity**: Built-in audio analyzer that provides real-time volume data (`audioVolume`) for every frame.
- **Frame-Accurate Video**: Support for video assets that stay perfectly in sync with the timeline.
- **Asset Preloading**: Automatic preloading for Images, Videos, and Custom Fonts (Google Fonts or local).
- **Animation Toolbox**: Built-in Easing functions (Bounce, Elastic, etc.), Lerp, Text Wrapping, and Rounded Shapes.
- **Sleek CLI**: Professional terminal output with progress bars, real-time FPS, and ETA.
- **Zero-Disk Rendering**: Puppeteer screenshots are piped directly to FFmpeg via STDIN.

## 🛠 Prerequisites

Tiramisu requires **FFmpeg** to be installed on your system to encode the final video:

- **macOS**: `brew install ffmpeg`
- **Linux**: `sudo apt install ffmpeg`
- **Windows**: `winget install FFmpeg`

## 📦 Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/JohnEsleyer/tiramisu.git
   cd tiramisu
   ```

2. **Install dependencies:**
   ```bash
   bun install
   ```

3. **Run the demo:**
   ```bash
   bun run index.ts
   ```

## 🎬 Quick Start

```typescript
import { Tiramisu } from "./src/Tiramisu";

const engine = new Tiramisu({
    width: 1280,
    height: 720,
    fps: 30,
    durationSeconds: 5,
    outputFile: "output.mp4"
});

// Add a background layer
engine.addClip(0, 5, ({ ctx, width, height }) => {
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, width, height);
}, 0);

// Add an animated text layer
engine.addClip(0, 5, ({ ctx, width, height, localProgress, utils }) => {
    const y = utils.lerp(0, height / 2, utils.easeOutBounce(localProgress));
    ctx.font = "bold 60px sans-serif";
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.fillText("🍰 Tiramisu V2", width / 2, y);
}, 1);

await engine.render();
```

## 🧠 Architecture

Tiramisu is designed with a modular separation of concerns:

1. **The Server (`Server.ts`)**: A lightweight Bun server that hosts the HTML stage and serves your local assets (images/videos).
2. **The Browser (`Browser.ts`)**: A Puppeteer-controlled instance that renders frames and ensures asset synchronization.
3. **The Analyzer (`AudioAnalysis.ts`)**: Uses FFmpeg to extract PCM data and calculate RMS volume levels for reactive visuals.
4. **The Encoder (`Encoder.ts`)**: Manages the FFmpeg process that converts raw image data into the final video file.
5. **The Reporter (`CLI.ts`)**: Provides the beautiful Unicode terminal interface.

## 📝 License
MIT