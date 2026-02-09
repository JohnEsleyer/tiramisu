// A simple, fast, and deterministic Pseudo-Random Number Generator (Mulberry32)
const mulberry32 = (a: number) => {
    return function() {
        let t = a += 0x6d2b79f5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

export const TiramisuUtils = {
    lerp: (start: number, end: number, t: number) => start * (1 - t) + end * t,
    clamp: (val: number, min: number, max: number) => Math.min(Math.max(val, min), max),
    remap: (value: number, low1: number, high1: number, low2: number, high2: number) => {
        return low2 + (high2 - low2) * (value - low1) / (high1 - low1);
    },
    toRad: (deg: number) => deg * (Math.PI / 180),

    easeInQuad: (t: number) => t * t,
    easeOutQuad: (t: number) => t * (2 - t),
    easeInOutQuad: (t: number) => t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    easeInCubic: (t: number) => t * t * t,
    easeOutCubic: (t: number) => (--t) * t * t + 1,
    easeOutBounce: (t: number) => {
        const n1 = 7.5625; const d1 = 2.75;
        if (t < 1 / d1) return n1 * t * t;
        else if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
        else if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
        else return n1 * (t -= 2.625 / d1) * t + 0.984375;
    },

    /** Returns a deterministic, repeatable random number generator function */
    seededRandomGenerator: (seed: number) => mulberry32(seed),

    drawRoundedRect: (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
        if (w < 2 * r) r = w / 2; if (h < 2 * r) r = h / 2;
        ctx.beginPath(); ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    },

    /**
     * FIT (CONTAIN) MODE
     * Scales media to fit entirely within target dimensions with letterboxing.
     * Perfect for vertical videos in landscape canvases.
     */
    drawMediaFit: (ctx: CanvasRenderingContext2D, media: CanvasImageSource, targetW: number, targetH: number) => {
        if (!media) return;
        let sw = 0, sh = 0;
        if (media instanceof HTMLVideoElement) { sw = media.videoWidth; sh = media.videoHeight; }
        else if (media instanceof HTMLImageElement) { sw = media.naturalWidth || media.width; sh = media.naturalHeight || media.height; }
        if (sw === 0 || sh === 0) return;

        const targetRatio = targetW / targetH;
        const sourceRatio = sw / sh;
        let dw, dh, dx, dy;

        if (sourceRatio > targetRatio) {
            dw = targetW;
            dh = targetW / sourceRatio;
            dx = 0;
            dy = (targetH - dh) / 2;
        } else {
            dh = targetH;
            dw = targetH * sourceRatio;
            dx = (targetW - dw) / 2;
            dy = 0;
        }
        ctx.drawImage(media, dx, dy, dw, dh);
    },

    /**
     * COVER MODE
     * Scales media to fill the entire target area.
     */
    drawMediaCover: (ctx: CanvasRenderingContext2D, media: CanvasImageSource, targetW: number, targetH: number) => {
        if (!media) return;
        let sw = 0, sh = 0;
        if (media instanceof HTMLVideoElement) { sw = media.videoWidth; sh = media.videoHeight; }
        else if (media instanceof HTMLImageElement) { sw = media.naturalWidth || media.width; sh = media.naturalHeight || media.height; }
        if (sw === 0 || sh === 0) return;

        const targetRatio = targetW / targetH;
        const sourceRatio = sw / sh;
        let dw, dh, dx, dy;

        if (sourceRatio > targetRatio) {
            dh = targetH; dw = targetH * sourceRatio;
            dx = (targetW - dw) / 2; dy = 0;
        } else {
            dw = targetW; dh = targetW / sourceRatio;
            dx = 0; dy = (targetH - dh) / 2;
        }
        ctx.drawImage(media, dx, dy, dw, dh);
    },

    /**
     * Stencil Masking
     * Draws the 'maskFn' (shape), then uses 'source-in' to fill it with 'contentFn'.
     * Great for video-in-text or video-in-shape.
     */
    drawMasked: (ctx: CanvasRenderingContext2D, contentFn: (c: CanvasRenderingContext2D) => void, maskFn: (c: CanvasRenderingContext2D) => void) => {
        const { width, height } = ctx.canvas;

        // 1. Create a temporary offscreen buffer
        // Note: In the browser (Puppeteer), we use document.createElement
        const buffer = document.createElement('canvas');
        buffer.width = width;
        buffer.height = height;
        const bCtx = buffer.getContext('2d')!;

        // 2. Draw the MASK (the shape) onto the buffer
        maskFn(bCtx);

        // 3. Set composite mode: Only draw where the mask exists
        bCtx.globalCompositeOperation = "source-in";

        // 4. Draw the CONTENT (the video/image) onto the buffer
        contentFn(bCtx);

        // 5. Draw the final result onto the main canvas
        ctx.drawImage(buffer, 0, 0);
    },

    /**
     * Create an offscreen layer/buffer for isolated rendering
     * Returns a Layer object with its own canvas and context
     */
    createLayer: (width: number, height: number) => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;

        return {
            canvas,
            ctx,
            width,
            height,

            /**
             * Clear the layer to transparent
             */
            clear: () => {
                ctx.clearRect(0, 0, width, height);
            },

            /**
             * Draw this layer onto another context
             */
            drawTo: (targetCtx: CanvasRenderingContext2D, x: number = 0, y: number = 0, dw?: number, dh?: number) => {
                if (dw !== undefined && dh !== undefined) {
                    targetCtx.drawImage(canvas, x, y, dw, dh);
                } else {
                    targetCtx.drawImage(canvas, x, y);
                }
            },

            /**
             * Apply a blur effect to this layer (pixel manipulation)
             * @param radius - Blur radius in pixels
             */
            applyBlur: (radius: number) => {
                if (radius <= 0) return;
                
                const imageData = ctx.getImageData(0, 0, width, height);
                const data = imageData.data;
                const copy = new Uint8ClampedArray(data);
                const r = Math.ceil(radius);
                const side = 2 * r + 1;

                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        let rSum = 0, gSum = 0, bSum = 0, aSum = 0, count = 0;

                        for (let ky = -r; ky <= r; ky++) {
                            for (let kx = -r; kx <= r; kx++) {
                                const px = Math.min(width - 1, Math.max(0, x + kx));
                                const py = Math.min(height - 1, Math.max(0, y + ky));
                                const idx = (py * width + px) * 4;

                                rSum += copy[idx];
                                gSum += copy[idx + 1];
                                bSum += copy[idx + 2];
                                aSum += copy[idx + 3];
                                count++;
                            }
                        }

                        const idx = (y * width + x) * 4;
                        data[idx] = rSum / count;
                        data[idx + 1] = gSum / count;
                        data[idx + 2] = bSum / count;
                        data[idx + 3] = aSum / count;
                    }
                }

                ctx.putImageData(imageData, 0, 0);
            },

            /**
             * Apply brightness adjustment to this layer
             * @param amount - Amount to adjust (-1 to 1)
             */
            applyBrightness: (amount: number) => {
                const imageData = ctx.getImageData(0, 0, width, height);
                const data = imageData.data;
                const adjustment = Math.round(amount * 255);

                for (let i = 0; i < data.length; i += 4) {
                    data[i] = Math.max(0, Math.min(255, data[i] + adjustment));
                    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + adjustment));
                    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + adjustment));
                }

                ctx.putImageData(imageData, 0, 0);
            },

            /**
             * Apply contrast adjustment to this layer
             * @param amount - Contrast factor (0 = gray, 1 = normal, 2 = high contrast)
             */
            applyContrast: (amount: number) => {
                const imageData = ctx.getImageData(0, 0, width, height);
                const data = imageData.data;
                const factor = (259 * (amount * 255 + 255)) / (255 * (259 - amount * 255));

                for (let i = 0; i < data.length; i += 4) {
                    data[i] = Math.max(0, Math.min(255, factor * (data[i] - 128) + 128));
                    data[i + 1] = Math.max(0, Math.min(255, factor * (data[i + 1] - 128) + 128));
                    data[i + 2] = Math.max(0, Math.min(255, factor * (data[i + 2] - 128) + 128));
                }

                ctx.putImageData(imageData, 0, 0);
            },

            /**
             * Apply a color tint to this layer
             * @param color - CSS color string (e.g., "rgba(255,0,0,0.5)")
             */
            applyTint: (color: string) => {
                ctx.save();
                ctx.globalCompositeOperation = 'source-atop';
                ctx.fillStyle = color;
                ctx.fillRect(0, 0, width, height);
                ctx.restore();
            },

            /**
             * Apply a grayscale effect to this layer
             */
            applyGrayscale: () => {
                const imageData = ctx.getImageData(0, 0, width, height);
                const data = imageData.data;

                for (let i = 0; i < data.length; i += 4) {
                    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
                    data[i] = gray;
                    data[i + 1] = gray;
                    data[i + 2] = gray;
                }

                ctx.putImageData(imageData, 0, 0);
            },
        };
    },

};

