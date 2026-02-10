# Offscreen Buffers / Layers Feature - Implementation Summary

## Overview

Implemented offscreen buffer layers for Tiramisu, enabling isolated rendering and effects application to specific elements. This allows building complex video effects pipelines like:
```
Source Video → Color Correct → Mask → Blur → Final Output
```

## Changes Made

### 1. Core Library Files

#### `src/types.ts`
- Added `Layer` interface defining the layer structure with methods:
  - `clear()`, `drawTo()`
  - `applyBlur()`, `applyBrightness()`, `applyContrast()`, `applyTint()`, `applyGrayscale()`
- Updated `RenderContext` interface to include `layer` property:
  ```typescript
  layer: {
      create: (width?: number, height?: number) => Layer;
  };
  ```

#### `src/Utils.ts`
- Added `createLayer()` function to `TiramisuUtils`:
  - Creates offscreen canvas with 2D context
  - Returns layer object with built-in effect methods
- Implemented effect methods:
  - **`applyBlur(radius)`**: Box blur using pixel manipulation
  - **`applyBrightness(amount)`**: RGB channel adjustment (-1 to 1 range)
  - **`applyContrast(amount)`**: Contrast scaling using standard formula
  - **`applyTint(color)`**: Color tinting using `source-atop` composite
  - **`applyGrayscale()`**: Luminance-based grayscale conversion
- Updated `BROWSER_UTILS_CODE` to include `createLayer` for Puppeteer compatibility

#### `src/Client.ts`
- Updated `renderFrame()` to pass `layer` object in render context:
  ```typescript
  layer: {
      create: (w?: number, h?: number) => {
          const width = w ?? this.config.width;
          const height = h ?? this.config.height;
          return TiramisuUtils.createLayer(width, height) as any;
      },
  }
  ```

#### `src/Browser.ts`
- Updated `setupScene()` to include `layer` in Puppeteer render context:
  ```typescript
  layer: {
      create: (lw?: number, lh?: number) => {
          const layerWidth = lw ?? w;
          const layerHeight = lh ?? h;
          return win.TiramisuUtils.createLayer(layerWidth, layerHeight);
      },
  }
  ```

### 2. Example Implementation

#### `examples/layers/`
Created complete example demonstrating layer functionality:

- **`index.html`**: Interactive UI with controls for:
  - Blur radius (0-20px)
  - Brightness adjustment (-0.5 to 0.5)
  - Contrast adjustment (0.5 to 2.0)
  - Grayscale toggle
  - Play/pause control

- **`app.ts`**: Four-layer composition demo:
  1. Animated gradient background
  2. Animated circles with real-time effects
  3. Vignette overlay with text
  4. Decorative border with glow effect

- **`README.md`**: Feature overview and getting started guide

- **`USAGE.md`**: Comprehensive API reference and usage examples

- **`test-layers.ts`**: Basic functionality test script

## API Design

### Layer Creation
```typescript
const myLayer = layer.create(width, height);
// or
const myLayer = layer.create();  // defaults to canvas size
```

### Drawing to Layer
```typescript
myLayer.ctx.drawImage(video, 0, 0, width, height);
myLayer.ctx.fillStyle = "red";
myLayer.ctx.fillRect(x, y, w, h);
```

### Applying Effects
```typescript
myLayer.applyBlur(10);              // Blur radius
myLayer.applyBrightness(0.2);       // Brightness boost
myLayer.applyContrast(1.3);        // Contrast boost
myLayer.applyTint("rgba(255,0,0,0.3)"); // Red tint
myLayer.applyGrayscale();           // Convert to grayscale
```

### Compositing
```typescript
myLayer.drawTo(ctx);  // Draw to main canvas
// or
myLayer.drawTo(ctx, x, y, w, h);  // With position and scaling
```

## Key Features

1. **Isolated Rendering**: Draw to offscreen buffers without affecting main canvas
2. **Effect Pipeline**: Chain multiple effects on a single layer
3. **Flexible Compositing**: Draw layers at any position/scale to main canvas
4. **Browser & Server**: Works identically in preview and final render
5. **Type Safety**: Full TypeScript support with Layer interface

## Use Cases

- Color grading with multiple adjustment layers
- Blur overlays for depth of field effects
- Tinting and color grading
- Multi-pass effects (blur → blend → blur)
- Selective effects on specific regions
- Video-in-text with post-processing
- Vignettes and overlays
- Glow effects with blur passes

## Performance Notes

- Layer creation is fast but should be reused when possible
- Pixel manipulation effects (blur, brightness, contrast) can be expensive on large canvases
- Smaller layers process faster - use minimal size needed for effect region

## Testing

- Verified compilation with Bun (`bun build`)
- Verified type correctness with TypeScript
- Created test script to validate layer API
- Example app demonstrates real-time performance

## Backward Compatibility

✅ **100% Backward Compatible**
- Existing code continues to work unchanged
- `layer` property is optional in render context
- No breaking changes to existing APIs

## Future Enhancements (Potential)

- Hardware-accelerated filters (WebGL-based)
- More blending modes in `drawTo()`
- Layer groups/nesting
- Built-in common effect presets
- Performance optimizations for large canvases
