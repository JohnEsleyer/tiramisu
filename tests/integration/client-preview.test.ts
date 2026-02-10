import { describe, expect, it, vi } from "vitest";
import { TiramisuPlayer } from "../../src/Client.js";

describe("integration: client preview usage", () => {
    it("loads assets/videos and renders frames", async () => {
        const player = new TiramisuPlayer({
            canvas: "preview",
            width: 640,
            height: 360,
            fps: 30,
            durationSeconds: 2,
            assets: ["/img/logo.png"],
            videos: ["/video/clip.mp4"],
            data: { title: "Demo" },
        });

        const drawSpy = vi.fn();
        player.addClip(0, 2, (ctx) => {
            drawSpy();
            ctx.ctx.fillRect(0, 0, ctx.width, ctx.height);
        });

        await player.load();
        player.renderFrame(0);

        expect(drawSpy).toHaveBeenCalled();
    });

    it("supports play, pause, and seek without throwing", async () => {
        const player = new TiramisuPlayer({
            canvas: "preview",
            width: 640,
            height: 360,
            fps: 30,
            durationSeconds: 2,
        });

        player.addClip(0, 2, ({ ctx, width, height }) => {
            ctx.fillRect(0, 0, width, height);
        });

        await player.load();

        expect(() => player.play()).not.toThrow();
        expect(() => player.pause()).not.toThrow();
        expect(() => player.seek(1)).not.toThrow();
    });

    it("respects zIndex ordering for overlapping clips", async () => {
        const player = new TiramisuPlayer({
            canvas: "preview",
            width: 200,
            height: 100,
            fps: 30,
            durationSeconds: 1,
        });

        const order: string[] = [];
        player.addClip(0, 1, () => order.push("back"), 0);
        player.addClip(0, 1, () => order.push("front"), 10);

        await player.load();
        order.length = 0;
        player.renderFrame(0);

        expect(order).toEqual(["back", "front"]);
    });
});
