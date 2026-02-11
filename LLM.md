# Tiramisu LLM Guide

Purpose: TypeScript video engine for programmatic compositions. Two main paths: server MP4 rendering with Canvas 2D and client preview, plus a WebGL/WebCodecs pipeline for GPU effects.

## Install

```bash
npm install github.com/johnesleyer/tiramisu
```

## Key Exports (index.ts)

- `Tiramisu`: server renderer (Canvas 2D -> Puppeteer -> FFmpeg).
- `TiramisuPlayer`: client 2D preview (`tiramisu/client`).
- `TiramisuWebGLPlayer`: WebGL/WebCodecs preview.
- `TiramisuEditor`: editor-style WebGL API (tracks, clips, effects).
- WebGL core: `TiramisuRenderer`, `TextureManager`, `ShaderManager`, `WebCodecsVideoSource`, shader constants.
- Types: `RenderConfig`, `WebGLRenderContext`, `Effect`, `ShaderUniform`.

## Server Render (MP4)

```ts
import { Tiramisu } from "tiramisu";

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
import { TiramisuPlayer } from "tiramisu/client";

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
import { TiramisuWebGLPlayer } from "tiramisu";

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
import { TiramisuEditor } from "tiramisu";

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
