import { TiramisuPlayer } from "../../src/Client.js";

const appState = {
    width: 1280,
    height: 720,
    wipe: 0.5,
    videoA: null as string | null,
    videoB: null as string | null,
    duration: 5
};

const canvasId = "preview-canvas";
const player = new TiramisuPlayer({
    width: appState.width,
    height: appState.height,
    fps: 30,
    durationSeconds: appState.duration,
    canvas: canvasId,
    data: appState
});

// --- Split Screen Clips ---

// 1. Video A (The Base Layer)
player.addClip(0, 600, ({ ctx, width, height, videos, data }) => {
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, width, height);

    if (data.videoA && videos[data.videoA]) {
        ctx.drawImage(videos[data.videoA], 0, 0, width, height);
    } else {
        drawPlaceholder(ctx, "VIDEO A", width, height);
    }
}, 0);

// 2. Video B (The Clipped Overlay)
player.addClip(0, 600, ({ ctx, width, height, videos, data }) => {
    if (!data.videoB || !videos[data.videoB]) return;

    ctx.save();
    // Create the wipe mask
    ctx.beginPath();
    ctx.rect(width * data.wipe, 0, width * (1 - data.wipe), height);
    ctx.clip();
    
    // Draw Video B inside the mask
    ctx.drawImage(videos[data.videoB], 0, 0, width, height);
    ctx.restore();
}, 1);

// 3. The Divider Line
player.addClip(0, 600, ({ ctx, width, height, data }) => {
    const x = width * data.wipe;
    ctx.strokeStyle = "white";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();

    // Small UI handle
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(x, height / 2, 20, 0, Math.PI * 2);
    ctx.fill();
}, 2);

function drawPlaceholder(ctx: any, text: string, w: number, h: number) {
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0,0,w,h);
    ctx.fillStyle = "#475569";
    ctx.font = "bold 40px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(text, w/2, h/2);
}


// --- Event Handlers ---
const btnExport = document.getElementById("btn-export") as HTMLButtonElement;
const videoAInput = document.getElementById("video-a") as HTMLInputElement;
const videoBInput = document.getElementById("video-b") as HTMLInputElement;
const wipeRange = document.getElementById("wipe-range") as HTMLInputElement;
const btnPlay = document.getElementById("btn-play") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLDivElement;

function updateExportButtonState() {
    if (videoAInput.files?.length && videoBInput.files?.length) {
        btnExport.disabled = false;
        btnExport.classList.remove("bg-slate-700", "text-slate-400", "cursor-not-allowed");
        btnExport.classList.add("bg-pink-600", "text-white", "hover:bg-pink-700");
    }
}
videoAInput.addEventListener("change", updateExportButtonState);
videoBInput.addEventListener("change", updateExportButtonState);

btnExport.addEventListener("click", async () => {
    const fileA = videoAInput.files?.[0];
    const fileB = videoBInput.files?.[0];
    if (!fileA || !fileB) return;

    btnExport.disabled = true;
    btnExport.innerText = "⏳ Uploading...";
    statusEl.innerText = "🚀 Processing split-screen render on server...";

    try {
        const formData = new FormData();
        formData.append("videoA", fileA);
        formData.append("videoB", fileB);
        formData.append("wipe", appState.wipe.toString());
        formData.append("duration", appState.duration.toString());
        formData.append("width", appState.width.toString());
        formData.append("height", appState.height.toString());

        const response = await fetch("/api/export-split", { 
            method: "POST", 
            body: formData 
        });

        if (!response.ok) throw new Error("Split render failed");

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `comparison_render.mp4`;
        a.click();
        URL.revokeObjectURL(url);
        
        statusEl.innerText = "✨ Render Complete!";
    } catch (e) {
        console.error(e);
        statusEl.innerText = "❌ Export Failed.";
    } finally {
        btnExport.disabled = false;
        btnExport.innerText = "🎬 Export MP4";
        updateExportButtonState();
    }
});

const handleFile = async (file: File, key: 'videoA' | 'videoB') => {
    const url = URL.createObjectURL(file);
    appState[key] = url;
    
    const tempVid = document.createElement('video');
    tempVid.src = url;
    await new Promise(r => tempVid.onloadedmetadata = r);
    
    // Adjust total duration to the shortest video
    appState.duration = Math.min(appState.duration, tempVid.duration);
    (player as any).config.durationSeconds = appState.duration;
    (player as any).config.videos = [appState.videoA, appState.videoB].filter(Boolean) as string[];
    
    await player.load();
    player.seek(0);
    statusEl.innerText = `Loaded ${file.name}`;
};

videoAInput.onchange = (e: any) => handleFile(e.target.files[0], 'videoA');
videoBInput.onchange = (e: any) => handleFile(e.target.files[0], 'videoB');

wipeRange.oninput = (e: any) => {
    appState.wipe = parseFloat(e.target.value);
    if (!(player as any).isPlaying) player.renderFrame(Math.floor((player as any).pausedAt * 30));
};

btnPlay.onclick = () => {
    if ((player as any).isPlaying) {
        player.pause();
        btnPlay.innerText = "▶ Play Preview";
    } else {
        player.play();
        btnPlay.innerText = "⏸ Pause Preview";
    }
};

