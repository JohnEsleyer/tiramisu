import { TiramisuPlayer } from "../../src/Client";

const canvasId = "preview-canvas";
const videoInput = document.getElementById("video-input") as HTMLInputElement;
const btnPlay = document.getElementById("btn-play") as HTMLButtonElement;
const seeker = document.getElementById("seeker") as HTMLInputElement;
const bufferCanvas = document.createElement("canvas");
const bCtx = bufferCanvas.getContext("2d")!;
bufferCanvas.width = 1280;
bufferCanvas.height = 720;

let currentVideoUrl: string | null = null;

// 1. Initialize Player
const player = new TiramisuPlayer({
    width: 1280,
    height: 720,
    fps: 30,
    durationSeconds: 10,
    canvas: canvasId
});

// 2. Add a Clip that draws the video
// We use a variable to store the source so we can update it dynamically
player.addClip(0, 10, ({ ctx, width, height, videos }) => {
    if (currentVideoUrl && videos[currentVideoUrl]) {
        const vid = videos[currentVideoUrl];
        
        // If the video is ready, update our buffer
        // readyState 2+ means it has a frame available
        if (vid.readyState >= 2 && !vid.seeking) {
            bCtx.drawImage(vid, 0, 0, width, height);
        }

        // Always draw from the buffer to the main canvas
        // This ensures that even during a seek, the "last known frame" stays visible
        ctx.drawImage(bufferCanvas, 0, 0, width, height);
    }
}, 0);

// Add an overlay clip to prove sync
player.addClip(0, 10, ({ ctx, width, height, frame }) => {
    ctx.fillStyle = "rgba(245, 158, 11, 0.8)";
    ctx.fillRect(50, 50, 200, 60);
    ctx.fillStyle = "black";
    ctx.font = "bold 30px sans-serif";
    ctx.fillText(`FRAME: ${frame}`, 70, 90);
}, 1);

// 3. Handle File Upload

videoInput.addEventListener("change", async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    if (currentVideoUrl) URL.revokeObjectURL(currentVideoUrl);
    currentVideoUrl = URL.createObjectURL(file);

    // Create a temporary video element to get the duration
    const tempVideo = document.createElement('video');
    tempVideo.src = currentVideoUrl;
    
    await new Promise((resolve) => {
        tempVideo.onloadedmetadata = () => {
            // Update Player duration to match Video
            (player as any).config.durationSeconds = tempVideo.duration;
            (player as any).config.videos = [currentVideoUrl!];
            
            // Re-calculate clip frames based on new duration
            (player as any).clips.forEach((clip: any) => {
                clip.endFrame = Math.floor(tempVideo.duration * (player as any).config.fps);
            });
            
            resolve(null);
        };
    });

    await player.load();
    player.seek(0); // Reset to start
    alert(`Video Loaded: ${tempVideo.duration.toFixed(2)}s`);
});

// 4. Playback Controls
btnPlay.addEventListener("click", () => {
    const isPlaying = (player as any).isPlaying;
    if (isPlaying) {
        player.pause();
    } else {
        player.play();
    }
});

seeker.addEventListener("input", (e) => {
    const pct = parseFloat((e.target as HTMLInputElement).value) / 100;
    player.seek(pct * 10);
});