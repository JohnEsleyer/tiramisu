# Effects And Transitions

## Built-In WebGL Effects

The `ShaderManager` ships with these shader IDs:

- `grayscale`
- `blur`
- `brightness`
- `tint`
- `chromakey`
- `vignette`
- `saturation`
- `lut`

The `ShaderManager` also includes convenience creators:

- `createGrayscaleEffect(strength)`
- `createBlurEffect(radius, { width, height }, direction)`
- `createBrightnessEffect(brightness, contrast)`
- `createTintEffect({ r, g, b }, strength)`
- `createChromaKeyEffect(keyColor, threshold, softness, spillReduction)`
- `createVignetteEffect(intensity, radius)`
- `createSaturationEffect(saturation)`
- `createLUTEffect(lutTexture, intensity)`

## Effect Chains

```ts
const shaderManager = player.getShaderManager();
const chain = shaderManager.createEffectChain([
  shaderManager.createBrightnessEffect(0.1, 1.2),
  shaderManager.createTintEffect({ r: 1, g: 0.9, b: 0.8 }, 0.3),
]);
chain.forEach((effect) => player.addEffect(effect));
```

Preset chains include `createVintageEffect()`, `createCinematicEffect()`, and `createBlackAndWhiteEffect()`.

## LUTs

```ts
import { LUTLoader } from "tiramisu";

const lut = await LUTLoader.loadFromURL(gl, "/luts/teal_orange.cube");
player.addEffect(shaderManager.createLUTEffect(lut, 1.0));
```

## Transitions (GLTransitionManager)

The transition system is modeled after gl-transitions. The `GL_TRANSITIONS` registry contains built-in definitions such as:

- `Crossfade`
- `CrossZoom`
- `Doorway`
- Additional shader-based transitions defined in `src/webgl/transitions/GLTransitionManager.ts`

Example usage:

```ts
import { GLTransitionManager } from "tiramisu";

const transitionManager = new GLTransitionManager(shaderManager);
transitionManager.registerAllTransitions();

const effect = transitionManager.createTransitionEffect("Crossfade", 0.5);
if (effect) player.addEffect(effect);
```

Transitions are shader programs that expect two input textures. Integrating them into a full multi-clip timeline requires a compositor that can bind the `u_texture1` and `u_texture2` inputs per frame.
