# Tiramisu LLM Guide

Purpose: TypeScript video engine for programmatic compositions. Two main paths: server MP4 rendering with Canvas 2D and client preview, plus a WebGL/WebCodecs pipeline for GPU effects.

## Requirements

- Node.js 18+ for server rendering.
- FFmpeg available on PATH for encoding and audio analysis.
- A modern browser for client preview.
- WebGL2 and WebCodecs for the WebGL pipelines.

## Install

```bash
npm install @johnesleyer/tiramisu@2.0.4
```

## Setup: New Project (Server Render)

1. Initialize a Node + TypeScript project (ESM recommended).
2. Install Tiramisu.
3. Create a render script and run it with a TS runner (or compile TS).

```bash
npm init -y
npm install @johnesleyer/tiramisu@2.0.4
npm install -D typescript tsx
npx tsc --init
```

`render.ts`:

```ts
import { Tiramisu } from "@johnesleyer/tiramisu";

const engine = new Tiramisu({
  width: 1280,
  height: 720,
  fps: 30,
  durationSeconds: 5,
  outputFile: "output.mp4",
  assets: ["assets/logo.png"],
  videos: ["assets/clip.mp4"],
  audioFile: "assets/track.mp3",
  data: { title: "Launch" },
});

engine.addClip(0, 5, ({ ctx, width, height, data }) => {
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "white";
  ctx.font = "bold 80px sans-serif";
  ctx.fillText(data.title, 80, 120);
});

await engine.render();
```

Run:

```bash
npx tsx render.ts
```

## Setup: New Project (Client Preview)

1. Use a bundler (Vite/webpack/Next/etc.) and install Tiramisu.
2. Add a canvas element and a player script.

`main.ts`:

```ts
import { TiramisuPlayer } from "@johnesleyer/tiramisu/client";

const player = new TiramisuPlayer({
  canvas: "preview",
  width: 1280,
  height: 720,
  fps: 30,
  durationSeconds: 5,
  assets: ["/img/logo.png"],
});

player.addClip(0, 5, ({ ctx, width, height, assets }) => {
  ctx.drawImage(assets["/img/logo.png"], 40, 40, 200, 200);
});

await player.load();
player.play();
```

## Add Tiramisu To An Existing Project

- Install the package: `npm install @johnesleyer/tiramisu@2.0.4`
- Server render: Ensure FFmpeg is on PATH.
- Server render: Ensure asset paths are resolvable from the server process (relative to `process.cwd()` or absolute).
- Server render: Use `new Tiramisu(config)` and `await render()`.
- Client preview: Add a `<canvas>` in your UI.
- Client preview: Use `TiramisuPlayer` (Canvas 2D) or `TiramisuWebGLPlayer` (WebGL).
- WebGL + WebCodecs: `WebCodecsVideoSource` expects `window.MP4Box` to exist. Load MP4Box before initializing.

Example MP4Box setup:

```ts
import MP4Box from "mp4box";

// Ensure this runs before creating WebGL players.
(window as any).MP4Box = MP4Box;
```

## Key Exports

- `Tiramisu`: server renderer (Canvas 2D -> Puppeteer -> FFmpeg) - `@johnesleyer/tiramisu`.
- `TiramisuPlayer`: client 2D preview - `@johnesleyer/tiramisu/client`.
- `TiramisuWebGLPlayer`: WebGL/WebCodecs preview - `@johnesleyer/tiramisu/webgl`.
- `TiramisuEditor`: editor-style WebGL API (tracks, clips, effects) - `@johnesleyer/tiramisu/editor`.
- WebGL core: `TiramisuRenderer`, `TextureManager`, `ShaderManager`, `WebCodecsVideoSource`, shader constants - `@johnesleyer/tiramisu/editor`.
- Types: `RenderConfig`, `WebGLRenderContext`, `Effect`, `ShaderUniform` - `@johnesleyer/tiramisu/types`.

## Server Render (MP4)

