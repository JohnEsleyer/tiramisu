# Core Concepts

## The Timeline
Tiramisu operates on a linear timeline defined in seconds. You register code blocks called **Clips** to occupy specific segments of that timeline.

## `addClip(start, duration, drawFunction, zIndex)`
- **start**: Start time in seconds.
- **duration**: How long the clip lasts.
- **drawFunction**: The logic executed every frame.
- **zIndex**: Higher numbers render on top of lower numbers.

## The Render Context
Every `drawFunction` receives a `RenderContext` object. This is your toolbox for the current frame:

| Property | Description |
| :--- | :--- |
| `ctx` | Standard HTML5 Canvas 2D Context. |
| `frame` | The global frame index (starts at 0). |
| `progress` | Global progress (0.0 to 1.0) of the entire video. |
| `localProgress` | Progress (0.0 to 1.0) specific to the current clip. |
| `utils` | Injected helper library (Easings, Math, etc.). |
| `audioVolume` | Normalized RMS volume (0.0 to 1.0). |
| `data` | Custom state object passed via config. |