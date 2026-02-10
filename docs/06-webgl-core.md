# WebGL Core (GPU Playback + Effects)

The WebGL pipeline is built around a video texture pipeline and shader effects. It is designed for real-time previews in the browser.

## TiramisuWebGLPlayer

```ts
import { TiramisuWebGLPlayer } from "tiramisu";

const player = new TiramisuWebGLPlayer({
  canvas: "gl-canvas",
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

## WebGL Components

- `TiramisuRenderer`: manages shader programs, ping-pong framebuffers, and drawing to the canvas.
- `TextureManager`: uploads `VideoFrame` objects and manages a texture pool.
- `ShaderManager`: loads built-in shaders and creates `Effect` objects.
- `WebCodecsVideoSource`: decodes MP4 frames via MP4Box + WebCodecs.

## WebCodecs Notes

- `WebCodecsVideoSource` expects MP4Box to be available globally as `MP4Box`.
- For bundled apps, import MP4Box and expose it on `window` before initializing the player.

## Custom Shaders

```ts
import { PASSTHROUGH_VERTEX_SHADER } from "tiramisu";

const renderer = player.getRenderer();
const shaderManager = player.getShaderManager();

const myFragment = `
precision mediump float;
varying vec2 v_texCoord;
uniform sampler2D u_sourceTexture;
void main() {
  vec4 c = texture2D(u_sourceTexture, v_texCoord);
  gl_FragColor = vec4(c.rgb * 1.1, c.a);
}`;

shaderManager.loadShader("boost", PASSTHROUGH_VERTEX_SHADER, myFragment);
player.addEffect(shaderManager.createCustomEffect("boost", {}));
```

## WebGL Render Context

`TiramisuWebGLPlayer.createWebGLRenderContext()` creates a context object compatible with the 2D render context but with additional WebGL fields and a `webglLayer.create()` helper.
