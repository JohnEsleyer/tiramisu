/**
 * This code is injected into the browser context.
 * It provides helper functions for animations.
 */
export const BROWSER_UTILS_CODE = `
window.TiramisuUtils = {
    // Math Helpers
    lerp: (start, end, t) => start * (1 - t) + end * t,
    
    clamp: (val, min, max) => Math.min(Math.max(val, min), max),
    
    remap: (value, low1, high1, low2, high2) => {
        return low2 + (high2 - low2) * (value - low1) / (high1 - low1);
    },

    toRad: (deg) => deg * (Math.PI / 180),

    // Easing Functions (t is 0-1)
    easeInQuad: (t) => t * t,
    easeOutQuad: (t) => t * (2 - t),
    easeInOutQuad: (t) => t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    
    easeInCubic: (t) => t * t * t,
    easeOutCubic: (t) => (--t) * t * t + 1,
    
    easeInElastic: (t) => {
        if (t===0) return 0;  if (t===1) return 1;
        return -Math.pow(2, 10 * (t - 1)) * Math.sin((t - 1 - 0.3 / 4) * (2 * Math.PI) / 0.3);
    },
    
    easeOutElastic: (t) => {
        if (t===0) return 0;  if (t===1) return 1;
        return Math.pow(2, -10 * t) * Math.sin((t - 0.3 / 4) * (2 * Math.PI) / 0.3) + 1;
    },
    
    easeOutBounce: (t) => {
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
    }
};
`;