```ts
import { Tiramisu } from "@johnesleyer/tiramisu";

const engine = new Tiramisu({
  width: 1280,
  height: 720,
  fps: 30,
  durationSeconds: 5,
  outputFile: "output.mp4",
  assets: ["assets/logo.png"],
  videos: ["assets/clip.mp4"],
  audioFile: "assets/track.mp3",
  data: { title: "Launch" },
});

engine.addClip(0, 5, ({ ctx, width, height, data }) => {
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "white";
  ctx.font = "bold 80px sans-serif";
  ctx.fillText(data.title, 80, 120);
});

await engine.render();
```

Notes:

- Draw functions are stringified for the headless browser. Avoid closures; use `config.data`.
- FFmpeg must be installed. Audio analysis uses FFmpeg + WASM; failure falls back to silence.
- Server video decoding uses WebCodecs when available. Set `data.useVideoElement = true` to force `<video>` elements.

## Client Preview (Canvas 2D)

```ts
import { TiramisuPlayer } from "@johnesleyer/tiramisu/client";

const player = new TiramisuPlayer({
  canvas: "preview",
  width: 1280,
  height: 720,
  fps: 30,
  durationSeconds: 5,
  assets: ["/img/logo.png"],
});

player.addClip(0, 5, ({ ctx, width, height, assets }) => {
  ctx.drawImage(assets["/img/logo.png"], 40, 40, 200, 200);
});

await player.load();
player.play();
```

## WebGL Preview

```ts
import { TiramisuWebGLPlayer } from "@johnesleyer/tiramisu/webgl";

const player = new TiramisuWebGLPlayer({
  canvas: "gl",
  width: 1920,
  height: 1080,
  fps: 30,
  durationSeconds: 10,
  videos: ["/video/clip.mp4"],
});

await player.load();
const shaderManager = player.getShaderManager();
player.addEffect(shaderManager.createGrayscaleEffect(0.7));
player.play();
```

WebCodecs notes:

- `WebCodecsVideoSource` expects `window.MP4Box` to exist. Load MP4Box in your app before initializing.

## WebGL Editor

```ts
import { TiramisuEditor } from "@johnesleyer/tiramisu/editor";

const editor = new TiramisuEditor({ canvas: "gl", width: 1920, height: 1080, fps: 30, durationSeconds: 10 });
const clip = editor.addVideo("/video/a.mp4", { start: 0, duration: 5, track: 1 });
editor.addEffectToClip(clip.id, "BrightnessContrast", { brightness: 0.1, contrast: 1.2 });
editor.play();
```

Limitations:

- `TiramisuEditor` transitions and adjustment layers are stored but not rendered yet.
- `TiramisuEditor.export()` is not implemented.

## Complete Video + Graphics Player Implementation

A production-ready player that displays videos with overlaid graphics, audio visualization, and GPU-accelerated effects.

### 1. Setup (with MP4Box for WebGL)

```ts
// main.ts - Entry point
import MP4Box from "mp4box";

// MUST load MP4Box before creating WebGL players
(window as any).MP4Box = MP4Box;

import { TiramisuWebGLPlayer } from "@johnesleyer/tiramisu/webgl";

const player = new TiramisuWebGLPlayer({
  canvas: "canvas",
  width: 1920,
  height: 1080,
  fps: 30,
  durationSeconds: 30,
  assets: ["/img/logo.png", "/img/overlay.png"],
  videos: ["/video/intro.mp4", "/video/main.mp4"],
  audioFile: "/audio/track.mp3",
});

await player.load();
```

### 2. Video Layer with Graphics Overlay (WebGL)

```ts
// Draw video frames with overlaid graphics
player.addClip(0, 10, ({ gl, width, height, videos, assets, progress, audioBands }) => {
  const video = videos["/video/intro.mp4"];
  if (video) {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
  }
  
  // Draw logo in corner
  const logo = assets["/img/logo.png"];
  // Use texture manager for WebGL images
});

player.addClip(0, 10, ({ gl, width, height, audioBands, frame }) => {
  // Audio-reactive graphics
  const band = audioBands[0] || 0;
  const scale = 1 + band * 0.5;
  
  // Draw pulsing circle based on audio
  // ... WebGL draw calls
});
```

### 3. Complete Canvas 2D Player (Simpler, Works Everywhere)

