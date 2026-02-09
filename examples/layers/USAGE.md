# Tiramisu Layers Feature - Usage Guide

## Overview

The Layers feature in Tiramisu allows you to create offscreen canvas buffers for isolated rendering and applying effects to specific elements. This enables complex video effects pipelines like:

```
Source Video → Color Correct → Mask → Blur → Final Output
```

## API Reference

### `layer.create(width?, height?)`

Creates a new offscreen layer/buffer.

- **Parameters:**
  - `width` (optional): Layer width in pixels. Defaults to main canvas width.
  - `height` (optional): Layer height in pixels. Defaults to main canvas height.

- **Returns:** A `Layer` object with the following properties and methods.

### Layer Object

#### Properties

- `canvas: HTMLCanvasElement` - The offscreen canvas element
- `ctx: CanvasRenderingContext2D` - The 2D rendering context for the layer
- `width: number` - Layer width
- `height: number` - Layer height

#### Methods

- **`clear()`** - Clear the layer to transparent

- **`drawTo(targetCtx, x?, y?, dw?, dh?)`** - Draw the layer to another context
  - `targetCtx`: Target canvas context to draw to
  - `x`: X position (default: 0)
  - `y`: Y position (default: 0)
  - `dw`: Destination width (optional)
  - `dh`: Destination height (optional)

- **`applyBlur(radius)`** - Apply blur effect
  - `radius`: Blur radius in pixels (0+)

- **`applyBrightness(amount)`** - Adjust brightness
  - `amount`: Adjustment amount (-1 to 1)

- **`applyContrast(amount)`** - Adjust contrast
  - `amount`: Contrast factor (0 = gray, 1 = normal, 2 = high contrast)

- **`applyTint(color)`** - Apply color tint
  - `color`: CSS color string (e.g., "rgba(255,0,0,0.5)")

- **`applyGrayscale()`** - Convert to grayscale

## Usage Examples

### Basic Layer Creation

```typescript
player.addClip(0, 5, ({ ctx, width, height, layer }) => {
    // Create a layer same size as main canvas
    const myLayer = layer.create();

    // Draw to the layer
    myLayer.ctx.fillStyle = "red";
    myLayer.ctx.fillRect(50, 50, 100, 100);

    // Draw layer to main canvas
    myLayer.drawTo(ctx);
}, 1);
```

### Custom Layer Size

```typescript
player.addClip(0, 5, ({ layer }) => {
    // Create a smaller layer
    const smallLayer = layer.create(200, 200);

    smallLayer.ctx.fillStyle = "blue";
    smallLayer.ctx.fillRect(0, 0, 200, 200);

    // Draw to main canvas at specific position
    smallLayer.drawTo(ctx, 100, 100);
}, 1);
```

### Applying Effects

```typescript
player.addClip(0, 5, ({ ctx, width, height, layer, videos, data }) => {
    // Create layer
    const videoLayer = layer.create(width, height);

    // Draw video to layer
    if (videos["myVideo"]) {
        videoLayer.ctx.drawImage(videos["myVideo"], 0, 0, width, height);
    }

    // Apply effects
    videoLayer.applyBlur(10);                    // Blur radius 10px
    videoLayer.applyBrightness(0.2);             // Increase brightness
    videoLayer.applyContrast(1.3);               // Increase contrast
    videoLayer.applyTint("rgba(255, 0, 0, 0.3)"); // Red tint
    videoLayer.applyGrayscale();                  // Convert to grayscale

    // Draw processed layer to main canvas
    videoLayer.drawTo(ctx);
}, 1);
```

### Multi-Layer Compositing

```typescript
player.addClip(0, 5, ({ ctx, width, height, layer }) => {
    // Layer 1: Background
    const bgLayer = layer.create(width, height);
    bgLayer.ctx.fillStyle = "#1a1a1a";
    bgLayer.ctx.fillRect(0, 0, width, height);
    bgLayer.drawTo(ctx);

    // Layer 2: Content with blur
    const contentLayer = layer.create(width, height);
    contentLayer.ctx.fillStyle = "blue";
    contentLayer.ctx.fillRect(100, 100, 300, 200);
    contentLayer.applyBlur(20);
    contentLayer.drawTo(ctx);

    // Layer 3: Sharp overlay
    const overlayLayer = layer.create(width, height);
    overlayLayer.ctx.fillStyle = "white";
    overlayLayer.ctx.font = "bold 24px sans-serif";
    overlayLayer.ctx.fillText("Overlay Text", 150, 200);
    overlayLayer.drawTo(ctx);
}, 1);
```

### Video Effects Pipeline

```typescript
player.addClip(0, 10, ({ ctx, width, height, layer, videos }) => {
    const video = videos["input.mp4"];
    if (!video) return;

    // Step 1: Draw original video
    const originalLayer = layer.create(width, height);
    originalLayer.ctx.drawImage(video, 0, 0, width, height);

    // Step 2: Create blurred version for background
    const blurredLayer = layer.create(width, height);
    blurredLayer.ctx.drawImage(video, 0, 0, width, height);
    blurredLayer.applyBlur(15);
    blurredLayer.applyBrightness(-0.2);
    blurredLayer.drawTo(ctx);

    // Step 3: Create sharp vignette
    const vignetteLayer = layer.create(width, height);
    const gradient = vignetteLayer.ctx.createRadialGradient(
        width/2, height/2, 0,
        width/2, height/2, width * 0.7
    );
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(1, "rgba(0,0,0,0.8)");
    vignetteLayer.ctx.fillStyle = gradient;
    vignetteLayer.ctx.fillRect(0, 0, width, height);
    vignetteLayer.drawTo(ctx);

    // Step 4: Draw original in center
    ctx.save();
    ctx.globalCompositeOperation = "source-atop";
    originalLayer.drawTo(ctx, width * 0.25, height * 0.25, width * 0.5, height * 0.5);
    ctx.restore();
}, 1);
```

## Performance Considerations

1. **Layer Creation**: Creating layers is relatively fast, but creating many layers per frame can impact performance.

2. **Pixel Manipulation**: Effects like `applyBlur`, `applyBrightness`, etc. use `getImageData`/`putImageData` which can be slow for large canvases. Use sparingly or on smaller layers.

3. **Reuse**: Consider reusing layers when possible instead of creating new ones each frame.

4. **Size**: Smaller layers are faster to process. If you only need to apply effects to a small region, create a smaller layer.

## Browser Compatibility

The Layers feature uses the HTML5 Canvas 2D API and works in all modern browsers that support:
- `document.createElement('canvas')`
- `CanvasRenderingContext2D.getImageData()`
- `CanvasRenderingContext2D.putImageData()`

## Server-Side Rendering

The Layers feature works identically in both:
- **Browser Preview** (TiramisuPlayer)
- **Server Rendering** (Tiramisu with Puppeteer)

This means your effects will look the same in the live preview as in the final rendered video.
