/**
 * Utility functions available to both the Server (Puppeteer) and Client (Browser).
 */
export const TiramisuUtils = {
    // --- Math Helpers ---
    lerp: (start: number, end: number, t: number) => start * (1 - t) + end * t,
    
    clamp: (val: number, min: number, max: number) => Math.min(Math.max(val, min), max),
    
    remap: (value: number, low1: number, high1: number, low2: number, high2: number) => {
        return low2 + (high2 - low2) * (value - low1) / (high1 - low1);
    },

    toRad: (deg: number) => deg * (Math.PI / 180),

    // --- Easing Functions (t is 0-1) ---
    easeInQuad: (t: number) => t * t,
    easeOutQuad: (t: number) => t * (2 - t),
    easeInOutQuad: (t: number) => t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    
    easeInCubic: (t: number) => t * t * t,
    easeOutCubic: (t: number) => (--t) * t * t + 1,
    
    easeInElastic: (t: number) => {
        if (t===0) return 0;  if (t===1) return 1;
        return -Math.pow(2, 10 * (t - 1)) * Math.sin((t - 1 - 0.3 / 4) * (2 * Math.PI) / 0.3);
    },
    
    easeOutElastic: (t: number) => {
        if (t===0) return 0;  if (t===1) return 1;
        return Math.pow(2, -10 * t) * Math.sin((t - 0.3 / 4) * (2 * Math.PI) / 0.3) + 1;
    },
    
    easeOutBounce: (t: number) => {
        const n1 = 7.5625;
        const d1 = 2.75;
        if (t < 1 / d1) {
            return n1 * t * t;
        } else if (t < 2 / d1) {
            return n1 * (t -= 1.5 / d1) * t + 0.75;
        } else if (t < 2.5 / d1) {
            return n1 * (t -= 2.25 / d1) * t + 0.9375;
        } else {
            return n1 * (t -= 2.625 / d1) * t + 0.984375;
        }
    },

    // --- Canvas Helpers ---
    
    drawRoundedRect: (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
        if (w < 2 * r) r = w / 2;
        if (h < 2 * r) r = h / 2;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    },

    drawParagraph: (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
        const words = text.split(' ');
        let line = '';
        let currentY = y;

        for(let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            const testWidth = metrics.width;
            if (testWidth > maxWidth && n > 0) {
                ctx.fillText(line, x, currentY);
                line = words[n] + ' ';
                currentY += lineHeight;
            }
            else {
                line = testLine;
            }
        }
        ctx.fillText(line, x, currentY);
        return currentY + lineHeight;
    }
};

/**
 * Injected into Puppeteer page context. 
 * We stringify functions to ensure they are available in the headless browser.
 */
export const BROWSER_UTILS_CODE = `
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
    easeInElastic: ${TiramisuUtils.easeInElastic.toString()},
    easeOutElastic: ${TiramisuUtils.easeOutElastic.toString()},
    easeOutBounce: ${TiramisuUtils.easeOutBounce.toString()},
    drawRoundedRect: ${TiramisuUtils.drawRoundedRect.toString()},
    drawParagraph: ${TiramisuUtils.drawParagraph.toString()}
};
`;