```ts
import { TiramisuPlayer } from "@johnesleyer/tiramisu/client";

const player = new TiramisuPlayer({
  canvas: "preview",
  width: 1920,
  height: 1080,
  fps: 30,
  durationSeconds: 30,
  assets: ["/img/logo.png", "/img/background.png"],
  videos: ["/video/clip.mp4"],
  audioFile: "/audio/track.mp3",
});

// Background video layer (zIndex: 0)
player.addClip(0, 30, ({ ctx, width, height, videos }) => {
  const video = videos["/video/clip.mp4"];
  if (video && video.readyState >= 2) {
    ctx.drawImage(video, 0, 0, width, height);
  }
}, 0);

// Graphics overlay (zIndex: 1)
player.addClip(0, 30, ({ ctx, width, height, assets, progress }) => {
  const logo = assets["/img/logo.png"];
  if (logo) {
    ctx.globalAlpha = Math.min(1, progress * 2);
    ctx.drawImage(logo, 40, 40, 200, 200);
    ctx.globalAlpha = 1;
  }
}, 1);

// Audio visualization (zIndex: 2)
player.addClip(0, 30, ({ ctx, width, height, audioBands, audioVolume }) => {
  const barCount = 32;
  const barWidth = width / barCount;
  
  for (let i = 0; i < barCount; i++) {
    const band = audioBands[i] || 0;
    const barHeight = band * height * 0.8;
    
    ctx.fillStyle = `hsl(${i * 10}, 70%, 50%)`;
    ctx.fillRect(i * barWidth, height - barHeight, barWidth - 2, barHeight);
  }
}, 2);

// Text overlay with animation
player.addClip(5, 10, ({ ctx, width, height, localProgress }) => {
  const alpha = localProgress < 0.2 ? localProgress * 5 
             : localProgress > 0.8 ? (1 - localProgress) * 5 
             : 1;
  
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "white";
  ctx.font = "bold 72px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("HELLO WORLD", width / 2, height / 2);
  ctx.globalAlpha = 1;
}, 3);

await player.load();
player.play();
```

### 4. Adding WebGL Effects

```ts
const shaderManager = player.getShaderManager();

// Grayscale effect (intensity 0-1)
player.addEffect(shaderManager.createGrayscaleEffect(0.3));

// Brightness/contrast
player.addEffect(shaderManager.createBrightnessContrastEffect(0.1, 1.2));

// Chroma key (green screen removal)
player.addEffect(shaderManager.createChromaKeyEffect(0, 1, 0, 0.3));

// Custom shader
const customEffect = {
  id: "myEffect",
  fragmentShader: `
    precision mediump float;
    uniform sampler2D u_source;
    uniform float u_time;
    varying vec2 v_texCoord;
    void main() {
      vec4 color = texture2D(u_source, v_texCoord);
      float wave = sin(v_texCoord.y * 20.0 + u_time * 5.0) * 0.02;
      gl_FragColor = texture2D(u_source, v_texCoord + vec2(wave, 0.0));
    }
  `,
  uniforms: { u_time: () => player.getCurrentTime() },
};

player.addEffect(customEffect);
```

### 5. Player Controls

```ts
// Playback controls
player.play();
player.pause();
player.seek(5); // Seek to 5 seconds
player.setVolume(0.8);

// Events
player.onTimeUpdate = (time) => {
  console.log("Current time:", time);
};

player.onEnded = () => {
  console.log("Playback complete");
};
```

### 6. Server-Side Rendering

