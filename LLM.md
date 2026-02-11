# Tiramisu LLM Guide

Purpose: TypeScript video engine for programmatic compositions. Two main paths: server MP4 rendering with Canvas 2D and client preview, plus a WebGL/WebCodecs pipeline for GPU effects.

## Requirements

- Node.js 18+ for server rendering.
- FFmpeg available on PATH for encoding and audio analysis.
- A modern browser for client preview.
- WebGL2 and WebCodecs for the WebGL pipelines.

## Install

```bash
npm install @johnesleyer/tiramisu
```

## Setup: New Project (Server Render)

1. Initialize a Node + TypeScript project (ESM recommended).
2. Install Tiramisu.
3. Create a render script and run it with a TS runner (or compile TS).

```bash
npm init -y
npm install @johnesleyer/tiramisu
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

- Install the package: `npm install @johnesleyer/tiramisu`
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

## Key Exports (index.ts)

- `Tiramisu`: server renderer (Canvas 2D -> Puppeteer -> FFmpeg).
- `TiramisuPlayer`: client 2D preview (`@johnesleyer/tiramisu/client`).
- `TiramisuWebGLPlayer`: WebGL/WebCodecs preview.
- `TiramisuEditor`: editor-style WebGL API (tracks, clips, effects).
- WebGL core: `TiramisuRenderer`, `TextureManager`, `ShaderManager`, `WebCodecsVideoSource`, shader constants.
- Types: `RenderConfig`, `WebGLRenderContext`, `Effect`, `ShaderUniform`.

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
import { TiramisuWebGLPlayer } from "@johnesleyer/tiramisu";

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
import { TiramisuEditor } from "@johnesleyer/tiramisu";

const editor = new TiramisuEditor({ canvas: "gl", width: 1920, height: 1080, fps: 30, durationSeconds: 10 });
const clip = editor.addVideo("/video/a.mp4", { start: 0, duration: 5, track: 1 });
editor.addEffectToClip(clip.id, "BrightnessContrast", { brightness: 0.1, contrast: 1.2 });
editor.play();
```

Limitations:

- `TiramisuEditor` transitions and adjustment layers are stored but not rendered yet.
- `TiramisuEditor.export()` is not implemented.

## Utilities

`utils` in render context includes `lerp`, `clamp`, easing, `drawMediaFit`, `drawMediaCover`, `drawMasked`, and `createLayer`.

## Cheatsheets

### Imports

```ts
import { Tiramisu } from "@johnesleyer/tiramisu";
import { TiramisuPlayer } from "@johnesleyer/tiramisu/client";
import { TiramisuWebGLPlayer, TiramisuEditor } from "@johnesleyer/tiramisu";
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
