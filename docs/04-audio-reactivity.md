```markdown
# Audio Reactivity

Tiramisu provides a bridge between Web Audio (browser) and PCM Analysis (server).

## The WASM Analyzer
To ensure that the frequency bars you see in the browser preview look identical in the final MP4, Tiramisu uses a **Rust-powered Audio Analyzer**. 

### Frequency Bands (`audioBands`)
`audioBands` is an array of 32 normalized values (0.0 to 1.0) representing the frequency spectrum from Bass to Treble.

```typescript
({ ctx, audioBands, width, height }) => {
    audioBands.forEach((val, i) => {
        const h = val * 300;
        ctx.fillRect(i * 40, height - h, 30, h);
    });
}
```

### Volume (`audioVolume`)
A single float representing the overall "loudness" (RMS) of the current frame. Useful for pulsing effects or camera shakes.
```typescript
const scale = 1 + audioVolume * 0.2;
ctx.scale(scale, scale);
```
