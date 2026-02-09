# Compositing & Layers Demo

This example demonstrates **Phase 1: Compositing & Layers** functionality added to Tiramisu.

## Features

The new layer system allows you to:

1. **Isolate Elements** - Create offscreen canvases for different visual elements
2. **Apply Filters** - Use CSS filters (blur, grayscale, brightness, etc.) on specific layers
3. **Blend Modes** - Composite layers with different blend modes (multiply, overlay, screen, etc.)
4. **Independent Processing** - Modify layers destructively before compositing

## New Utils Methods

### `createLayer(width, height)`
Creates an offscreen layer (canvas) for isolated rendering.

```typescript
const bgLayer = utils.createLayer(width, height);
bgLayer.ctx.fillStyle = "blue";
bgLayer.ctx.fillRect(0, 0, width, height);
```

### `applyFilter(layer, filterString)`
Applies a destructive CSS filter to a layer. The filter modifies the layer's pixels permanently.

```typescript
utils.applyFilter(bgLayer, "blur(10px) brightness(0.8)");
```

### `drawLayer(destCtx, layer, options?)`
Composites a layer onto the destination context with optional settings.

```typescript
utils.drawLayer(ctx, bgLayer, {
    x: 0,
    y: 0,
    opacity: 0.8,
    blendMode: 'multiply',
    filter: 'hue-rotate(45deg)'
});
```

## Demo Features

This specific demo showcases:

- **Variable Blur Background**: The video background blur amount animates based on playback progress (0-20px)
- **Brightness Adjustment**: Background is darkened to 80% brightness
- **Sharp Text Layer**: Text rendered on a separate layer remains crisp
- **Floating Text Animation**: Text position animates with a sine wave
- **Clean Separation**: Video processing doesn't affect text rendering

## Usage

1. Open `index.html` in a browser
2. Upload a video file
3. Click "Play Preview" to see the animated blur effect

The blur will pulse smoothly, demonstrating that only the background layer is filtered while the text stays sharp.

## Technical Details

### Before (Phase 0)
```typescript
// Everything on one canvas - filters affect everything
ctx.filter = "blur(10px)";
utils.drawMediaCover(ctx, video, width, height);
ctx.filter = "none";
ctx.fillText("Text", x, y); // Text would be blurry
```

### After (Phase 1)
```typescript
// Isolated layers - independent processing
const bgLayer = utils.createLayer(width, height);
utils.drawMediaCover(bgLayer.ctx, video, width, height);
utils.applyFilter(bgLayer, "blur(10px)");
utils.drawLayer(ctx, bgLayer); // Blur only affects video

const textLayer = utils.createLayer(width, height);
textLayer.ctx.fillText("Text", x, y);
utils.drawLayer(ctx, textLayer); // Text is sharp
```

## Browser Compatibility

The compositing system works in both:
- **Browser Preview** (TiramisuPlayer)
- **Server Rendering** (Tiramisu with Puppeteer)

The same code runs in both environments!
