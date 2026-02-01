import { join } from "path";
import { unlink } from "node:fs/promises";
import { Tiramisu } from "../src/Tiramisu"; // Import the core engine

const PORT = 3000;

console.log(`\n🚀 Server running at: http://localhost:${PORT}/examples/video-editor/index.html\n`);

Bun.serve({
  port: PORT,
  // Increase timeout for rendering large videos
  idleTimeout: 60, 
  
  async fetch(req) {
    const url = new URL(req.url);

    // --- API: Handle Export Request ---
    if (url.pathname === "/api/export" && req.method === "POST") {
      try {
        const body = await req.json();
        console.log("🎥 Starting Server-Side Render...");

        const OUTPUT_FILENAME = "server_render.mp4";

        // 1. Initialize Engine
        const engine = new Tiramisu({
            width: 1280,
            height: 720,
            fps: body.fps || 60,
            durationSeconds: body.duration || 5,
            outputFile: OUTPUT_FILENAME,
            headless: true // Run hidden
        });

        // 2. Recreate the Animation Logic (Server-Side)
        // In a real app, you would generate this based on 'body.clips' data
        
        // Background
        engine.addClip(0, 5, ({ ctx, width, height }) => {
            const grad = ctx.createLinearGradient(0, 0, width, height);
            grad.addColorStop(0, "#2c3e50");
            grad.addColorStop(1, "#000000");
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, width, height);
        }, 0);

        // Bouncing Square
        engine.addClip(0, 5, ({ ctx, width, height, localProgress, utils }) => {
            const y = utils.lerp(100, height - 100, Math.abs(Math.sin(localProgress * Math.PI * 2)));
            const x = width / 2;
            
            ctx.fillStyle = "#f59e0b";
            utils.drawRoundedRect(ctx, x - 50, y - 50, 100, 100, 20);
            ctx.fill();
        }, 1);

        // Text (Dynamic based on client payload if we wanted)
        engine.addClip(1, 4, ({ ctx, width, height, localProgress, utils }) => {
            ctx.globalAlpha = utils.easeInQuad(localProgress < 0.5 ? localProgress * 2 : (1 - localProgress) * 2);
            ctx.fillStyle = "white";
            ctx.font = "bold 80px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("RENDERED ON SERVER", width / 2, height / 2);
            ctx.globalAlpha = 1;
        }, 2);

        // 3. Run Render
        await engine.render();

        console.log("✅ Render Complete. Sending file to client...");

        // 4. Return the file
        const file = Bun.file(OUTPUT_FILENAME);
        return new Response(file, {
            headers: {
                "Content-Type": "video/mp4",
                "Content-Disposition": `attachment; filename="tiramisu_export.mp4"`
            }
        });

      } catch (e) {
        console.error(e);
        return new Response("Render Failed", { status: 500 });
      }
    }

    // --- STATIC FILES ---
    let filePath = "." + url.pathname;
    if (filePath.endsWith("/")) filePath += "index.html";
    const file = Bun.file(filePath);
    return (await file.exists()) ? new Response(file) : new Response("Not Found", { status: 404 });
  },
});