# Getting Started

Tiramisu is a programmatic video engine that uses a **Unified Canvas API**. This means you write your drawing logic once in TypeScript, preview it in real-time in the browser, and render it to a high-quality MP4 on the server using the exact same code.

## Prerequisites
- [Bun](https://bun.sh) runtime.
- **FFmpeg** installed on your system path.
- **Rust** (optional, for rebuilding the audio analyzer).

## Installation
```bash
git clone https://github.com/JohnEsleyer/tiramisu.git
cd tiramisu
bun install

# Generate the WASM audio analyzer (Required for audio reactivity)
bun run build:wasm
```

## Your First Render
On the server, Tiramisu uses Puppeteer to "photograph" your canvas and pipe the buffers into FFmpeg.

```typescript
import { Tiramisu } from "./src/Tiramisu";

const engine = new Tiramisu({
    width: 1280,
    height: 720,
    fps: 30,
    durationSeconds: 5,
    outputFile: "hello-world.mp4"
});

engine.addClip(0, 5, ({ ctx, width, height, localProgress }) => {
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, width, height);
    
    ctx.fillStyle = "white";
    ctx.font = "bold 80px sans-serif";
    ctx.fillText("Tiramisu", 100, 100 + (localProgress * 50));
});

await engine.render();
```


