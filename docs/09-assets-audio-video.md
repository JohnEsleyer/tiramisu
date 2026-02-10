# Assets, Audio, And Video

## Assets

Images are preloaded and exposed as `assets` in the render context.

```ts
const engine = new Tiramisu({
  width: 1280,
  height: 720,
  fps: 30,
  durationSeconds: 5,
  outputFile: "output.mp4",
  assets: ["assets/logo.png"],
});

engine.addClip(0, 5, ({ ctx, assets }) => {
  ctx.drawImage(assets["assets/logo.png"], 40, 40, 200, 200);
});
```

## Videos

Video files are preloaded and exposed as `videos` in the render context.

- Client preview uses `<video>` elements.
- Server render uses WebCodecs by default and falls back to `<video>` elements if `data.useVideoElement` is true.

```ts
engine.addClip(0, 5, ({ ctx, videos }) => {
  ctx.drawImage(videos["assets/clip.mp4"], 0, 0, 1280, 720);
});
```

## Audio

Audio analysis produces:

- `audioVolume`: RMS volume in the range roughly `0..1`.
- `audioBands`: 32 normalized frequency bands.

Client preview uses the Web Audio API with an analyzer node. Server rendering uses FFmpeg + WASM analysis. If the WASM analyzer fails to load, the data defaults to silence.

## Deterministic Audio-Driven Animations

```ts
engine.addClip(0, 8, ({ ctx, width, height, audioBands }) => {
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, width, height);

  const band = audioBands[4] || 0;
  const size = 100 + band * 400;

  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, size, 0, Math.PI * 2);
  ctx.fill();
});
```
