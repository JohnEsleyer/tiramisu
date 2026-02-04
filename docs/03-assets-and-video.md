```markdown
# Assets and Video

## Preloading Assets
Tiramisu ensures all assets are fully loaded before the first frame is rendered. Define them in the `RenderConfig`:

```typescript
const config = {
    assets: ["./logo.png", "./background.jpg"],
    fonts: [{ name: "BrandFont", url: "/fonts/brand.ttf" }],
    videos: ["/intro.mp4"]
};
```

## Video Synchronization
Handling video in a frame-by-frame engine is tricky. Tiramisu handles this automatically:

1.  **Client-side**: The player seeks the `<video>` element to the exact timestamp matching the current frame.
2.  **Server-side**: The engine uses `VideoManager` to extract the video into a frame-cache (`.tiramisu-cache`). Each frame is served to Puppeteer as a high-quality JPG to ensure zero frame-drops.

## Media Helpers
Use the `utils` to handle aspect-ratio logic easily:
- `utils.drawMediaFit`: Letterboxes the video to fit the area.
- `utils.drawMediaCover`: Crops the video to fill the area (like `object-fit: cover`).

```typescript
({ ctx, width, height, videos, utils }) => {
    const vid = videos["/intro.mp4"];
    utils.drawMediaCover(ctx, vid, width, height);
}
```
