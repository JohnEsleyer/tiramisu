
# 🍰 Tiramisu

**Tiramisu** is a high-performance, programmatic video creation engine built on [Bun](https://bun.sh). It bridges the gap between the browser and the server, allowing you to build complex video compositions using the familiar HTML5 Canvas API and render them into high-quality MP4s.

Unlike traditional video frameworks, Tiramisu features a **zero-disk-waste pipeline**: Puppeteer screenshots are streamed directly into FFmpeg via STDIN, while a lightweight client-side player provides real-time previews for rapid development.

## 🔗 Repository
[github.com/JohnEsleyer/tiramisu](https://github.com/JohnEsleyer/tiramisu)

## ✨ Key Features

- **Unified API**: Write your drawing logic once; run it in the browser for live previews and on the server for final rendering.
- **Audio Reactivity (WASM)**: High-fidelity audio analysis providing real-time RMS volume and frequency bands (FFT) via a Rust-powered WASM module.
- **Dynamic Asset Pipeline**: Automatic preloading for Images, Fonts (Google/Local), and Videos (synchronized frame-by-frame).
- **Interactive Preview Player**: Built-in `TiramisuPlayer` for the browser with support for scrubbing, play/pause, and real-time state updates.
- **Animation Toolbox**: 
    - **Easings**: Bounce, Cubic, Expo, etc.
    - **Masking**: Advanced Luma/Stencil masking (video-in-text, shapes).
    - **Deterministic RNG**: Seeded random generators for consistent particle systems (e.g., snow, rain).
    - **Layout**: `drawMediaFit` and `drawMediaCover` helpers for responsive media.

## 🛠 Prerequisites

- **Bun**: The runtime.
- **FFmpeg**: Required for encoding the final video.
- **Rust (Optional)**: Only required if you wish to modify/rebuild the audio analyzer WASM.

```bash
# macOS
brew install ffmpeg
# Linux
sudo apt install ffmpeg
```

## 📦 Installation

1. **Clone and Install:**
   ```bash
   git clone https://github.com/JohnEsleyer/tiramisu.git
   cd tiramisu
   bun install
   ```

2. **Build the Audio Analyzer (Required for Visualizers):**
   ```bash
   bun run build:wasm
   ```

3. **Try an Example:**
   ```bash
   bun run dev:visualizer  # Music Visualizer
   bun run dev:meme        # Meme Generator with Drag & Drop
   bun run dev:snow        # Deterministic Snow Overlay
   ```

## 🎬 Quick Start

### 1. Unified Drawing Logic
The core of Tiramisu is the `DrawFunction`. It receives a `context` containing the Canvas 2D API, timing info, and audio data.

```typescript
const myClip = ({ ctx, width, height, localProgress, audioVolume, utils }) => {
    // Fill background
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);
    
    // Animate a circle based on audio volume
    const radius = 50 + (audioVolume * 100);
    ctx.beginPath();
    ctx.arc(width/2, height/2, radius, 0, Math.PI * 2);
    ctx.fillStyle = "#38bdf8";
    ctx.fill();
};
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

## 🧠 Architecture

1.  **The Server (`Tiramisu.ts`)**: Orchestrates the headless browser (Puppeteer) and the encoder (FFmpeg).
2.  **The Analyzer (`AudioAnalysis.ts`)**: Uses a **Rust/WASM** module to perform FFT and RMS analysis on audio files, mirroring Web Audio API behavior on the server.
3.  **The Video Manager (`VideoManager.ts`)**: Extracts video frames into a local cache to ensure frame-accurate synchronization during headless rendering.
4.  **The Utils (`Utils.ts`)**: A shared library injected into both Puppeteer and the Browser Player to ensure math and drawing functions are identical across environments.
5.  **The Encoder (`Encoder.ts`)**: Automatically detects hardware acceleration (NVENC, VideoToolbox) for faster-than-realtime encoding.

## 🎨 Creative Examples Included

- **`luma-matte`**: How to use stencil buffers for "Video inside Text" effects.
- **`music-visualizer`**: Real-time frequency bar rendering.
- **`meme-generator`**: A full UI example showing how to sync React/State with the Tiramisu timeline.
- **`split-screen`**: Dynamic wipe transitions between two video sources.
- **`snow-overlay`**: Using `seededRandomGenerator` to ensure particle systems look identical in preview and final render.

## 📝 License
MIT — Created by John Esleyer.