export const BROWSER_UTILS_CODE = `
const mulberry32 = ${mulberry32.toString()};

window.TiramisuUtils = {
    lerp: ${TiramisuUtils.lerp.toString()},
    clamp: ${TiramisuUtils.clamp.toString()},
    remap: ${TiramisuUtils.remap.toString()},
    toRad: ${TiramisuUtils.toRad.toString()},
    easeInQuad: ${TiramisuUtils.easeInQuad.toString()},
    easeOutQuad: ${TiramisuUtils.easeOutQuad.toString()},
    easeInOutQuad: ${TiramisuUtils.easeInOutQuad.toString()},
    easeInCubic: ${TiramisuUtils.easeInCubic.toString()},
    easeOutCubic: ${TiramisuUtils.easeOutCubic.toString()},
    easeOutBounce: ${TiramisuUtils.easeOutBounce.toString()},
    // Pass the generator function creator for deterministic randomness
    seededRandomGenerator: mulberry32,
    drawRoundedRect: ${TiramisuUtils.drawRoundedRect.toString()},
    drawMediaFit: ${TiramisuUtils.drawMediaFit.toString()},
    drawMediaCover: ${TiramisuUtils.drawMediaCover.toString()},
    drawMasked: ${TiramisuUtils.drawMasked.toString()},
    createLayer: ${TiramisuUtils.createLayer.toString()}
};
`;