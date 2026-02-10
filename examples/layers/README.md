# Tiramisu Layers Demo

This example demonstrates the new **Offscreen Buffers / Layers** feature in Tiramisu.

## What are Layers?

Layers are offscreen canvas buffers that allow you to:
- Draw content in isolation from the main canvas
- Apply effects (blur, brightness, contrast, tint, grayscale) to specific elements
- Composite multiple layers with blend modes
- Build complex video effects pipelines like: `Source → Color Correct → Mask → Blur → Final Output`

## Features Demonstrated

1. **Creating Layers**: Use `layer.create(width, height)` to create an offscreen buffer
2. **Drawing to Layers**: Use the layer's `ctx` property to draw on it
3. **Applying Effects**:
   - `applyBlur(radius)` - Blur the layer contents
   - `applyBrightness(amount)` - Adjust brightness (-1 to 1)
   - `applyContrast(amount)` - Adjust contrast (0 to 2+)
   - `applyTint(color)` - Apply a color tint
   - `applyGrayscale()` - Convert to grayscale
4. **Compositing**: Use `drawTo(targetCtx)` to draw the processed layer to the main canvas

## Usage Example

```typescript
player.addClip(0, 5, ({ ctx, width, height, layer, data }) => {
    // Create an isolated layer
    const videoLayer = layer.create(width, height);

    // Draw video to the layer
    videoLayer.ctx.drawImage(video, 0, 0, width, height);

    // Apply effects to the layer
    videoLayer.applyBlur(10);
    videoLayer.applyBrightness(0.2);
    videoLayer.applyContrast(1.3);

    // Draw processed layer to main canvas
    videoLayer.drawTo(ctx);
}, 1);
```

## Controls

- **Blur**: Adjust the blur radius of the animated circles
- **Brightness**: Adjust the brightness of the animated circles
- **Contrast**: Adjust the contrast of the animated circles
- **Grayscale**: Toggle grayscale effect on/off
- **Play/Pause**: Control animation playback

## Building the Example

```bash
cd examples/layers
bun build app.ts --outdir . --target browser
```

Then open `index.html` in a browser.
