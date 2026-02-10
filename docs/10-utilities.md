# Utilities

`TiramisuUtils` provides common helpers for animation, math, and 2D composition.

## Math Helpers

- `lerp(start, end, t)`
- `clamp(val, min, max)`
- `remap(value, low1, high1, low2, high2)`
- `toRad(deg)`

## Easing

- `easeInQuad`, `easeOutQuad`, `easeInOutQuad`
- `easeInCubic`, `easeOutCubic`
- `easeOutBounce`

## Media Fitting

- `drawMediaFit(ctx, media, targetW, targetH)`
- `drawMediaCover(ctx, media, targetW, targetH)`

These helpers preserve aspect ratio for images or videos in contain or cover mode.

## Masked Drawing

```ts
utils.drawMasked(ctx,
  (c) => c.drawImage(videos["clip.mp4"], 0, 0, width, height),
  (c) => {
    c.fillStyle = "white";
    c.font = "bold 200px sans-serif";
    c.fillText("MASK", 100, 300);
  }
);
```

## Layers (Offscreen Buffers)

```ts
const layer = utils.createLayer(width, height);
layer.clear();
layer.ctx.fillStyle = "rgba(255,255,255,0.2)";
layer.ctx.fillRect(0, 0, width, height);
layer.applyBlur(6);
layer.drawTo(ctx);
```

Layers are useful for isolated compositing and pixel-based effects.
