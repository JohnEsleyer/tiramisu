# 🍰 Tiramisu

**Tiramisu** is a professional-grade, programmatic video creation engine built on [Bun](https://bun.sh). It combines the flexibility of the HTML5 Canvas with the power of FFmpeg to render high-quality video content from code.

## ✨ Features

- **Timeline System:** Organize complex animations into Clips with specific start/end times and z-indexes.
- **Audio Reactivity:** Built-in analyzer extracts volume levels per frame, allowing animations to pulse to the beat.
- **Video & Image Assets:** Frame-accurate video syncing and automatic image preloading.
- **Text & UI Utilities:** Built-in support for text wrapping and rounded shapes.
- **Modular Core:** Clean separation between the Server, Browser, and Encoder.
- **Zero-Disk Rendering:** Direct piping from Puppeteer to FFmpeg.

## 📦 Installation

```bash
bun install
```

*Requires FFmpeg to be installed on your system.*

## 🚀 Usage

### 1. Basic Setup

```typescript
import { Tiramisu } from "./src/Tiramisu";

const engine = new Tiramisu({
    width: 1920,
    height: 1080,
    fps: 30,
    durationSeconds: 5,
    outputFile: "out.mp4"
});
```

### 2. Adding Clips

Tiramisu uses a **Clip** system. Each clip represents a drawing function active for a specific time range.

```typescript
// Background (Layer 0)
engine.addClip(0, 5, ({ ctx, width, height }) => {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, width, height);
}, 0);

// Text (Layer 1) - Starts at 1s, lasts 3s
engine.addClip(1, 3, ({ ctx, width, height, localProgress, utils }) => {
    const y = utils.lerp(0, height/2, localProgress);
    ctx.fillStyle = "white";
    ctx.fillText("Hello World", width/2, y);
}, 1);
```

### 3. Audio Reactivity

Pass an `audioFile` in the config. Tiramisu will analyze it and provide `audioVolume` (0.0 - 1.0) in the context.

```typescript
engine.addClip(0, 10, ({ ctx, audioVolume }) => {
    const radius = 100 + (audioVolume * 50);
    ctx.arc(100, 100, radius, 0, Math.PI*2);
    ctx.fill();
});
```

### 4. Assets & Fonts

```typescript
const engine = new Tiramisu({
    // ... config
    assets: ["./image.png"],
    videos: ["./background.mp4"],
    fonts: [{ name: 'MyFont', url: './MyFont.woff2' }]
});

// Access via ctx.assets['./image.png'] or ctx.videos['...']
```

## 🏗 Architecture

1.  **Server:** Hosts the static assets and HTML stage.
2.  **Browser:** Puppeteer instance that executes your drawing logic frame-by-frame.
3.  **Analyzer:** FFmpeg process that reads audio data for visualization.
4.  **Encoder:** FFmpeg process that stitches screenshots into an MP4.

## 📝 License

MIT