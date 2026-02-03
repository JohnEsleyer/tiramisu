import { Tiramisu } from "../src/Tiramisu";
import type { DrawFunction } from "../src/types";

const PORT = 3000;

console.log(`🚀 Tiramisu Server starting on http://localhost:${PORT}`);

// --- Clip Definitions (Re-used on server) ---

const serverSnowClip: DrawFunction = ({ ctx, width, height, frame, fps, data, utils }) => {
    
    const { particleCount, randomSeed, totalDuration, maxParticleSpeed } = data as any;
    
    // Create a deterministic RNG for the particle's properties
    const masterRNG = utils.seededRandomGenerator(randomSeed); 
    
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.shadowBlur = 4;
    ctx.shadowColor = "white";
    
    // Iterate over a fixed number of particles
    for (let i = 0; i < particleCount; i++) {
        // Use a unique seed for each particle (index + master seed)
        const particleSeed = randomSeed + i;
        const pRNG = utils.seededRandomGenerator(particleSeed);

        // --- Deterministic Particle Properties ---
        const startX = pRNG() * width;
        const startY = pRNG() * height; // Initial Y is for stagger
        const size = utils.lerp(1, 3, pRNG()); // 1px to 3px
        const fallSpeed = utils.lerp(10, maxParticleSpeed, size / 3); 
        const windAmplitude = utils.lerp(20, 80, pRNG());
        const windFrequency = utils.lerp(0.5, 1.5, pRNG()); 

        // --- Current Position Calculation ---
        const currentTime = frame / fps;
        
        // Y Position: Moves down and wraps around (infinite loop)
        const yTravel = fallSpeed * currentTime;
        const y = (startY + yTravel) % height;

        // X Position: Sine wave for horizontal drift
        const normalizedTime = currentTime / totalDuration; 
        const xDrift = Math.sin(normalizedTime * Math.PI * 2 * windFrequency) * windAmplitude;
        const x = startX + xDrift;
        
        // Draw the particle
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    }
    
    ctx.shadowBlur = 0;
};

// --- START: Re-implementing client clips here to enable server side rendering ---

// 1. Background Video Layer (Video + Bass Pulse Effect)
const serverBackgroundClip: DrawFunction = ({ ctx, width, height, videos, data, utils, audioVolume }) => {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, width, height);

    if (data.videoPath && videos[data.videoPath]) {
        const vid = videos[data.videoPath];
        const pulseScale = 1.0 + audioVolume * 0.10;
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.scale(pulseScale, pulseScale);
        ctx.translate(-width / 2, -height / 2);
        
        utils.drawMediaFit(ctx, videos[data.videoPath], width, height);
        
        ctx.restore();
    }
};

// 2. Visualizer Overlay (FFT Bars) - This is the exact client-side logic
const serverFftClip: DrawFunction = ({ ctx, width, height, audioBands, audioVolume, utils }) => {
    
    // --- VISUALIZER BARS (Uses pre-analyzed audioBands) ---
    const barCount = audioBands.length; 
    const barWidth = width / barCount / 1.5;
    const padding = barWidth / 2;
    const baseHeight = height * 0.2;
    const maxBarHeight = height * 0.3;
    const barColor = (v: number) => `rgba(245, 158, 11, ${utils.clamp(v * 2, 0.2, 1.0)})`;

    ctx.save();
    ctx.translate(padding, height - padding - 10); // Position at the bottom

    for (let i = 0; i < barCount; i++) {
        const bandValue = audioBands[i];
        
        // Bar height: from a small base to max height, scaled by band value
        const h = baseHeight + bandValue * maxBarHeight;
        const x = i * (barWidth + padding);
        const y = -h; // Draw up from the bottom line

        ctx.fillStyle = barColor(bandValue);
        utils.drawRoundedRect(ctx, x, y, barWidth, h, 5);
        ctx.fill();
    }
    ctx.restore();
    // -----------------------------------------------------------


    // --- VOLUME PULSE INDICATOR (Server & Client) ---
    const circleRadius = 50 + audioVolume * 80;
    ctx.beginPath();
    ctx.arc(width - 80, 80, circleRadius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(245, 158, 11, ${utils.clamp(audioVolume * 2, 0.1, 0.8)})`;
    ctx.fill();
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 4;
    ctx.stroke();
};
// --- END: Re-implementing client clips here ---


Bun.serve({
    port: PORT,
    // Increase timeout to 5 minutes to allow for long FFmpeg encoding tasks
    idleTimeout: 255, 

    async fetch(req) {
        const url = new URL(req.url);
        
        // --- NEW ROUTE: MUSIC VISUALIZER RENDER ---
        if (url.pathname === "/api/render-visualizer" && req.method === "POST") {
            try {
                const formData = await req.formData();
                const videoFile = formData.get("video") as File;
                const audioFile = formData.get("audio") as File;
                const width = parseInt(formData.get("width") as string || "1280");
                const height = parseInt(formData.get("height") as string || "720");
                const duration = parseFloat(formData.get("duration") as string || "5");

                // Save files to disk for FFmpeg access
                const tempVideoName = `upload_vid_${Date.now()}.mp4`;
                const tempAudioName = `upload_aud_${Date.now()}.mp3`;
                await Bun.write(tempVideoName, await videoFile.arrayBuffer());
                await Bun.write(tempAudioName, await audioFile.arrayBuffer());

                const outputName = `visualizer_render_${Date.now()}.mp4`;

                console.log(`🎬 Starting Visualizer Render: ${outputName}`);

                const engine = new Tiramisu({
                    width, height, fps: 30, durationSeconds: duration,
                    outputFile: outputName,
                    audioFile: tempAudioName, 
                    videos: [`/${tempVideoName}`],
                    data: { videoPath: `/${tempVideoName}` }
                });

                // Layer 0: Background Video (with pulse)
                engine.addClip(0, duration, serverBackgroundClip, 0);

                // Layer 1: Visualizer/Indicator (using the FFT-enabled clip)
                engine.addClip(0, duration, serverFftClip, 1);

                await engine.render();
                
                const file = Bun.file(outputName);
                if (!(await file.exists())) throw new Error("Output file missing");

                console.log(`✅ Render Complete: ${outputName}`);

                return new Response(file, {
                    headers: {
                        "Content-Type": "video/mp4",
                        "Content-Disposition": `attachment; filename="tiramisu_visualizer_video.mp4"`,
                    },
                });
            } catch (e) {
                console.error("❌ Visualizer Render Error:", e);
                return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
            }
        }
        
        // --- 3. STATIC FILE SERVING ---
        let filePath = "." + url.pathname;
        if (filePath.endsWith("/")) filePath += "index.html";
        
        const file = Bun.file(filePath);
        if (await file.exists()) {
            if (filePath.endsWith(".mp4") || filePath.endsWith(".mp3") || filePath.endsWith(".wav")) {
                console.log(`[Server] Serving media asset: ${url.pathname}`);
            }
            return new Response(file);
        }

        return new Response("Not Found", { status: 404 });
    }
});