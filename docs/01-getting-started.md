# Getting Started

Tiramisu is a programmatic video engine that uses a **Unified Canvas API**. Write your drawing logic once in TypeScript, preview it in real-time in the browser, and render it to a high-quality MP4 on the server.

## Prerequisites
- [Bun](https://bun.sh) (Runtime)
- **FFmpeg** (Must be in your system PATH)
- **Rust/Cargo** (Required to build the audio analysis module)

## Installation

1. **Install Dependencies**:
   ```bash
   bun install
   ```

2. **Build the Audio Analyzer**:
   Tiramisu uses a Rust-powered WASM module to ensure that audio frequency data (FFT) in the final render matches the browser preview exactly.
   ```bash
   bun run build:wasm
   ```

## Your First Render
On the server, Tiramisu uses Puppeteer to "photograph" your canvas and pipe the buffers directly into FFmpeg via STDIN.

```typescript
import { Tiramisu } from "./index";

const engine = new Tiramisu({
    width: 1280,
    height: 720,
    fps: 30,
    durationSeconds: 5,
    outputFile: "output.mp4"
});

engine.addClip(0, 5, ({ ctx, width, height, localProgress }) => {
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);
    
    ctx.fillStyle = "white";
    ctx.font = "bold 80px sans-serif";
    ctx.fillText("Tiramisu", 100, 100 + (localProgress * 50));
});

await engine.render();
```
