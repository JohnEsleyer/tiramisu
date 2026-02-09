# Phase 1: Compositing & Layers - Implementation Summary

## Overview

Phase 1 adds a powerful **offscreen layer compositing system** to Tiramisu, enabling advanced video effects that were previously impossible with the single-canvas approach.

## What Was Added

### 1. New Type Definitions (`src/types.ts`)

```typescript
// Represents an offscreen rendering layer
export interface OffscreenLayer {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    width: number;
    height: number;
}

// Options for compositing layers
export interface LayerOptions {
    opacity?: number;
    blendMode?: GlobalCompositeOperation;
    filter?: string;
    x?: number;
    y?: number;
}
```

### 2. New Utils Functions (`src/Utils.ts`)

#### `createLayer(width, height)`
Creates an isolated offscreen canvas for rendering.

**Use case:** Separate video backgrounds from text overlays.

```typescript
const bgLayer = utils.createLayer(1280, 720);
bgLayer.ctx.fillStyle = "blue";
bgLayer.ctx.fillRect(0, 0, 1280, 720);
```

#### `applyFilter(layer, filterString)`
Applies CSS filters destructively to a layer's pixels.

**Use case:** Blur or desaturate specific elements without affecting others.

```typescript
utils.applyFilter(bgLayer, "blur(10px) grayscale(50%)");
```

#### `drawLayer(destCtx, layer, options?)`
Composites a layer onto the destination canvas with advanced options.

**Use case:** Apply blend modes, opacity, or real-time filters during composition.

```typescript
utils.drawLayer(ctx, bgLayer, {
    opacity: 0.8,
    blendMode: 'multiply',
    x: 50,
    y: 100
});
```

### 3. Example Application (`examples/compositing-demo/`)

A complete working example demonstrating:
- Variable blur on video background (0-20px animated)
- Brightness filter applied to background
- Sharp text overlay unaffected by filters
- Floating text animation
- Clean layer separation

Files:
- `app.ts` - Client-side implementation
- `index.html` - Demo UI
- `bundle.js` - Compiled browser bundle
- `README.md` - Documentation

## Key Benefits

### Before Phase 1
```typescript
// Single canvas - filters affect everything
ctx.filter = "blur(10px)";
utils.drawMediaCover(ctx, video, width, height);
ctx.filter = "none"; // Reset
ctx.fillText("Text", x, y); // Still might be affected
```

### After Phase 1
```typescript
// Isolated layers - independent processing
const bgLayer = utils.createLayer(width, height);
utils.drawMediaCover(bgLayer.ctx, video, width, height);
utils.applyFilter(bgLayer, "blur(10px)");
utils.drawLayer(ctx, bgLayer);

const textLayer = utils.createLayer(width, height);
textLayer.ctx.fillText("Text", x, y);
utils.drawLayer(ctx, textLayer); // Sharp and clear!
```

## Technical Details

### Browser & Server Compatibility

All three new functions work in:
- **Browser Preview** (`TiramisuPlayer` in `src/Client.ts`)
- **Server Rendering** (`Tiramisu` with Puppeteer in `src/Tiramisu.ts`)

The `BROWSER_UTILS_CODE` exports ensure that the same API is available in both environments.

### Filter Options

Supports all CSS filter functions:
- `blur(Xpx)` - Gaussian blur
- `brightness(X)` - Brightness adjustment (0-2+)
- `contrast(X%)` - Contrast adjustment
- `grayscale(X%)` - Desaturation
- `hue-rotate(Xdeg)` - Color shift
- `saturate(X%)` - Saturation adjustment
- `sepia(X%)` - Sepia tone
- And more!

Filters can be chained: `"blur(5px) brightness(0.8) contrast(120%)"`

### Blend Modes

Supports all `GlobalCompositeOperation` modes:
- `source-over` (default) - Normal
- `multiply` - Darkens
- `screen` - Lightens
- `overlay` - Contrast-based blend
- `darken`, `lighten` - Min/max blending
- `color-dodge`, `color-burn` - Photoshop-style effects
- And many more!

## Use Cases

1. **Cinematic Backgrounds** - Blur video backgrounds while keeping UI sharp
2. **Picture-in-Picture** - Composite multiple video sources with blend modes
3. **Color Grading** - Apply filters to specific elements (e.g., desaturate everything except one color)
4. **Depth Effects** - Simulate depth of field by blurring distant elements
5. **Creative Transitions** - Fade between layers with opacity and blend modes
6. **Text Effects** - Apply shadows, glows, or outlines using layer duplication and filtering

## Performance Considerations

- Each layer creates an additional canvas in memory
- Filters are applied once (destructive) - efficient for static effects
- For animated filters, recreate the layer each frame
- Limit the number of active layers (3-5 is reasonable for 1080p)

## Future Enhancements (Phase 2+)

Potential additions:
- Layer groups/hierarchies
- Non-destructive filter stacks
- Layer caching for repeated frames
- GPU-accelerated custom shaders
- Mask layers (alpha compositing)
- Layer transform matrices (rotation, scale, skew)

## Testing

To test the implementation:

```bash
# Build the example
cd examples/compositing-demo
bun build app.ts --outfile=bundle.js --target=browser

# Serve locally (e.g., with Python)
python3 -m http.server 8000

# Open http://localhost:8000/examples/compositing-demo/
```

Upload a video and watch the blur animation!

## API Stability

This is Phase 1 - the API is considered **stable** and will not have breaking changes. Future phases will add new features while maintaining backward compatibility.
