import { mkdir, readdir, rm } from "node:fs/promises"; 
import { spawn } from "bun";
import { Tiramisu } from "../src/Tiramisu";

const PORT = 3000;
console.log(`\n🚀 Server running at: http://localhost:${PORT}/examples/video-audio-overlay/index.html\n`);

Bun.serve({
    port: PORT,
    idleTimeout: 255, 

    async fetch(req) {
        const url = new URL(req.url);

        if (url.pathname === "/api/export" && req.method === "POST") {
            try {
                const formData = await req.formData();
                const videoFile = formData.get("video") as File;
                const fps = parseInt(formData.get("fps") as string || "30");
                const duration = parseFloat(formData.get("duration") as string || "5");
                const width = parseInt(formData.get("width") as string || "1280");
                const height = parseInt(formData.get("height") as string || "720");
                const customText = formData.get("text") as string || "SERVER RENDER";
                const customColor = formData.get("color") as string || "#ec4899";
                
                if (!videoFile) return new Response("No video uploaded", { status: 400 });

                const UPLOAD_FILENAME = "uploaded_temp.mp4";
                await Bun.write(UPLOAD_FILENAME, await videoFile.arrayBuffer());

                const FRAMES_DIR = "frames";
                await rm(FRAMES_DIR, { recursive: true, force: true }).catch(() => { });
                await mkdir(FRAMES_DIR, { recursive: true });

                console.log(`🔨 Extracting frames (${width}x${height})...`);

                const filterComplex = `fps=${fps},scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`;

                const proc = spawn([
                    "ffmpeg", "-y",
                    "-i", UPLOAD_FILENAME,
                    "-vf", filterComplex,
                    "-q:v", "2",
                    `${FRAMES_DIR}/frame_%04d.jpg`
                ]);

                await proc.exited;

                const frameFiles = (await readdir(FRAMES_DIR))
                    .filter(f => f.endsWith(".jpg"))
                    .sort();

                const frameAssets = frameFiles.map(f => `/${FRAMES_DIR}/${f}`);
                const OUTPUT_FILENAME = "video_sync_render.mp4";
                
                const engine = new Tiramisu({
                    width, height, fps, durationSeconds: duration,
                    outputFile: OUTPUT_FILENAME,
                    audioFile: UPLOAD_FILENAME,
                    assets: frameAssets,
                    headless: true,
                    data: {
                        frameSequence: frameAssets,
                        text: customText,
                        color: customColor
                    }
                });

                // 1. Background
                engine.addClip(0, duration, ({ ctx, width, height, frame, data, assets }) => {
                    const imagePath = data.frameSequence[frame];
                    if (imagePath && assets[imagePath]) {
                        ctx.drawImage(assets[imagePath], 0, 0, width, height);
                    } else {
                        ctx.fillStyle = "black";
                        ctx.fillRect(0, 0, width, height);
                    }
                }, 0);

                // 2. Overlay (Architected Layout)
                engine.addClip(0, duration, ({ ctx, width, height, frame, fps, utils, data }) => {
                    
                    // --- 1. Timing Architecture (Absolute Seconds) ---
                    const currentTime = frame / fps;
                    const entranceDuration = 1.0; // Always takes 1 second to enter
                    
                    // Normalized progress (0 to 1)
                    const t = Math.min(currentTime / entranceDuration, 1);
                    const easedT = utils.easeOutCubic(t);

                    // --- 2. Layout Architecture (Safe Zones) ---
                    const safeMarginBottom = height * 0.12; // 12% from bottom
                    const cardHeight = 140; 
                    const cardWidth = Math.min(width * 0.85, 600); // Max width 600px
                    
                    // Center X
                    const x = (width - cardWidth) / 2;
                    
                    // Animate Y: Start below screen, End at safe margin
                    const targetY = height - safeMarginBottom - cardHeight;
                    const startY = height + 20; // Just off screen
                    const y = utils.lerp(startY, targetY, easedT);

                    // --- 3. Drawing ---
                    
                    // Card Shadow
                    ctx.shadowColor = "rgba(0,0,0,0.4)";
                    ctx.shadowBlur = 30;
                    ctx.shadowOffsetY = 10;

                    // Card Body
                    ctx.fillStyle = "white";
                    utils.drawRoundedRect(ctx, x, y, cardWidth, cardHeight, 20);
                    ctx.fill();

                    // Reset Shadow
                    ctx.shadowColor = "transparent";
                    ctx.shadowBlur = 0;
                    ctx.shadowOffsetY = 0;

                    // Accent Strip
                    const stripWidth = 8;
                    ctx.fillStyle = data.color;
                    // Clip the left side for rounded corner effect
                    ctx.save();
                    ctx.beginPath();
                    utils.drawRoundedRect(ctx, x, y, cardWidth, cardHeight, 20);
                    ctx.clip();
                    ctx.fillRect(x, y, stripWidth + 20, cardHeight);
                    ctx.restore();

                    // Text Layout
                    const contentX = x + 45; // Padding left
                    const centerY = y + (cardHeight / 2);

                    // Main Title
                    ctx.fillStyle = "#0f172a";
                    ctx.font = "800 42px sans-serif";
                    ctx.textBaseline = "bottom";
                    ctx.textAlign = "left";
                    ctx.fillText(data.text, contentX, centerY + 5);

                    // Subtitle
                    ctx.fillStyle = "#64748b";
                    ctx.font = "600 24px sans-serif";
                    ctx.textBaseline = "top";
                    ctx.fillText(`RENDERED: ${width}x${height}px`, contentX, centerY + 10);

                }, 1);

                await engine.render();

                const file = Bun.file(OUTPUT_FILENAME);
                return new Response(file, {
                    headers: { "Content-Type": "video/mp4", "Content-Disposition": `attachment; filename="render.mp4"` }
                });

            } catch (e) {
                console.error("Server Error:", e);
                return new Response("Server Error", { status: 500 });
            }
        }

        let filePath = "." + url.pathname;
        if (filePath.endsWith("/")) filePath += "index.html";
        const file = Bun.file(filePath);
        return (await file.exists()) ? new Response(file) : new Response("Not Found", { status: 404 });
    },
});