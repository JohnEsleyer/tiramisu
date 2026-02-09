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

};

const mulberry32Source = mulberry32
    .toString()
    .replace(/^export\s+/, "")
    .replace(/^const\s+\w+\s*=\s*/, "");

export const BROWSER_UTILS_CODE = `
    const mulberry32 = ${mulberry32Source};

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
        drawMasked: ${TiramisuUtils.drawMasked.toString()}
    };
`;
