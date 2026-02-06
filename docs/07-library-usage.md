To use **Tiramisu** as a library in a separate Bun project, follow this guide. Tiramisu is designed as a "Dual-Environment" library, meaning you import the **Engine** for your server scripts and the **Player** for your frontend code.

## 1. Prerequisites

Before starting, ensure your system has:
- **Bun**: `curl -fsSL https://bun.sh/install | bash`
- **FFmpeg**: Required for server-side video encoding.
- **Rust**: Required only if you need to build the Audio WASM module yourself.

---

## 2. Installation

Since Tiramisu is currently a library you likely have locally or on GitHub, you can add it to your new project's `package.json`:

```bash
# Create a new project
mkdir my-video-app && cd my-video-app
bun init -y

# Add Tiramisu as a dependency (via GitHub or local path)
bun add https://github.com/JohnEsleyer/tiramisu
```

### Build the Audio WASM (Required)
Tiramisu requires a compiled Rust module for audio analysis. If you are using the library for the first time, navigate to the `node_modules/tiramisu` folder and run the build script, or run it from your project root:
```bash
cd node_modules/tiramisu && bun run build
```

---

## 3. Project Configuration

Ensure your `tsconfig.json` is set up to handle Tiramisu’s modern ESM exports:

```json
{
  "compilerOptions": {
    "lib": ["ESNext", "DOM"],
    "module": "ESNext",
    "target": "ESNext",
    "moduleResolution": "bundler",
    "moduleDetection": "force",
    "allowImportingTsExtensions": true,
    "strict": true
  }
}
```

---

## 4. Usage: Server-Side Rendering

Create a file `render.ts`. This script will use Puppeteer and FFmpeg to generate an `.mp4`.

```typescript
import { Tiramisu } from "tiramisu";

const engine = new Tiramisu({
  width: 1920,
  height: 1080,
  fps: 30,
  durationSeconds: 5,
  outputFile: "my-video.mp4"
});

// Add a simple animated clip
engine.addClip(0, 5, ({ ctx, width, height, localProgress, utils }) => {
  // Background
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(0, 0, width, height);

  // Animated Circle using Tiramisu Utils
  const x = utils.lerp(0, width, localProgress);
  ctx.fillStyle = "#38bdf8";
  ctx.beginPath();
  ctx.arc(x, height / 2, 100, 0, Math.PI * 2);
  ctx.fill();
});

console.log("Starting render...");
await engine.render();
```

Run it with:
```bash
bun run render.ts
```

---

## 5. Usage: Client-Side Preview

To provide a real-time preview in the browser (e.g., in a React, Vue, or Vanilla JS app), use the `TiramisuPlayer`.

```typescript
import { TiramisuPlayer } from "tiramisu/client";

// Setup config
const config = {
  width: 1280,
  height: 720,
  fps: 30,
  durationSeconds: 10,
  canvas: "preview-canvas" // ID of your <canvas> element
};

const player = new TiramisuPlayer(config);

// Add the EXACT same clip logic used on the server
player.addClip(0, 10, ({ ctx, width, height, localProgress }) => {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "red";
  ctx.font = "50px sans-serif";
  ctx.fillText(`Progress: ${(localProgress * 100).toFixed(0)}%`, 50, 100);
});

// Load assets and play
await player.load();
player.play();
```

---

## 6. Key Library Concepts

### The "Unified" Draw Function
The most powerful feature of Tiramisu is that the `DrawFunction` is identical on both ends. You should define your clips in shared files:

```typescript
// shared-clips.ts
import type { DrawFunction } from "tiramisu/types";

export const myBrandClip: DrawFunction = ({ ctx, width, height, audioVolume }) => {
    // This code runs in Chrome (Preview) and Puppeteer (Render)
    const scale = 1 + audioVolume * 0.5;
    // ... drawing logic
};
```

### Handling Assets
When using images or videos as a library, Tiramisu expects paths relative to your server root.

```typescript
const engine = new Tiramisu({
  // ...
  assets: ["./public/logo.png"],
  videos: ["./public/background.mp4"],
  audioFile: "./public/music.mp3"
});
```

### Using Utils
Always use the provided `utils` inside your clips. They are injected into the context to ensure mathematical consistency:
*   **`utils.seededRandomGenerator(seed)`**: Use this instead of `Math.random()` for deterministic results.
*   **`utils.drawMediaCover()`**: Use for responsive video/image drawing.
*   **`utils.easeOutCubic()`**: Standard video easings.

---

## 7. Folder Structure Recommendation

For a project using Tiramisu as a library, we recommend this structure:

```text
├── public/              # Assets (videos, mp3s, images)
├── src/
│   ├── clips/           # Shared DrawFunctions (Unified API)
│   │   └── intro.ts
│   ├── components/      # Frontend Player components
│   │   └── Preview.tsx
│   └── scripts/         # Server-side render scripts
│       └── export.ts
├── tsconfig.json
└── package.json
```

## 8. Troubleshooting

1.  **"Module not found" for WASM**: Ensure you ran `bun run build:wasm` inside the Tiramisu directory.
2.  **FFmpeg errors**: Ensure `ffmpeg` is globally accessible. Type `ffmpeg -version` in your terminal to check.
3.  **Video Jitter**: If videos look choppy on the server, check the `.tiramisu-cache` folder. Tiramisu extracts frames to ensure perfect sync; if your disk is full, this will fail.
