import { TiramisuPlayer } from "../../src/Client.js";
import type { DrawFunction } from "../../src/types.js";

// --- UI Elements ---
const canvasId = "preview-canvas";
const videoInput = document.getElementById("video-input") as HTMLInputElement;
const audioInput = document.getElementById("audio-input") as HTMLInputElement;
const btnPlay = document.getElementById("btn-play") as HTMLButtonElement;
const btnRender = document.getElementById("btn-render") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLDivElement;

// --- Application State ---
const appState = {
    width: 1280,
    height: 720,
    duration: 5,
    videoUrl: null as string | null,
    audioUrl: null as string | null,
    videoFile: null as File | null,
    audioFile: null as File | null
};

let player = new TiramisuPlayer({
    width: appState.width,
    height: appState.height,
    fps: 30,
    durationSeconds: appState.duration,
    canvas: canvasId,
    data: appState
});

// --- Clips (Unified API) ---

// 1. Background Video Layer (Video + Bass Pulse Effect)
const backgroundClip: DrawFunction = ({ ctx, width, height, videos, data, utils, audioVolume }) => {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, width, height);

    if (data.videoUrl && videos[data.videoUrl]) {
        const vid = videos[data.videoUrl];
        if (vid.readyState >= 1) {
            
            // ACTIVATE pulseScale/ctx.translate/ctx.scale/ctx.restore for server parity
            const pulseScale = 1.0 + audioVolume * 0.10;
            ctx.save();
            ctx.translate(width / 2, height / 2);
            ctx.scale(pulseScale, pulseScale);
            ctx.translate(-width / 2, -height / 2);
            
            utils.drawMediaFit(ctx, vid, width, height);
            
            ctx.restore();
        }
    }  else {
        ctx.fillStyle = "#374151";
        ctx.font = "bold 40px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("NO VIDEO/AUDIO LOADED", width/2, height/2);
    }
};
player.addClip(0, 600, backgroundClip, 0);


// 2. Visualizer Overlay (Frequency Bars)
const visualizerClip: DrawFunction = ({ ctx, width, height, audioBands, audioVolume, utils }) => {
    
    // --- VISUALIZER BARS (Client only, uses Web Audio FFT data, which server now mirrors) ---
    const barCount = audioBands.length; // Max 32 in client.ts
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
player.addClip(0, 600, visualizerClip, 1);

// --- State Update and UI Logic ---

function updateControls() {
    const ready = appState.videoFile && appState.audioFile;
    btnPlay.disabled = !ready;
    btnRender.disabled = !ready;
    btnPlay.style.cursor = ready ? 'pointer' : 'not-allowed';
    btnRender.style.cursor = ready ? 'pointer' : 'not-allowed';
}

async function handleFile(file: File, type: 'video' | 'audio') {
    statusEl.innerText = `⏳ Reading ${type} file...`;

    if (type === 'video') {
        if (appState.videoUrl) URL.revokeObjectURL(appState.videoUrl);
        appState.videoUrl = URL.createObjectURL(file);
        appState.videoFile = file;

        const tempVideo = document.createElement('video');
        tempVideo.preload = 'metadata';
        tempVideo.src = appState.videoUrl;

        await new Promise((resolve) => tempVideo.onloadedmetadata = () => {
            // Use video duration as the ultimate limit
            appState.duration = tempVideo.duration; 
            resolve(null);
        });

    } else { // audio
        if (appState.audioUrl) URL.revokeObjectURL(appState.audioUrl);
        appState.audioUrl = URL.createObjectURL(file);
        appState.audioFile = file;
    }

    // Update player config and reload
    if (appState.videoUrl && appState.audioUrl) {
        (player as any).config.durationSeconds = appState.duration;
        (player as any).config.videos = [appState.videoUrl];
        (player as any).config.audioFile = appState.audioUrl;
        
        await player.load();
        player.seek(0);
        statusEl.innerText = `✅ Ready. Duration: ${appState.duration.toFixed(1)}s`;
    }
    
    updateControls();
}

videoInput.addEventListener("change", (e: any) => handleFile(e.target.files[0], 'video'));
audioInput.addEventListener("change", (e: any) => handleFile(e.target.files[0], 'audio'));

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
    if (!appState.videoFile || !appState.audioFile) return;
    btnRender.disabled = true;
    btnRender.innerText = "⏳ Rendering...";
    statusEl.innerText = "🎬 Uploading files and starting server render...";

    try {
        const formData = new FormData();
        formData.append("video", appState.videoFile);
        formData.append("audio", appState.audioFile);
        formData.append("width", appState.width.toString());
        formData.append("height", appState.height.toString());
        formData.append("duration", appState.duration.toString());
        
        // This is a new route for this specific example
        const response = await fetch("/api/render-visualizer", { 
            method: "POST", 
            body: formData 
        });
        
        if (!response.ok) throw new Error("Render failed");

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `tiramisu_visualizer_render.mp4`;
        a.click();
        URL.revokeObjectURL(url);
        statusEl.innerText = "✨ Download Started!";
    } catch (e) {
        console.error(e);
        statusEl.innerText = "❌ Render Failed. Check server console.";
    } finally {
        btnRender.disabled = false;
        btnRender.innerText = "🎬 Render MP4";
        updateControls();
    }
});

updateControls();