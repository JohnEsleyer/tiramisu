# Client Preview (Canvas 2D)

The `TiramisuPlayer` runs the same clip-based logic in the browser for previews and interactive playback.

## Basic Usage

```ts
import { TiramisuPlayer } from "@johnesleyer/tiramisu/client";

const player = new TiramisuPlayer({
  canvas: "preview",
  width: 1280,
  height: 720,
  fps: 30,
  durationSeconds: 5,
  assets: ["/img/logo.png"],
  videos: ["/video/clip.mp4"],
  audioFile: "/audio/track.mp3",
  data: { title: "Preview" },
});

player.addClip(0, 5, ({ ctx, width, height, assets, videos, progress }) => {
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(assets["/img/logo.png"], 40, 40, 200, 200);
  ctx.drawImage(videos["/video/clip.mp4"], 300, 100, 640, 360);

  ctx.fillStyle = "white";
  ctx.font = "bold 48px sans-serif";
  ctx.fillText(`Progress: ${Math.round(progress * 100)}%`, 40, 700);
});

await player.load();
player.play();
```

## Controls

- `player.play()`
- `player.pause()`
- `player.seek(seconds)`
- `player.renderFrame(frameNumber)`

## Audio Notes

- Audio playback is driven by the Web Audio API and often requires a user gesture before `play()`.
- `audioVolume` and `audioBands` are available in the draw context for reactive visuals.

## Fonts

```ts
const player = new TiramisuPlayer({
  canvas: "preview",
  width: 1280,
  height: 720,
  fps: 30,
  durationSeconds: 5,
  fonts: [{ name: "Display", url: "/fonts/Display.otf" }],
});
```

The font is loaded with `FontFace` and added to `document.fonts` during `load()`.
