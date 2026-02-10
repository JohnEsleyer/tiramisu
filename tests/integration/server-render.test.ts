import { describe, expect, it, vi } from "vitest";

const serverStart = vi.fn(() => "http://localhost:1234");
const serverStop = vi.fn();

const browserInit = vi.fn();
const browserSetup = vi.fn();
const browserRenderFrame = vi.fn(async () => new Uint8Array([1, 2, 3]));
const browserClose = vi.fn();

const encoderWrite = vi.fn();
const encoderClose = vi.fn();

const cliStart = vi.fn();
const cliUpdate = vi.fn();
const cliFinish = vi.fn();

const analyzeAudio = vi.fn(async (_file: string, fps: number, duration: number) => {
    const totalFrames = Math.ceil(fps * duration);
    return Array.from({ length: totalFrames }, () => ({
        rms: 0,
        bands: Array(32).fill(0),
    }));
});

vi.mock("../../src/Server.js", () => ({
    TiramisuServer: class {
        start = serverStart;
        stop = serverStop;
    },
}));

vi.mock("../../src/Browser.js", () => ({
    TiramisuBrowser: class {
        init = browserInit;
        setupScene = browserSetup;
        renderFrame = browserRenderFrame;
        close = browserClose;
    },
}));

vi.mock("../../src/Encoder.js", () => ({
    TiramisuEncoder: class {
        constructor() {}
        writeFrame = encoderWrite;
        close = encoderClose;
    },
}));

vi.mock("../../src/CLI.js", () => ({
    TiramisuCLI: class {
        constructor() {}
        start = cliStart;
        update = cliUpdate;
        finish = cliFinish;
    },
}));

vi.mock("../../src/AudioAnalysis.js", () => ({
    AudioAnalyzer: class {
        analyze = analyzeAudio;
    },
}));

import { Tiramisu } from "../../src/Tiramisu.js";

describe("integration: server render usage", () => {
    it("renders a short composition and calls pipeline components", async () => {
        const engine = new Tiramisu({
            width: 320,
            height: 180,
            fps: 30,
            durationSeconds: 1,
            outputFile: "out.mp4",
            videos: ["assets/clip.mp4"],
            audioFile: "assets/track.mp3",
            data: { title: "Test" },
        });

        engine.addClip(0, 1, ({ ctx, width, height }) => {
            ctx.fillRect(0, 0, width, height);
        });

        await engine.render();

        expect(serverStart).toHaveBeenCalled();
        expect(browserInit).toHaveBeenCalled();
        expect(browserSetup).toHaveBeenCalled();
        expect(browserRenderFrame).toHaveBeenCalled();
        expect(encoderWrite).toHaveBeenCalled();
        expect(encoderClose).toHaveBeenCalled();
        expect(browserClose).toHaveBeenCalled();
        expect(serverStop).toHaveBeenCalled();
        expect(cliStart).toHaveBeenCalled();
        expect(cliFinish).toHaveBeenCalled();
    });
});
