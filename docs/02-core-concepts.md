# Core Concepts

## The Timeline
Tiramisu operates on a linear timeline. You register **Clips** to occupy specific segments of time.

## `addClip(start, duration, drawFunction, zIndex)`
- **start**: Start time in seconds.
- **duration**: How long the clip lasts.
- **drawFunction**: The logic executed every frame.
- **zIndex**: Higher numbers render on top (default is 0).

## The Render Context
Every `drawFunction` receives a `RenderContext` object. This is your toolbox for the current frame:

| Property | Type | Description |
| :--- | :--- | :--- |
| `ctx` | `CanvasRenderingContext2D` | The standard Canvas API. |
| `frame` | `number` | The global frame index. |
| `progress` | `number` | Total video progress (0.0 to 1.0). |
| `localProgress` | `number` | Progress (0.0 to 1.0) specific to this clip. |
| `audioVolume` | `number` | Normalized RMS volume (0.0 to 1.0). |
| `audioBands` | `number[]` | 32 frequency bands (0.0 to 1.0) from Bass to Treble. |
| `utils` | `TiramisuUtils` | Math and drawing helpers (Easings, Masking). |
| `data` | `any` | Custom state passed via `RenderConfig`. |
| `assets` | `Record` | Preloaded `HTMLImageElement` objects. |
| `videos` | `Record` | Preloaded `HTMLVideoElement` (Client) or Frame references (Server). |
