# Utilities and Math

Tiramisu injects a `utils` object into every frame.

## Deterministic Randomness
**Important:** Do not use `Math.random()`. If you do, your video will flicker (e.g., particles jumping to new positions every time a frame is re-rendered).

Use `utils.seededRandomGenerator(seed)` (Mulberry32 implementation):
```typescript
const rng = utils.seededRandomGenerator(12345);
const x = rng() * width; // Always yields the same result for this seed.
```
