# Server Rendering (MP4 Export)

Server rendering uses a headless browser to draw frames and pipes them into FFmpeg. This yields a deterministic MP4 with optional audio.

## Basic Render

```ts
import { Tiramisu } from "tiramisu";

const engine = new Tiramisu({
  width: 1280,
  height: 720,
  fps: 30,
  durationSeconds: 5,
  outputFile: "output.mp4",
});

engine.addClip(0, 5, ({ ctx, width, height, localProgress }) => {
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "white";
  ctx.font = "bold 80px sans-serif";
  ctx.fillText(`Tiramisu ${Math.round(localProgress * 100)}%`, 80, 140);
});

await engine.render();
```

## Parallel Rendering

```ts
const engine = new Tiramisu({
  width: 1920,
  height: 1080,
  fps: 30,
  durationSeconds: 10,
  outputFile: "output.mp4",
  parallel: 4,
});
```

Parallel mode divides the frame range into chunks and renders them with Web Workers, then concatenates the result.

## Assets, Video, And Audio

```ts
const engine = new Tiramisu({
  width: 1920,
  height: 1080,
  fps: 30,
  durationSeconds: 8,
  outputFile: "output.mp4",
  audioFile: "assets/music.mp3",
  assets: ["assets/logo.png"],
  videos: ["assets/clip.mp4"],
  data: {
    title: "Launch",
    useVideoElement: false,
  },
});
```

Notes:

- `assets` and `videos` are served by an internal HTTP server rooted at your project directory.
- Video frames are pulled via WebCodecs when available. If you need to force `<video>` element decoding, pass `data.useVideoElement = true`.
- Audio analysis uses FFmpeg and a WASM analyzer to populate `audioVolume` and `audioBands`.

## Draw Function Constraints

Because the server serializes the draw function to a string:

- Avoid closures and external variables.
- Use `data` for dynamic values.
- Use local helpers or inline logic.

## Progress Reporting

```ts
await engine.render((progress) => {
  console.log(progress.frame, progress.total, progress.percent, progress.eta);
});
```

`progress.eta` is the estimated time in seconds remaining.
