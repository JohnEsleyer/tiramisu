```markdown
# Utilities and Math

Tiramisu injects a `utils` object into every frame to solve common video-creation problems.

## Deterministic Randomness
**Critical:** Never use `Math.random()` in a video engine. If you do, your animation will flicker because every time a frame is re-rendered, it will get a different value.

Use `utils.seededRandomGenerator(seed)`:
```typescript
const rng = utils.seededRandomGenerator(12345);
const x = rng() * width; // This will ALWAYS be the same for this specific clip/frame.
```

## Easings
Standard easing functions are built-in:
- `utils.easeOutCubic(t)`
- `utils.easeInQuad(t)`
- `utils.easeOutBounce(t)`

## Stencil Masking
The `utils.drawMasked` helper allows you to draw content (like a video) into a specific shape (like text).

```typescript
utils.drawMasked(
    ctx,
    (c) => c.drawImage(myVideo, 0, 0), // Content
    (c) => c.fillText("HELLO", 100, 100) // Mask
);
```
