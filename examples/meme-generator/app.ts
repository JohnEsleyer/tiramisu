import { TiramisuPlayer } from "../../src/Client";
import type { DrawFunction } from "../../src/types";

// --- State & Config ---
const appState = {
    topText: "TOP TEXT",
    bottomText: "BOTTOM TEXT",
    topPos: { x: 640, y: 100 },
    bottomPos: { x: 640, y: 620 },
    fontSize: 60,
    videoUrl: null as string | null,
    videoFile: null as File | null,
    duration: 5
};

const canvas = document.getElementById("preview-canvas") as HTMLCanvasElement;
const player = new TiramisuPlayer({
    width: 1280, height: 720, fps: 30,
    durationSeconds: appState.duration,
    canvas: canvas,
    data: appState
});

// --- Shared Clip Logic ---
const memeClip: DrawFunction = ({ ctx, width, height, videos, data }) => {
    // 1. Draw Background
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, width, height);
    if (data.videoUrl && videos[data.videoUrl]) {
        const vid = videos[data.videoUrl];
        const sRatio = vid.videoWidth / vid.videoHeight;
        const tRatio = width / height;
        let dw = width, dh = height;
        if (sRatio > tRatio) dh = width / sRatio; else dw = height * sRatio;
        ctx.drawImage(vid, (width - dw) / 2, (height - dh) / 2, dw, dh);
    }

    // 2. Draw Text with Impact-style stroke
    const drawMemeText = (text: string, x: number, y: number) => {
        ctx.font = `bold ${data.fontSize}px Impact, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillStyle = "white";
        ctx.strokeStyle = "black";
        ctx.lineWidth = 6;
        ctx.strokeText(text.toUpperCase(), x, y);
        ctx.fillText(text.toUpperCase(), x, y);
    };

    drawMemeText(data.topText, data.topPos.x, data.topPos.y);
    drawMemeText(data.bottomText, data.bottomPos.x, data.bottomPos.y);
};

player.addClip(0, 600, memeClip);

// --- Interactivity Logic ---
let dragging: 'top' | 'bottom' | null = null;

canvas.addEventListener("mousedown", (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);

    // Simple distance check for "hit detection"
    if (Math.abs(mouseY - appState.topPos.y) < 50) dragging = 'top';
    else if (Math.abs(mouseY - appState.bottomPos.y) < 50) dragging = 'bottom';
});

window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const rect = canvas.getBoundingClientRect();
    const mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
    
    if (dragging === 'top') appState.topPos.y = mouseY;
    else appState.bottomPos.y = mouseY;

    // Re-render frame immediately if paused
    if (!(player as any).isPlaying) player.renderFrame(Math.floor((player as any).pausedAt * 30));
});

window.addEventListener("mouseup", () => dragging = null);

// --- UI Logic ---
const videoInput = document.getElementById("video-input") as HTMLInputElement;
const topTextInput = document.getElementById("top-text") as HTMLInputElement;
const btnRender = document.getElementById("btn-render") as HTMLButtonElement;

topTextInput.oninput = (e) => {
    appState.topText = (e.target as HTMLInputElement).value;
    player.renderFrame(0);
};

videoInput.onchange = async (e: any) => {
    const file = e.target.files[0];
    appState.videoFile = file;
    appState.videoUrl = URL.createObjectURL(file);
    (player as any).config.videos = [appState.videoUrl];
    await player.load();
    player.seek(0);
};

btnRender.onclick = async () => {
    if (!appState.videoFile) return alert("Upload a video first");
    btnRender.innerText = "⏳ Rendering...";
    
    const formData = new FormData();
    formData.append("video", appState.videoFile);
    formData.append("memeData", JSON.stringify({
        topText: appState.topText,
        bottomText: appState.bottomText,
        topPos: appState.topPos,
        bottomPos: appState.bottomPos
    }));

    const resp = await fetch("/api/render-meme", { method: "POST", body: formData });
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "meme.mp4"; a.click();
    btnRender.innerText = "🎬 Render MP4";
};

player.load();
