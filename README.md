
# 🍰 Tiramisu

**Tiramisu** is a lightweight, programmatic video creation engine built on [Bun](https://bun.sh), [Puppeteer](https://pptr.dev/), and [FFmpeg](https://ffmpeg.org/). 

It allows you to build high-quality videos using the standard HTML5 Canvas API with zero bloat. It handles the orchestration of a headless browser, frame-by-frame rendering, and real-time video encoding.

## ✨ Features

- **Standard Canvas API**: If you can draw it in a browser, you can turn it into a video.
- **Modular Architecture**: Clean separation between the Stage (Server), the Performer (Browser), and the Producer (FFmpeg Encoder).
- **Data Injection**: Pass custom JSON data from your Bun environment directly into your drawing logic.
- **Asset Preloading**: Automatically preload images and logos before rendering starts.
- **Built-in Utils**: Native support for Easings (Bounce, Elastic, etc.), Lerp, and Math helpers inside the render context.
- **Sleek CLI**: Beautiful Unicode progress bars with ETA and real-time FPS tracking.
- **Audio Support**: Easily mix a soundtrack or voiceover into your final export.

## 🛠 Prerequisites

You must have **FFmpeg** installed on your system:

- **macOS:** `brew install ffmpeg`
- **Linux:** `sudo apt install ffmpeg`
- **Windows:** `winget install FFmpeg`

## 📦 Installation

```bash
bun install
```

## 🎬 Quick Start

```typescript
import { Tiramisu, type RenderContext } from "./src/Tiramisu";

interface VideoData {
    title: string;
}

const engine = new Tiramisu<VideoData>({
    width: 1280,
    height: 720,
    fps: 30,
    durationSeconds: 5,
    outputFile: "output.mp4",
    data: { title: "Hello Tiramisu!" },
    assets: ["./logo.png"]
});

engine.scene(({ ctx, width, height, progress, data, assets, utils }) => {
    // 1. Background
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, width, height);

    // 2. Animated Position using Utils
    const y = utils.lerp(100, 400, utils.easeOutBounce(progress));

    // 3. Draw Preloaded Asset
    const logo = assets["./logo.png"];
    if (logo) ctx.drawImage(logo, 100, y, 100, 100);

    // 4. Use Injected Data
    ctx.fillStyle = "white";
    ctx.font = "bold 50px sans-serif";
    ctx.fillText(data.title, 250, y + 65);
});

await engine.render();
```

## 🏗 Modular Architecture

Tiramisu is split into several focused components:

1.  **`TiramisuServer`**: A lightweight Bun server that serves the HTML template and your local static assets (images, fonts).
2.  **`TiramisuBrowser`**: Manages the Puppeteer instance, injects your logic, and handles high-resolution screenshots.
3.  **`TiramisuEncoder`**: Spawns an FFmpeg process and pipes raw PNG data into it for efficient encoding without temporary files.
4.  **`TiramisuCLI`**: Manages the terminal output, showing a smooth progress bar and render stats.

## 🧠 Important: Scoping & Context

The `scene` function is stringified and executed **inside the browser context**. 

- **No Closures**: You cannot reference variables defined outside the `scene` function. Use the `data` property in the config to pass external information.
- **Canvas Only**: Use the provided `ctx` (CanvasRenderingContext2D) for all drawing.
- **Async Assets**: Images are preloaded and provided in the `assets` map before your script runs.

## 🚀 Scripts

- `bun run render`: Run the default `index.ts` animation.
- `bun run dev`: Run with watch mode for rapid iteration.
- `bun run clean`: Remove generated `.mp4` files.

---
Built with 🍰 by JohnEsleyer
