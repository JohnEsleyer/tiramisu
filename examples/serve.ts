import { Tiramisu } from "../src/Tiramisu";
import type { DrawFunction } from "../src/types";

const PORT = 3000;
console.log(`🚀 Tiramisu Server starting on http://localhost:${PORT}`);

// ============================================================================
// SHARED CLIP DEFINITIONS
// ============================================================================

// --- 1. Music Visualizer Clips ---
const serverBackgroundClip: DrawFunction = ({ ctx, width, height, videos, data, utils, audioVolume }) => {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, width, height);
    if (data.videoPath && videos[data.videoPath]) {
        const pulseScale = 1.0 + audioVolume * 0.10;
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.scale(pulseScale, pulseScale);
        ctx.translate(-width / 2, -height / 2);
        utils.drawMediaFit(ctx, videos[data.videoPath], width, height);
        ctx.restore();
    }
};

const serverFftClip: DrawFunction = ({ ctx, width, height, audioBands, audioVolume, utils }) => {
    const barCount = audioBands.length; 
    const barWidth = width / barCount / 1.5;
    const padding = barWidth / 2;
    const baseHeight = height * 0.2;
    const maxBarHeight = height * 0.3;
    const barColor = (v: number) => `rgba(245, 158, 11, ${utils.clamp(v * 2, 0.2, 1.0)})`;

    ctx.save();
    ctx.translate(padding, height - padding - 10); 
    for (let i = 0; i < barCount; i++) {
        const bandValue = audioBands[i];
        const h = baseHeight + bandValue * maxBarHeight;
        const x = i * (barWidth + padding);
        const y = -h;
        ctx.fillStyle = barColor(bandValue);
        utils.drawRoundedRect(ctx, x, y, barWidth, h, 5);
        ctx.fill();
    }
    ctx.restore();

    const circleRadius = 50 + audioVolume * 80;
    ctx.beginPath();
    ctx.arc(width - 80, 80, circleRadius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(245, 158, 11, ${utils.clamp(audioVolume * 2, 0.1, 0.8)})`;
    ctx.fill();
};

// --- 2. Split Screen Clips ---
const serverSplitBase: DrawFunction = ({ ctx, width, height, videos, data }) => {
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, width, height);
    if (data.videoA && videos[data.videoA]) {
        ctx.drawImage(videos[data.videoA], 0, 0, width, height);
    }
};

const serverSplitOverlay: DrawFunction = ({ ctx, width, height, videos, data }) => {
    if (!data.videoB || !videos[data.videoB]) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(width * data.wipe, 0, width * (1 - data.wipe), height);
    ctx.clip();
    ctx.drawImage(videos[data.videoB], 0, 0, width, height);
    ctx.restore();
};

const serverSplitDivider: DrawFunction = ({ ctx, width, height, data }) => {
    const x = width * data.wipe;
    ctx.strokeStyle = "white";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(x, height / 2, 20, 0, Math.PI * 2);
    ctx.fill();
};

// --- 3. Snow Clips ---
const serverSnowClip: DrawFunction = ({ ctx, width, height, frame, fps, data, utils }) => {
    const { particleCount, randomSeed, totalDuration, maxParticleSpeed } = data as any;
    const masterRNG = utils.seededRandomGenerator(randomSeed); 
    
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.shadowBlur = 4;
    ctx.shadowColor = "white";
    
    for (let i = 0; i < particleCount; i++) {
        const particleSeed = randomSeed + i;
        const pRNG = utils.seededRandomGenerator(particleSeed);

        const startX = pRNG() * width;
        const startY = pRNG() * height; 
        const size = utils.lerp(1, 3, pRNG()); 
        const fallSpeed = utils.lerp(10, maxParticleSpeed, size / 3); 
        const windAmplitude = utils.lerp(20, 80, pRNG());
        const windFrequency = utils.lerp(0.5, 1.5, pRNG()); 

        const currentTime = frame / fps;
        const yTravel = fallSpeed * currentTime;
        const y = (startY + yTravel) % height;

        const normalizedTime = currentTime / totalDuration; 
        const xDrift = Math.sin(normalizedTime * Math.PI * 2 * windFrequency) * windAmplitude;
        const x = startX + xDrift;
        
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.shadowBlur = 0;
};

// --- 4. Mask Clip (Luma Matte) ---
const serverMaskClip: DrawFunction = ({ ctx, width, height, videos, utils, localProgress }) => {
    const drawMask = (c: CanvasRenderingContext2D) => {
        c.fillStyle = "white"; 
        c.font = "900 180px sans-serif";
        c.textAlign = "center";
        c.textBaseline = "middle";
        const yOffset = Math.sin(localProgress * Math.PI * 2) * 40;
        c.fillText("TIRAMISU", width / 2, height / 2 + yOffset);
    };

    const drawContent = (c: CanvasRenderingContext2D) => {
        if (videos["/flower.mp4"]) {
            utils.drawMediaCover(c, videos["/flower.mp4"], width, height);
        }
    };

    utils.drawMasked(ctx, drawContent, drawMask);
};

// --- 5. Generic Video Clip (Video Upload + Overlay) ---
const serverVideoPassClip: DrawFunction = ({ ctx, width, height, videos, data, utils }) => {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, width, height);
    if (data.videoPath && videos[data.videoPath]) {
        utils.drawMediaFit(ctx, videos[data.videoPath], width, height);
    }
};

const serverTextOverlayClip: DrawFunction = ({ ctx, width, height, frame, fps, utils, data }) => {
    if (!data.text) return;

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

    // Card Shadow
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 10;

    // Card Body
    ctx.fillStyle = "white";
    utils.drawRoundedRect(ctx, x, y, cardWidth, cardHeight, 20);
    ctx.fill();

    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Accent Strip
    if (data.color) {
        ctx.fillStyle = data.color;
        ctx.save();
        ctx.beginPath();
        // NOTE: Changed from cardWidth to cardHeight in the drawRoundedRect call
        utils.drawRoundedRect(ctx, x, y, cardWidth, cardHeight, 20); 
        ctx.clip();
        ctx.fillRect(x, y, 28, cardHeight);
        ctx.restore();
    }

    // Text Content
    const contentX = x + 45;
    const centerY = y + (cardHeight / 2);

    ctx.fillStyle = "#0f172a";
    ctx.font = "800 42px 'Segoe UI', Roboto, sans-serif";
    ctx.textBaseline = "bottom";
    ctx.textAlign = "left";
    ctx.fillText(data.text, contentX, centerY + 5);

    ctx.fillStyle = "#64748b";
    ctx.font = "600 24px 'Segoe UI', Roboto, sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText(`RENDER: ${width}x${height}px`, contentX, centerY + 10);
};


const serverEditorSquareClip: DrawFunction = ({ ctx, width, height, localProgress, utils }) => {
    // Exact same math as client: Bouncing Sine Wave
    const y = utils.lerp(100, height - 100, Math.abs(Math.sin(localProgress * Math.PI * 2)));
    const x = width / 2;
    
    ctx.fillStyle = "#f59e0b"; // Orange
    utils.drawRoundedRect(ctx, x - 50, y - 50, 100, 100, 20);
    ctx.fill();
};

const serverEditorTextClip: DrawFunction = ({ ctx, width, height, localProgress, utils }) => {
    // Exact same math as client: Fade In/Out
    ctx.globalAlpha = utils.easeInQuad(localProgress < 0.5 ? localProgress * 2 : (1 - localProgress) * 2);
    ctx.fillStyle = "white";
    ctx.font = "bold 80px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("LIVE PREVIEW", width / 2, height / 2);
    ctx.globalAlpha = 1;
};

// --- NEW: Meme Generator Server Clip ---
const serverMemeClip: DrawFunction = ({ ctx, width, height, videos, data, utils }) => {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, width, height);
    
    // Draw background video (using fit for letterboxing)
    if (data.videoPath && videos[data.videoPath]) {
        utils.drawMediaFit(ctx, videos[data.videoPath], width, height);
    }

    // Draw Text (Impact style, sans-serif fallback)
    const drawMemeText = (text: string, x: number, y: number) => {
        // Matching the client's font logic as closely as possible
        ctx.font = `bold 60px Impact, sans-serif`; 
        ctx.textAlign = "center";
        ctx.fillStyle = "white";
        ctx.strokeStyle = "black";
        ctx.lineWidth = 6;
        // Use the coordinates passed via the 'data' object
        ctx.strokeText(text.toUpperCase(), x, y);
        ctx.fillText(text.toUpperCase(), x, y);
    };

    drawMemeText(data.topText, data.topPos.x, data.topPos.y);
    drawMemeText(data.bottomText, data.bottomPos.x, data.bottomPos.y);
};


// ============================================================================
// SERVER DEFINITION
// ============================================================================

Bun.serve({
    port: PORT,
    idleTimeout: 255, 

    async fetch(req) {
        const url = new URL(req.url);

        // --- NEW: MEME GENERATOR EXPORT ---
        if (url.pathname === "/api/render-meme" && req.method === "POST") {
            try {
                const formData = await req.formData();
                const videoFile = formData.get("video") as File;
                // Client sends a JSON string of state
                const memeData = JSON.parse(formData.get("memeData") as string); 
                
                // Write uploaded video to a temp file
                const videoPath = `meme_in_${Date.now()}.mp4`;
                await Bun.write(videoPath, await videoFile.arrayBuffer());
                const outputName = `meme_out_${Date.now()}.mp4`;
                
                const engine = new Tiramisu({
                    width: 1280, height: 720, fps: 30, durationSeconds: 5,
                    outputFile: outputName,
                    videos: [`/${videoPath}`],
                    data: { 
                        videoPath: `/${videoPath}`, 
                        ...memeData,
                        fontSize: 60 // Hardcode size for server consistency
                    }
                });

                // The clip uses the coordinates passed in the 'data' object
                engine.addClip(0, 5, serverMemeClip); 
                await engine.render();
                
                return new Response(Bun.file(outputName));
            } catch (e) { 
                console.error(e);
                return new Response(String(e), { status: 500 }); 
            }
        }
        // --- END NEW: MEME GENERATOR EXPORT ---
        
        // VISUALIZER EXPORT
        if (url.pathname === "/api/render-visualizer" && req.method === "POST") {
            try {
                const formData = await req.formData();
                const videoFile = formData.get("video") as File;
                const audioFile = formData.get("audio") as File;
                const width = parseInt(formData.get("width") as string || "1280");
                const height = parseInt(formData.get("height") as string || "720");
                const duration = parseFloat(formData.get("duration") as string || "5");

                const tempVideoName = `upload_vid_${Date.now()}.mp4`;
                const tempAudioName = `upload_aud_${Date.now()}.mp3`;
                await Bun.write(tempVideoName, await videoFile.arrayBuffer());
                await Bun.write(tempAudioName, await audioFile.arrayBuffer());
                const outputName = `visualizer_${Date.now()}.mp4`;

                const engine = new Tiramisu({
                    width, height, fps: 30, durationSeconds: duration,
                    outputFile: outputName, audioFile: tempAudioName, 
                    videos: [`/${tempVideoName}`],
                    data: { videoPath: `/${tempVideoName}` }
                });

                engine.addClip(0, duration, serverBackgroundClip, 0);
                engine.addClip(0, duration, serverFftClip, 1);
                await engine.render();
                
                return new Response(Bun.file(outputName));
            } catch (e) { return new Response(String(e), { status: 500 }); }
        }

        // SPLIT SCREEN EXPORT
        if (url.pathname === "/api/export-split" && req.method === "POST") {
            try {
                const formData = await req.formData();
                const vidA = formData.get("videoA") as File;
                const vidB = formData.get("videoB") as File;
                const wipe = parseFloat(formData.get("wipe") as string || "0.5");
                const duration = parseFloat(formData.get("duration") as string || "5");
                const width = parseInt(formData.get("width") as string || "1280");
                const height = parseInt(formData.get("height") as string || "720");

                const pathA = `split_a_${Date.now()}.mp4`;
                const pathB = `split_b_${Date.now()}.mp4`;
                await Bun.write(pathA, await vidA.arrayBuffer());
                await Bun.write(pathB, await vidB.arrayBuffer());
                const outputName = `split_render_${Date.now()}.mp4`;

                const engine = new Tiramisu({
                    width, height, fps: 30, durationSeconds: duration,
                    outputFile: outputName,
                    videos: [`/${pathA}`, `/${pathB}`],
                    data: { videoA: `/${pathA}`, videoB: `/${pathB}`, wipe }
                });

                engine.addClip(0, duration, serverSplitBase, 0);
                engine.addClip(0, duration, serverSplitOverlay, 1);
                engine.addClip(0, duration, serverSplitDivider, 2);

                await engine.render();
                return new Response(Bun.file(outputName));
            } catch (e) { return new Response(String(e), { status: 500 }); }
        }

        // SNOW EXPORT
        if (url.pathname === "/api/render-snow" && req.method === "POST") {
            try {
                const body = await req.json();
                const { width, height, fps, duration, particleCount, randomSeed, maxParticleSpeed } = body;
                const outputName = `snow_${Date.now()}.mp4`;

                const engine = new Tiramisu({
                    width, height, fps, durationSeconds: duration,
                    outputFile: outputName,
                    data: { particleCount, randomSeed, totalDuration: duration, maxParticleSpeed }
                });

                engine.addClip(0, duration, ({ctx, width, height}) => {
                    const grad = ctx.createLinearGradient(0, 0, 0, height);
                    grad.addColorStop(0, "#0e131f");
                    grad.addColorStop(1, "#1c253c");
                    ctx.fillStyle = grad;
                    ctx.fillRect(0, 0, width, height);
                }, 0);

                engine.addClip(0, duration, serverSnowClip, 1);

                await engine.render();
                return new Response(Bun.file(outputName));
            } catch(e) { return new Response(String(e), { status: 500 }); }
        }

        // LUMA MATTE EXPORT
        if (url.pathname === "/api/export-mask" && req.method === "POST") {
            try {
                const width = 1280;
                const height = 720;
                const duration = 10;
                const outputName = `mask_render_${Date.now()}.mp4`;

                const engine = new Tiramisu({
                    width, height, fps: 30, durationSeconds: duration,
                    outputFile: outputName,
                    videos: ["/flower.mp4"] 
                });

                engine.addClip(0, duration, ({ctx, w, h}: any) => {
                    ctx.fillStyle = "#0f172a";
                    ctx.fillRect(0,0,width,height);
                }, 0);

                engine.addClip(0, duration, serverMaskClip, 1);

                await engine.render();
                return new Response(Bun.file(outputName));
            } catch(e) { return new Response(String(e), { status: 500 }); }
        }

        // ====================================================================
        // GENERIC EXPORT (Handles Video Upload & Video Editor)
        // ====================================================================
        if (url.pathname === "/api/export" && req.method === "POST") {
            try {
                let width = 1280, height = 720, duration = 5;
                let text: string | null = null;
                let color: string | null = null;
                let videoPath: string | undefined;
                let audioPath: string | undefined;
                let isEditor = false;

                const contentType = req.headers.get("content-type") || "";

                if (contentType.includes("application/json")) {
                    isEditor = true;
                    const body = await req.json();
                    if (body.resolution) {
                        const [w, h] = body.resolution.split("x").map(Number);
                        width = w; height = h;
                    }
                    if (body.duration) duration = parseFloat(body.duration);
                } else {
                    const formData = await req.formData();
                    const videoFile = formData.get("video") as File;
                    width = parseInt(formData.get("width") as string || "1280");
                    height = parseInt(formData.get("height") as string || "720");
                    duration = parseFloat(formData.get("duration") as string || "5");
                    text = formData.get("text") as string | null;
                    color = formData.get("color") as string | null;

                    if (videoFile && videoFile.size > 0) {
                        const fname = `upload_gen_${Date.now()}.mp4`;
                        await Bun.write(fname, await videoFile.arrayBuffer());
                        videoPath = `/${fname}`;
                        audioPath = fname; 
                    }
                }

                const outputName = `export_${Date.now()}.mp4`;
                const engine = new Tiramisu({
                    width, height, fps: 30, durationSeconds: duration,
                    outputFile: outputName,
                    videos: videoPath ? [videoPath] : [],
                    audioFile: audioPath,
                    data: { videoPath, text, color }
                });

                // --- LOGIC BRANCHING ---

                if (isEditor) {
                    // 1. Editor Background
                    engine.addClip(0, duration, ({ ctx, width, height }) => {
                        const grad = ctx.createLinearGradient(0, 0, width, height);
                        grad.addColorStop(0, "#2c3e50");
                        grad.addColorStop(1, "#000000");
                        ctx.fillStyle = grad;
                        ctx.fillRect(0, 0, width, height);
                    }, 0);

                    // 2. Editor Bouncing Square (Layer 1)
                    engine.addClip(0, duration, serverEditorSquareClip, 1);

                    // 3. Editor Text (Layer 2, 1s to 4s)
                    engine.addClip(1, 3, serverEditorTextClip, 2);

                } else {
                    // Standard Video/Audio Overlay Logic
                    if (videoPath) {
                        engine.addClip(0, duration, serverVideoPassClip, 0);
                    } else {
                        engine.addClip(0, duration, ({ctx, width, height}) => {
                            ctx.fillStyle = "#111"; ctx.fillRect(0,0,width,height);
                        }, 0);
                    }

                    if (text) {
                        engine.addClip(0, duration, serverTextOverlayClip, 1);
                    }
                }

                await engine.render();
                return new Response(Bun.file(outputName));
            } catch(e) { 
                console.error(e);
                return new Response(String(e), { status: 500 }); 
            }
        }
        
        // STATIC FILES
        let filePath = "." + url.pathname;
        if (filePath.endsWith("/")) filePath += "index.html";
        const file = Bun.file(filePath);
        if (await file.exists()) return new Response(file);

        return new Response("Not Found", { status: 404 });
    }
});