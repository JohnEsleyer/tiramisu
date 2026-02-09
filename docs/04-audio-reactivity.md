# Audio Reactivity

Tiramisu provides 1:1 parity between browser audio previews and final renders.

## The WASM Analyzer
Browsers use the Web Audio API (FFT) for visualizers. To match this on the server, Tiramisu includes a **Rust-powered Audio Analyzer** (`src/rust_audio`) that implements:
- Blackman Windowing.
- DC Blocker Filter (to prevent jittery bass bars).
- Temporal Smoothing.

### Usage in Clips

#### 1. Frequency Bands (`audioBands`)
An array of 32 normalized floats (0.0 to 1.0).
```typescript
({ ctx, audioBands, width, height }) => {
    audioBands.forEach((val, i) => {
        const barH = val * 200;
        ctx.fillRect(i * 20, height - barH, 15, barH);
    });
}
```
