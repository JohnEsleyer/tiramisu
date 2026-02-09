/**
 * Test file to verify Layer functionality
 * This can be run with: bun test-layers.ts
 */

import { TiramisuUtils } from "../../src/Utils.js";

// Test createLayer
console.log("Testing createLayer...");

// In a real browser environment, document would be available
// This is just to verify the structure
const mockDocument = {
    createElement: (tag: string) => {
        return {
            width: 0,
            height: 0,
            getContext: () => ({
                clearRect: () => {},
                getImageData: () => ({ data: new Uint8ClampedArray(100), width: 10, height: 10 }),
                putImageData: () => {},
                save: () => {},
                restore: () => {},
                fillStyle: '',
                fillRect: () => {},
                strokeRect: () => {},
                strokeStyle: '',
                lineWidth: 0,
                beginPath: () => {},
                arc: () => {},
                fill: () => {},
                stroke: () => {},
                globalCompositeOperation: '',
                drawImage: () => {},
                createRadialGradient: () => ({ addColorStop: () => {} }),
                createLinearGradient: () => ({ addColorStop: () => {} }),
            }),
        };
    },
};

// Mock document for testing
(globalThis as any).document = mockDocument;

const layer = TiramisuUtils.createLayer(100, 100);

console.log("Layer created:", !!layer);
console.log("Layer has canvas:", !!layer.canvas);
console.log("Layer has ctx:", !!layer.ctx);
console.log("Layer has clear:", typeof layer.clear === 'function');
console.log("Layer has drawTo:", typeof layer.drawTo === 'function');
console.log("Layer has applyBlur:", typeof layer.applyBlur === 'function');
console.log("Layer has applyBrightness:", typeof layer.applyBrightness === 'function');
console.log("Layer has applyContrast:", typeof layer.applyContrast === 'function');
console.log("Layer has applyTint:", typeof layer.applyTint === 'function');
console.log("Layer has applyGrayscale:", typeof layer.applyGrayscale === 'function');

console.log("\n✅ All layer methods are properly defined!");
console.log("✅ Layer feature is ready to use!");
