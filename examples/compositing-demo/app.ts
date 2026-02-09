import { TiramisuPlayer } from "../../src/Client";
import type { DrawFunction } from "../../src/types";

const canvasId = "preview-canvas";
const videoInput = document.getElementById("video-input") as HTMLInputElement;
const btnPlay = document.getElementById("btn-play") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLDivElement;

const appState = {
    width: 1280,
    height: 720,
    duration: 5,
    videoUrl: null as string | null,
    videoFile: null as File | null
};

let player = new TiramisuPlayer({
    width: appState.width,
    height: appState.height,
    fps: 30,
    durationSeconds: appState.duration,
    canvas: canvasId,
    data: appState
});

const compositingClip: DrawFunction = ({ ctx, width, height, videos, data, utils, localProgress }) => {
    // 1. Create an isolated layer for the background video
    const bgLayer = utils.createLayer(width, height);
    
    // 2. Draw video onto this layer
    const vid = data.videoUrl && videos[data.videoUrl];
    if (vid && vid.readyState >= 1) {
        utils.drawMediaCover(bgLayer.ctx, vid, width, height);
    } else {
        bgLayer.ctx.fillStyle = "#374151";
        bgLayer.ctx.fillRect(0, 0, width, height);
    }

    // 3. Apply Cinematic Blur based on progress (Variable Blur!)
    // This blurs ONLY the video layer, not the whole canvas
    const blurAmount = Math.abs(Math.sin(localProgress * Math.PI)) * 20;
    utils.applyFilter(bgLayer, `blur(${blurAmount}px) brightness(0.8)`);

    // 4. Composite the blurred background to main canvas
    utils.drawLayer(ctx, bgLayer);

    // 5. Create a Text Layer (Sharp)
    const textLayer = utils.createLayer(width, height);
    textLayer.ctx.fillStyle = "white";
    textLayer.ctx.font = "bold 80px sans-serif";
    textLayer.ctx.textAlign = "center";
    textLayer.ctx.textBaseline = "middle";
    textLayer.ctx.fillText("SHARP TEXT", width/2, height/2);

    // 6. Draw Text with optional blend mode and floating effect
    utils.drawLayer(ctx, textLayer, { 
        blendMode: 'source-over',
        y: Math.sin(localProgress * 10) * 20
    });
};

player.addClip(0, 600, compositingClip, 0);

async function handleFile(file: File) {
    statusEl.innerText = `⏳ Reading video file...`;

    if (appState.videoUrl) URL.revokeObjectURL(appState.videoUrl);
    appState.videoUrl = URL.createObjectURL(file);
    appState.videoFile = file;

    const tempVideo = document.createElement('video');
    tempVideo.preload = 'metadata';
    tempVideo.src = appState.videoUrl;

    await new Promise((resolve) => tempVideo.onloadedmetadata = () => {
        appState.duration = tempVideo.duration; 
        resolve(null);
    });

    (player as any).config.durationSeconds = appState.duration;
    (player as any).config.videos = [appState.videoUrl];
    
    await player.load();
    player.seek(0);
    statusEl.innerText = `✅ Ready. Duration: ${appState.duration.toFixed(1)}s`;
    btnPlay.disabled = false;
}

videoInput.addEventListener("change", (e: any) => handleFile(e.target.files[0]));

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

statusEl.innerText = "📹 Upload a video to see compositing in action";
