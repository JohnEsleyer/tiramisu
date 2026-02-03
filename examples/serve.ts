import { Tiramisu } from "../src/Tiramisu";

const PORT = 3000;

console.log(`🚀 Tiramisu Server starting on http://localhost:${PORT}`);

Bun.serve({
    port: PORT,
    // Increase timeout to 5 minutes to allow for long FFmpeg encoding tasks
    idleTimeout: 255, 

    async fetch(req) {
        const url = new URL(req.url);

        // --- 1. ROUTE: LUMA MATTE / MASKING RENDER ---
        if (url.pathname === "/api/export-mask" && req.method === "POST") {
            try {
                // IMPORTANT: Ensure you have run 'curl https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4 -o flower.mp4'
                const videoFile = "flower.mp4"; 
                const duration = 5;
                const outputFilename = `mask_render_${Date.now()}.mp4`;
                
                console.log(`🎬 Starting Luma Matte Render: ${outputFilename}`);

                const engine = new Tiramisu({
                    width: 1280, 
                    height: 720, 
                    fps: 30, 
                    durationSeconds: duration,
                    outputFile: outputFilename,
                    videos: [`/${videoFile}`], // Leading slash for internal server mapping
                    data: { videoPath: `/${videoFile}` }
                });

                // Layer 0: Background
                engine.addClip(0, duration, ({ ctx, width, height }) => {
                    ctx.fillStyle = "#0f172a"; // Slate 950
                    ctx.fillRect(0, 0, width, height);
                }, 0);

                // Layer 1: Masked Video
                engine.addClip(0, duration, ({ ctx, width, height, videos, utils, localProgress, data }) => {
                    const drawMask = (c: CanvasRenderingContext2D) => {
                        c.fillStyle = "white";
                        c.font = "900 180px sans-serif";
                        c.textAlign = "center";
                        c.textBaseline = "middle";
                        // Animate text bobbing
                        const yOffset = Math.sin(localProgress * Math.PI * 2) * 40;
                        c.fillText("TIRAMISU", width / 2, height / 2 + yOffset);
                    };

                    const drawContent = (c: CanvasRenderingContext2D) => {
                        if (videos[data.videoPath]) {
                            utils.drawMediaCover(c, videos[data.videoPath], width, height);
                        }
                    };

                    // Uses the isolated buffer helper from src/Utils.ts
                    utils.drawMasked(ctx, drawContent, drawMask);
                }, 1);

                await engine.render();
                
                const file = Bun.file(outputFilename);
                if (!(await file.exists())) throw new Error("Output file missing");

                console.log(`✅ Render Complete: ${outputFilename}`);

                return new Response(file, {
                    headers: {
                        "Content-Type": "video/mp4",
                        "Content-Disposition": `attachment; filename="tiramisu_mask_video.mp4"`,
                    },
                });
            } catch (e) {
                console.error("❌ Mask Render Error:", e);
                return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
            }
        }

        // --- 2. ROUTE: ORIGINAL VIDEO OVERLAY EXPORT ---
        if (url.pathname === "/api/export" && req.method === "POST") {
            try {
                const formData = await req.formData();
                const videoFile = formData.get("video") as File;
                const text = formData.get("text") as string || "TIRAMISU ENGINE";
                const color = formData.get("color") as string || "#3b82f6";
                const width = parseInt(formData.get("width") as string || "1280");
                const height = parseInt(formData.get("height") as string || "720");
                const duration = parseFloat(formData.get("duration") as string || "5");

                const tempInputName = `upload_${Date.now()}.mp4`;
                await Bun.write(tempInputName, await videoFile.arrayBuffer());

                const outputName = `overlay_render_${Date.now()}.mp4`;

                const engine = new Tiramisu({
                    width, height, fps: 30, durationSeconds: duration,
                    outputFile: outputName,
                    audioFile: tempInputName, 
                    videos: [`/${tempInputName}`],
                    data: { videoPath: `/${tempInputName}`, text, color }
                });

                engine.addClip(0, duration, ({ ctx, width, height, videos, data, utils }) => {
                    ctx.fillStyle = "black";
                    ctx.fillRect(0, 0, width, height);
                    if (videos[data.videoPath]) {
                        utils.drawMediaFit(ctx, videos[data.videoPath], width, height);
                    }
                }, 0);

                engine.addClip(0, duration, ({ ctx, width, height, frame, fps, utils, data }) => {
                    const currentTime = frame / fps;
                    const t = Math.min(currentTime / 1.0, 1);
                    const easedT = utils.easeOutCubic(t);
                    const cardHeight = 140;
                    const cardWidth = Math.min(width * 0.85, 600); 
                    const x = (width - cardWidth) / 2;
                    const y = utils.lerp(height + 20, height - (height * 0.12) - cardHeight, easedT);

                    ctx.fillStyle = "white";
                    utils.drawRoundedRect(ctx, x, y, cardWidth, cardHeight, 20);
                    ctx.fill();

                    ctx.fillStyle = data.color;
                    ctx.save();
                    ctx.beginPath();
                    utils.drawRoundedRect(ctx, x, y, cardWidth, cardHeight, 20);
                    ctx.clip();
                    ctx.fillRect(x, y, 28, cardHeight);
                    ctx.restore();

                    ctx.fillStyle = "#0f172a";
                    ctx.font = "800 42px sans-serif";
                    ctx.textBaseline = "bottom";
                    ctx.fillText(data.text, x + 45, y + (cardHeight / 2) + 5);
                }, 1);

                await engine.render();
                return new Response(Bun.file(outputName), {
                    headers: { "Content-Disposition": `attachment; filename="render.mp4"` }
                });
            } catch (e) {
                console.error("❌ Overlay Render Error:", e);
                return new Response("Render Error", { status: 500 });
            }
        }

        // --- 3. STATIC FILE SERVING ---
        let filePath = "." + url.pathname;
        if (filePath.endsWith("/")) filePath += "index.html";
        
        const file = Bun.file(filePath);
        if (await file.exists()) {
            return new Response(file);
        }

        return new Response("Not Found", { status: 404 });
    }
});