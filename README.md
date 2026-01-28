Here is a comprehensive `README.md` for **Tiramisu**.

```markdown
--- START OF FILE README.md ---
# 🍰 Tiramisu

**Tiramisu** is a lightweight, programmatic video creation engine built on [Bun](https://bun.sh), [Puppeteer](https://pptr.dev/), and [FFmpeg](https://ffmpeg.org/).

It allows you to create high-quality content videos using the standard HTML5 Canvas API. Think of it as a "headless" motion graphics tool where you describe your scene in code and Tiramisu handles the rendering, frame management, and video encoding.

## 🚀 Why Tiramisu?

While tools like Remotion are powerful, they often come with the overhead of React and complex state management. Tiramisu follows a **"Frame-by-Frame"** philosophy:

1. **Simplicity:** If you know how to draw on a Canvas, you know how to make a Tiramisu video.
2. **Performance:** Leveraging Bun's fast runtime and direct piping to FFmpeg.
3. **No Bloat:** No complex build steps or heavy dependencies—just a browser and a pipe.

## 🛠 Prerequisites

Before running Tiramisu, you must have **FFmpeg** installed on your system:

- **macOS:** `brew install ffmpeg`
- **Linux:** `sudo apt install ffmpeg`
- **Windows:** `winget install FFmpeg`

## 📦 Installation

```bash
bun install
```

## 🎬 Getting Started

The core of Tiramisu is the `scene` method. You provide a function that executes logic for every frame.

```typescript
import { Tiramisu } from "./src/Tiramisu";

const engine = new Tiramisu({
    width: 1280,
    height: 720,
    fps: 30,
    durationSeconds: 10,
    outputFile: "my-video.mp4"
});

engine.scene(({ ctx, width, height, progress }) => {
    // Standard Canvas API
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "white";
    ctx.font = "50px Arial";
    ctx.fillText("Hello Tiramisu!", 100, 100 + (progress * 200));
});

await engine.render();
```

## 🧠 How it Works

Tiramisu orchestrates three main components:

1.  **The Director (Bun):** A Bun server hosts a local "Stage" (HTML/JS) and manages the project lifecycle.
2.  **The Performer (Puppeteer):** A headless browser loads the Stage. Tiramisu "injects" your drawing logic into the browser. It iterates through every frame, executes your code, and captures a screenshot.
3.  **The Producer (FFmpeg):** As screenshots are captured, they are piped directly into an FFmpeg process as a stream of raw image data, which is then encoded into a `.mp4` (H.264) file.

## ⚠️ Important Note on Scoping

Because the `scene` function is executed **inside the browser context**, it is serialized using `.toString()`. 

**This means:**
- You **cannot** use variables from your Bun/Node.js script inside the `scene` function (closures won't work).
- You **cannot** import external modules inside the `scene` function.
- All drawing logic must be self-contained within the function provided to `engine.scene`.

## 🛣 Goals

- [x] Canvas-based frame rendering.
- [x] FFmpeg piping for zero-disk-space frames.
- [ ] **Audio Support:** Add background music and voiceover overlays.
- [ ] **Asset Preloading:** Easily load images and fonts into the browser context before rendering starts.
- [ ] **Component System:** A library of pre-built shapes, transitions, and text animations.
- [ ] **Data Injection:** Pass JSON data from Bun into the browser context to drive dynamic videos.

## 🏗 Development

To run the example animation:

```bash
bun run index.ts
```

---
Built with 🍰 by JohnEsleyer
```