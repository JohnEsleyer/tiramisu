# Core Concepts

## Clip-Based Timeline

Tiramisu uses a clip-based timeline. A clip has:

- `startFrame` and `endFrame` (derived from seconds and FPS)
- `zIndex` (draw order)
- a draw function that renders a single frame

Clips are composited in order by `zIndex` and evaluated per frame.

## Render Context

Draw functions receive a context object that includes:

- Timeline data: `frame`, `progress`, `localFrame`, `localProgress`
- Canvas: `ctx`, `canvas`, `width`, `height`, `fps`
- Audio: `audioVolume`, `audioBands`
- Assets: `assets`, `videos`
- Utilities: `utils` with easing, lerp, media-fit helpers
- Layers: `layer.create()` for offscreen buffers

## Server vs Client Execution

- Server: draw functions are stringified, sent to a headless browser, and executed there. Keep closures pure and pass data through `RenderConfig.data`.
- Client: draw functions run directly in the browser or on the page.

## WebGL Mode

WebGL mode replaces 2D canvas effects with shader-based pipelines. Instead of drawing to the canvas, you upload video frames to textures, apply effect stacks, and render back to the canvas.
