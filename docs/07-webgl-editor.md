# WebGL Editor API

`TiramisuEditor` provides an editor-style API with tracks, clips, and effect stacks. It is currently optimized for WebGL previews.

## Basic Usage

```ts
import { TiramisuEditor } from "@johnesleyer/tiramisu";

const editor = new TiramisuEditor({
  canvas: "gl-canvas",
  width: 1920,
  height: 1080,
  fps: 30,
  durationSeconds: 10,
});

const clipA = editor.addVideo("/video/a.mp4", { start: 0, duration: 5, track: 1 });
const clipB = editor.addVideo("/video/b.mp4", { start: 5, duration: 5, track: 1 });

editor.addEffectToClip(clipA.id, "BrightnessContrast", { brightness: 0.1, contrast: 1.2 });
editor.addEffectToClip(clipB.id, "Vignette", { intensity: 0.6, radius: 0.8 });

editor.play();
```

## Tracks

- Use `createTrack(trackId, name)` to create a track.
- `getAllTracks()` returns tracks sorted by `zIndex`.
- Track `solo` and `muted` flags control visibility.

## Clips

- `addVideo(source, { start, duration, track })` creates a clip.
- Each clip has an `effects` stack and optional `transform`.
- The editor automatically loads the source via WebCodecs.

## Effects

`addEffectToClip` supports convenience types:

- `BrightnessContrast`
- `Vignette`
- `ChromaKey`
- Custom shader IDs loaded in `ShaderManager`

## Transitions And Adjustment Layers

Transitions and adjustment layers are defined in the API but not yet rendered in the current implementation. They are stored for future pipeline integration.

## Export

`editor.export()` is declared but not implemented. For final renders, use the server-side `Tiramisu` renderer for now.
