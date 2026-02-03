import { Tiramisu } from "../src/Tiramisu";

const PORT = 3000;
Bun.serve({
    port: PORT,
    async fetch(req) {
        const url = new URL(req.url);

        if (url.pathname === "/api/export-split" && req.method === "POST") {
            try {
                const formData = await req.formData();
                const fileA = formData.get("videoA") as File;
                const fileB = formData.get("videoB") as File;
                const wipe = parseFloat(formData.get("wipe") as string || "0.5");
                const duration = parseFloat(formData.get("duration") as string || "5");

                const pathA = "temp_split_a.mp4";
                const pathB = "temp_split_b.mp4";
                await Bun.write(pathA, await fileA.arrayBuffer());
                await Bun.write(pathB, await fileB.arrayBuffer());

                const engine = new Tiramisu({
                    width: 1280, height: 720, fps: 30, durationSeconds: duration,
                    outputFile: "final_comparison.mp4",
                    videos: [`/${pathA}`, `/${pathB}`],
                    data: { wipe, videoA: `/${pathA}`, videoB: `/${pathB}` }
                });

                // 1. VIDEO A (Base - Left)
                engine.addClip(0, duration, ({ ctx, width, height, videos, data, utils }) => {
                    const vidA = videos[data.videoA];
                    if (vidA) utils.drawMediaCover(ctx, vidA, width, height);
                }, 0);

                // 2. VIDEO B (Overlay - Right)
                engine.addClip(0, duration, ({ ctx, width, height, videos, data, utils }) => {
                    const vidB = videos[data.videoB];
                    if (!vidB) return;
                    
                    ctx.save();
                    ctx.beginPath();
                    // Clip starting from the wipe line to the end of width
                    ctx.rect(width * data.wipe, 0, width, height);
                    ctx.clip();
                    
                    // Draw at SAME coordinates as Video A for perfect alignment
                    utils.drawMediaCover(ctx, vidB, width, height);
                    ctx.restore();
                }, 1);

                // 3. UI
                engine.addClip(0, duration, ({ ctx, width, height, data }) => {
                    const x = width * data.wipe;
                    ctx.strokeStyle = "white"; ctx.lineWidth = 4;
                    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
                    ctx.fillStyle = "white"; ctx.beginPath(); ctx.arc(x, height/2, 20, 0, Math.PI*2); ctx.fill();
                }, 2);

                console.log("🎬 Processing Split Render...");
                await engine.render();
                return new Response(Bun.file("final_comparison.mp4"));
            } catch (e) {
                console.error(e);
                return new Response("Error", { status: 500 });
            }
        }

        let filePath = "." + url.pathname;
        if (filePath.endsWith("/")) filePath += "index.html";
        const file = Bun.file(filePath);
        return (await file.exists()) ? new Response(file) : new Response("Not Found", { status: 404 });
    }
});
console.log(`🚀 Server: http://localhost:${PORT}`);