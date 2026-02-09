# Assets and Video

## Preloading Assets
Tiramisu ensures all assets are fully loaded before rendering begins.

```typescript
const config = {
    assets: ["./logo.png"],
    fonts: [{ name: "MainFont", url: "/fonts/main.ttf" }],
    videos: ["/background.mp4"]
};
```
