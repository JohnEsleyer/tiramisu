import { Tiramisu } from "../src/Tiramisu";

const PORT = 3000;

Bun.serve({
    port: PORT,
    async fetch(req) {
        const url = new URL(req.url);

        if (url.pathname === "/api/export" && req.method === "POST") {
            try {
                const formData = await req.formData();
                const videoFile = formData.get("video") as File;
                const text = formData.get("text") as string || "TIRAMISU ENGINE";
                const color = formData.get("color") as string || "#3b82f6";
                const width = parseInt(formData.get("width") as string || "1280");
                const height = parseInt(formData.get("height") as string || "720");
                const duration = parseFloat(formData.get("duration") as string || "5");

                const filename = `upload_${Date.now()}.mp4`;
                await Bun.write(filename, await videoFile.arrayBuffer());

                const engine = new Tiramisu({
                    width, height, fps: 30, durationSeconds: duration,
                    outputFile: "final_render_with_audio.mp4",
                    audioFile: filename, // <--- THIS ADDS THE AUDIO
                    videos: [`/${filename}`],
                    data: { videoPath: `/${filename}`, text, color }
                });

                // 1. Background Video (Letterboxed/Contain)
                engine.addClip(0, duration, ({ ctx, width, height, videos, data, utils }) => {
                    ctx.fillStyle = "black";
                    ctx.fillRect(0, 0, width, height); // Draw background for bars
                    if (videos[data.videoPath]) {
                        utils.drawMediaFit(ctx, videos[data.videoPath], width, height);
                    }
                }, 0);

                // 2. High-Fidelity UI Overlay (1:1 with Client)
                engine.addClip(0, duration, ({ ctx, width, height, frame, fps, utils, data }) => {
                    const currentTime = frame / fps;
                    const entranceDuration = 1.0; 
                    const t = Math.min(currentTime / entranceDuration, 1);
                    const easedT = utils.easeOutCubic(t);

                    const safeMarginBottom = height * 0.12; 
                    const cardHeight = 140;
                    const cardWidth = Math.min(width * 0.85, 600); 
                    
                    const x = (width - cardWidth) / 2;
                    const targetY = height - safeMarginBottom - cardHeight;
                    const startY = height + 20;
                    const y = utils.lerp(startY, targetY, easedT);

                    ctx.shadowColor = "rgba(0,0,0,0.4)";
                    ctx.shadowBlur = 30;
                    ctx.shadowOffsetY = 10;

                    ctx.fillStyle = "white";
                    utils.drawRoundedRect(ctx, x, y, cardWidth, cardHeight, 20);
                    ctx.fill();

                    ctx.shadowColor = "transparent";
                    ctx.shadowBlur = 0;
                    ctx.shadowOffsetY = 0;

                    ctx.fillStyle = data.color;
                    ctx.save();
                    ctx.beginPath();
                    utils.drawRoundedRect(ctx, x, y, cardWidth, cardHeight, 20);
                    ctx.clip();
                    ctx.fillRect(x, y, 28, cardHeight);
                    ctx.restore();

                    const contentX = x + 45;
                    const centerY = y + (cardHeight / 2);

                    ctx.fillStyle = "#0f172a";
                    ctx.font = "800 42px sans-serif";
                    ctx.textBaseline = "bottom";
                    ctx.textAlign = "left";
                    ctx.fillText(data.text, contentX, centerY + 5);

                    ctx.fillStyle = "#64748b";
                    ctx.font = "600 24px sans-serif";
                    ctx.textBaseline = "top";
                    ctx.fillText(`RENDERED: ${width}x${height}px`, contentX, centerY + 10);
                }, 1);

                await engine.render();
                return new Response(Bun.file("final_render_with_audio.mp4"));
            } catch (e) {
                console.error(e);
                return new Response("Render Error", { status: 500 });
            }
        }

        // Static serving...
        let filePath = "." + url.pathname;
        if (filePath.endsWith("/")) filePath += "index.html";
        const file = Bun.file(filePath);
        return (await file.exists()) ? new Response(file) : new Response("Not Found", { status: 404 });
    }
});