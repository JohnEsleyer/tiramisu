import { TiramisuPlayer } from "../../src/Client.js";

// --- UI Elements ---
const canvasId = "preview-canvas";
const videoInput = document.getElementById("video-input") as HTMLInputElement;
const resolutionSelect = document.getElementById("resolution-select") as HTMLSelectElement;
const textInput = document.getElementById("overlay-text") as HTMLInputElement;
const colorInput = document.getElementById("overlay-color") as HTMLInputElement;
const btnPlay = document.getElementById("btn-play") as HTMLButtonElement;
const btnRender = document.getElementById("btn-render") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLDivElement;
const metaEl = document.getElementById("meta-info") as HTMLSpanElement;

// --- Application State ---
const appState = {
    width: 1280,
    height: 720,
    text: "TIRAMISU ENGINE",
    color: "#3b82f6",
    videoUrl: null as string | null,
    videoFile: null as File | null,
    duration: 5
};

metaEl.innerText = `${appState.width} x ${appState.height} @ 30FPS`;

let player = new TiramisuPlayer({
    width: appState.width,
    height: appState.height,
    fps: 30,
    durationSeconds: appState.duration,
    canvas: canvasId,
    data: appState
});

function setupClips() {
    // 1. Background Video Layer
    player.addClip(0, 600, ({ ctx, width, height, videos, data, utils }) => {
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, width, height);

        if (!data.videoUrl) {
            ctx.strokeStyle = "#333";
            ctx.lineWidth = 1;
            const gridSize = 100;
            for(let x=0; x<width; x+=gridSize) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,height); ctx.stroke(); }
            for(let y=0; y<height; y+=gridSize) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(width,y); ctx.stroke(); }
            
            ctx.fillStyle = "#64748b";
            ctx.font = "bold 24px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("NO MEDIA SOURCE", width/2, height/2);
            return;
        }

        const vid = videos[data.videoUrl];
        if (vid && vid.readyState >= 1) {
            // Use drawMediaFit to ensure 1:1 match with server-side letterboxing
            utils.drawMediaFit(ctx, vid, width, height);
        } else {
            ctx.fillStyle = "white";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("Loading Video...", width/2, height/2);
        }
    }, 0);

    // 2. High-Fidelity UI Overlay (Matches Server Exactly)
    player.addClip(0, 600, ({ ctx, width, height, frame, fps, utils, data }) => {
        
        // --- 1. Timing Architecture ---
        const currentTime = frame / fps;
        const entranceDuration = 1.0; 
        const t = Math.min(currentTime / entranceDuration, 1);
        const easedT = utils.easeOutCubic(t);

        // --- 2. Layout Architecture (Safe Zones) ---
        const safeMarginBottom = height * 0.12; 
        const cardHeight = 140;
        const cardWidth = Math.min(width * 0.85, 600); 
        
        const x = (width - cardWidth) / 2;
        const targetY = height - safeMarginBottom - cardHeight;
        const startY = height + 20;
        const y = utils.lerp(startY, targetY, easedT);

        // --- 3. Drawing: Card Shadow ---
        ctx.shadowColor = "rgba(0,0,0,0.4)";
        ctx.shadowBlur = 30;
        ctx.shadowOffsetY = 10;

        // --- 4. Drawing: Card Body ---
        ctx.fillStyle = "white";
        utils.drawRoundedRect(ctx, x, y, cardWidth, cardHeight, 20);
        ctx.fill();

        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        // --- 5. Drawing: Accent Strip ---
        ctx.fillStyle = data.color;
        ctx.save();
        ctx.beginPath();
        utils.drawRoundedRect(ctx, x, y, cardWidth, cardHeight, 20);
        ctx.clip();
        ctx.fillRect(x, y, 28, cardHeight);
        ctx.restore();

        // --- 6. Drawing: Text Content ---
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
        ctx.fillText(`PREVIEW: ${width}x${height}px`, contentX, centerY + 10);

    }, 1);
}

setupClips();
player.seek(0);

// --- Event Handlers ---

resolutionSelect.addEventListener("change", async () => {
    const [w, h] = resolutionSelect.value.split("x").map(Number);
    appState.width = w;
    appState.height = h;
    metaEl.innerText = `${w} x ${h} @ 30FPS`;

    const wasPlaying = (player as any).isPlaying;
    if (wasPlaying) player.pause();

    player = new TiramisuPlayer({
        width: w, height: h, fps: 30,
        durationSeconds: appState.duration,
        canvas: canvasId,
        data: appState,
        videos: appState.videoUrl ? [appState.videoUrl] : []
    });

    setupClips();
    await player.load();
    player.seek(0);
    
    if (wasPlaying) player.play();
});

textInput.addEventListener("input", (e) => {
    appState.text = (e.target as HTMLInputElement).value;
    if (!(player as any).isPlaying) player.seek(0);
});

colorInput.addEventListener("input", (e) => {
    appState.color = (e.target as HTMLInputElement).value;
    if (!(player as any).isPlaying) player.seek(0);
});

videoInput.addEventListener("change", async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    appState.videoFile = file;
    statusEl.innerText = "⏳ Reading video file...";

    if (appState.videoUrl) URL.revokeObjectURL(appState.videoUrl);
    appState.videoUrl = URL.createObjectURL(file);

    const tempVideo = document.createElement('video');
    tempVideo.preload = 'metadata';
    tempVideo.src = appState.videoUrl;

    await new Promise((resolve) => {
        tempVideo.onloadedmetadata = () => {
            appState.duration = tempVideo.duration;
            resolve(null);
        };
    });

    (player as any).config.durationSeconds = appState.duration;
    (player as any).config.videos = [appState.videoUrl];
    (player as any).clips.forEach((clip: any) => clip.endFrame = Math.floor(appState.duration * 30));

    await player.load();
    player.seek(0);

    statusEl.innerText = `✅ Ready: ${file.name} (${appState.duration.toFixed(1)}s)`;
    btnPlay.disabled = false;
    btnRender.disabled = false;
});

btnPlay.addEventListener("click", () => {
    const isPlaying = (player as any).isPlaying;
    if (isPlaying) {
        player.pause();
        btnPlay.innerHTML = "▶ Play Preview";
    } else {
        player.play();
        btnPlay.innerHTML = "⏸ Pause Preview";
    }
});

btnRender.addEventListener("click", async () => {
    if (!appState.videoFile) return;
    btnRender.disabled = true;
    btnRender.innerText = "⏳ Rendering...";

    try {
        const formData = new FormData();
        formData.append("video", appState.videoFile);
        formData.append("text", appState.text);
        formData.append("color", appState.color);
        formData.append("width", appState.width.toString());
        formData.append("height", appState.height.toString());
        formData.append("duration", appState.duration.toString());

        const response = await fetch("/api/export", { method: "POST", body: formData });
        if (!response.ok) throw new Error("Render failed");

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `tiramisu_render.mp4`;
        a.click();
        URL.revokeObjectURL(url);
        statusEl.innerText = "✨ Download Started!";
    } catch (e) {
        console.error(e);
        statusEl.innerText = "❌ Render Failed.";
    } finally {
        btnRender.disabled = false;
        btnRender.innerText = "🎬 Render MP4";
    }
});