```ts
import { Tiramisu } from "@johnesleyer/tiramisu";

const engine = new Tiramisu({
  width: 1920,
  height: 1080,
  fps: 30,
  durationSeconds: 30,
  outputFile: "output.mp4",
  assets: ["assets/logo.png", "assets/background.png"],
  videos: ["assets/clip.mp4"],
  audioFile: "assets/track.mp3",
});

// Video background
engine.addClip(0, 30, ({ ctx, width, height, videos }) => {
  const video = videos["assets/clip.mp4"];
  if (video) {
    ctx.drawImage(video, 0, 0, width, height);
  }
}, 0);

// Logo overlay
engine.addClip(0, 30, ({ ctx, width, height, assets, progress }) => {
  const logo = assets["assets/logo.png"];
  if (logo) {
    ctx.drawImage(logo, 40, 40, 200, 200);
  }
}, 1);

// Audio-reactive bars
engine.addClip(0, 30, ({ ctx, width, height, audioBands }) => {
  const barCount = 32;
  const barWidth = width / barCount;
  
  for (let i = 0; i < barCount; i++) {
    const band = audioBands[i] || 0;
    const barHeight = band * height * 0.8;
    
    ctx.fillStyle = `hsl(${i * 10}, 70%, 50%)`;
    ctx.fillRect(i * barWidth, height - barHeight, barWidth - 2, barHeight);
  }
}, 2);

await engine.render((progress) => {
  console.log(`Rendered ${progress.frame}/${progress.total} (${progress.percent.toFixed(1)}%)`);
});
```

### Key Differences: Canvas 2D vs WebGL

| Feature | Canvas 2D | WebGL |
|---------|-----------|-------|
| Performance | Good for simple scenes | GPU-accelerated, better for effects |
| Video decoding | `<video>` element | WebCodecs API |
| Effects | Limited (globalCompositeOperation) | Shaders, chroma key, etc |
| Complexity | Simpler API | More complex setup |
| Browser support | Wide | Requires WebGL2 |

Choose Canvas 2D for simplicity, WebGL for advanced effects and better performance with video.

## Utilities

`utils` in render context includes `lerp`, `clamp`, easing, `drawMediaFit`, `drawMediaCover`, `drawMasked`, and `createLayer`.

## Cheatsheets

### Imports

```ts
import { Tiramisu } from "@johnesleyer/tiramisu"; // Server (Node.js)
import { TiramisuPlayer } from "@johnesleyer/tiramisu/client"; // Client 2D
import { TiramisuWebGLPlayer } from "@johnesleyer/tiramisu/webgl"; // WebGL Preview
import { TiramisuEditor } from "@johnesleyer/tiramisu/editor"; // WebGL Editor
import type { RenderConfig, RenderContext, WebGLRenderContext, Effect } from "@johnesleyer/tiramisu/types";
```

### RenderConfig (Common Fields)

- `width`, `height`, `fps`, `durationSeconds`
- `outputFile` (server only)
- `assets`, `videos`, `audioFile`, `fonts`, `data`
- `canvas` (client only)
- `parallel` (server workers)
- `webgl`, `webcodecs`, `webglContextAttributes`

### RenderContext (2D)

- Time: `frame`, `progress`, `localFrame`, `localProgress`
- Audio: `audioVolume`, `audioBands`
- Canvas: `ctx`, `canvas`, `width`, `height`, `fps`
- Data: `data`, `assets`, `videos`
- Utils: `utils.lerp`, `utils.clamp`, easing, `drawMediaFit`, `drawMediaCover`, `drawMasked`
- Layers: `layer.create()` returns an offscreen 2D layer

### WebGLRenderContext (WebGL)

- Everything in 2D context, plus:
- `gl`, `program`, `sourceTexture`
- `applyShader(shaderId, uniforms)`
- `webglLayer.create()` returns a texture-based layer

### Clip Scheduling

- `addClip(startSeconds, durationSeconds, drawFn, zIndex = 0)`
- `startFrame = floor(start * fps)`
- `endFrame = floor((start + duration) * fps)`
- Use `zIndex` to control stacking order (higher renders on top).

### Progress Callback (Server)

```ts
await engine.render((p) => {
  // p.frame, p.total, p.percent, p.eta
});
```

### WebGL Effects

- Use `player.getShaderManager()` to create built-in effects.
- Add effects in order; they are applied sequentially.

```ts
const shaderManager = player.getShaderManager();
player.addEffect(shaderManager.createGrayscaleEffect(0.7));
player.addEffect(shaderManager.createBrightnessContrastEffect(0.1, 1.2));
```

### Common Pitfalls

- Server draw functions are stringified: avoid closures and capture via `config.data`.
- If WebCodecs is missing, prefer `TiramisuPlayer` or set `data.useVideoElement = true` on the server.
- `TiramisuEditor` stores transitions/adjustments but does not render them yet.
