import { afterEach, beforeEach, vi } from "vitest";

beforeEach(() => {
    document.body.innerHTML = '<canvas id="preview"></canvas>';

    // Basic RAF stub for deterministic tests without recursive stack growth.
    let rafId = 0;
    const rafTimers = new Map<number, ReturnType<typeof setTimeout>>();
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
        rafId += 1;
        const id = rafId;
        const timer = setTimeout(() => cb(0), 0);
        rafTimers.set(id, timer);
        return id;
    };
    globalThis.cancelAnimationFrame = (id: number) => {
        const timer = rafTimers.get(id);
        if (timer) {
            clearTimeout(timer);
            rafTimers.delete(id);
        }
    };

    const triggerEvent = (el: EventTarget, type: string) => {
        const event = new Event(type);
        (el as any).dispatchEvent?.(event);
        const handler = (el as any)[`on${type}`];
        if (typeof handler === "function") {
            handler.call(el, event);
        }
    };

    // Minimal canvas 2D context stub
    const ctx = {
        clearRect: vi.fn(),
        fillRect: vi.fn(),
        drawImage: vi.fn(),
        beginPath: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        fillText: vi.fn(),
        stroke: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        scale: vi.fn(),
        measureText: vi.fn(() => ({ width: 100 })),
    } as unknown as CanvasRenderingContext2D;

    // Ensure getContext exists so it can be mocked across DOM implementations.
    if (!("getContext" in HTMLCanvasElement.prototype)) {
        Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
            configurable: true,
            writable: true,
            value: () => null,
        });
    }
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
        () => ctx,
    );

    // Make Image load asynchronously
    class TestImage {
        onload: null | (() => void) = null;
        onerror: null | (() => void) = null;
        crossOrigin = "";
        private _src = "";
        width = 100;
        height = 100;
        naturalWidth = 100;
        naturalHeight = 100;
        set src(v: string) {
            this._src = v;
            setTimeout(() => this.onload?.(), 0);
        }
        get src() {
            return this._src;
        }
        set srcset(_v: string) {}
    }
    // @ts-ignore
    globalThis.Image = TestImage;

    // Minimal HTMLVideoElement behavior
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
        if (tag === "video") {
            const video = originalCreateElement("video") as HTMLVideoElement;
            let _currentTime = 0;
            let _paused = true;
            Object.defineProperty(video, "currentTime", {
                get: () => _currentTime,
                set: (v) => {
                    _currentTime = v;
                    // Simulate async seek completion.
                    setTimeout(() => {
                        triggerEvent(video, "seeked");
                    }, 0);
                },
            });
            Object.defineProperty(video, "paused", {
                get: () => _paused,
            });
            (video as any).videoWidth = 1280;
            (video as any).videoHeight = 720;
            (video as any).play = vi.fn(() => {
                _paused = false;
                return Promise.resolve();
            });
            (video as any).pause = vi.fn(() => {
                _paused = true;
            });
            (video as any).remove = vi.fn();
            // Simulate media readiness for both event listeners and onloadeddata.
            setTimeout(() => {
                triggerEvent(video, "loadeddata");
            }, 0);
            return video;
        }
        return originalCreateElement(tag);
    });
});

afterEach(() => {
    vi.restoreAllMocks();
});
