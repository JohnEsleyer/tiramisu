# Types And Configuration

## RenderConfig

```ts
export interface RenderConfig<T = any> {
  width: number;
  height: number;
  fps: number;
  durationSeconds: number;
  outputFile?: string;

  headless?: boolean;
  audioFile?: string;
  assets?: string[];
  videos?: string[];
  fonts?: { name: string; url: string }[];
  data?: T;
  canvas?: HTMLCanvasElement | string;
  parallel?: number;

  webgl?: boolean;
  webglContextAttributes?: WebGLContextAttributes;
  webcodecs?: boolean;
}
```

Notes:

- `outputFile` is required for server-side rendering.
- `canvas` is required for client-side preview.
- `data` is serialized and sent to the browser during server rendering.

## Clip

```ts
export interface Clip<T = any> {
  id: string;
  startFrame: number;
  endFrame: number;
  zIndex: number;
  drawFunction: string | DrawFunction<T>;
}
```

## Render Context

Core fields passed to draw functions:

- Timeline: `frame`, `progress`, `localFrame`, `localProgress`
- Audio: `audioVolume`, `audioBands`
- Media: `assets`, `videos`
- Utilities: `utils`, `layer.create`

## WebGL Types

- `Effect`: shader ID, uniforms, and enabled state.
- `ShaderUniform`: number, number array, boolean, or `WebGLTexture`.
- `WebGLRenderContext`: extends the 2D context with `gl`, `program`, `sourceTexture`, and `webglLayer.create()`.
