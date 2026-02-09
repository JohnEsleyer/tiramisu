// Simulating importing from the library
import { TiramisuPlayer } from "../../src/Client";
import type { DrawFunction } from "../../src/types";

// --- Configuration ---
const DURATION = 5;
const FPS = 60;

// Initialize the Player
const player = new TiramisuPlayer({
    width: 1280,
    height: 720,
    fps: FPS,
    durationSeconds: DURATION,
    canvas: "preview-canvas"
});

// --- UI Elements ---
const btnPlay = document.getElementById("btn-play-pause") as HTMLButtonElement;
const btnExport = document.getElementById("btn-export") as HTMLButtonElement;
const timeline = document.getElementById("timeline") as HTMLInputElement;
const timeDisplay = document.getElementById("current-time") as HTMLSpanElement;

// --- 1. Define Clips (The Creative Part) ---

// Background
player.addClip(0, 5, ({ ctx, width, height }) => {
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, "#2c3e50");
    grad.addColorStop(1, "#000000");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
}, 0);

// Bouncing Square
player.addClip(0, 5, ({ ctx, width, height, localProgress, utils }) => {
    const y = utils.lerp(100, height - 100, Math.abs(Math.sin(localProgress * Math.PI * 2)));
    const x = width / 2;
    
    ctx.fillStyle = "#f59e0b";
    utils.drawRoundedRect(ctx, x - 50, y - 50, 100, 100, 20);
    ctx.fill();
}, 1);

// Text Overlay
player.addClip(1, 4, ({ ctx, width, height, localProgress, utils }) => {
    ctx.globalAlpha = utils.easeInQuad(localProgress < 0.5 ? localProgress * 2 : (1 - localProgress) * 2);
    ctx.fillStyle = "white";
    ctx.font = "bold 80px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("LIVE PREVIEW", width / 2, height / 2);
    ctx.globalAlpha = 1;
}, 2);

// --- 2. Initialize Logic ---

let isPlaying = false;
let animationFrameId: number;

// Load assets and render first frame
await player.load();

// --- 3. UI Event Listeners ---

// Play/Pause Toggle
btnPlay.addEventListener("click", () => {
    if (isPlaying) {
        player.pause();
        btnPlay.innerText = "▶ Play";
    } else {
        player.play();
        btnPlay.innerText = "⏸ Pause";
        updateUiLoop();
    }
    isPlaying = !isPlaying;
});

// Timeline Scrubbing
timeline.addEventListener("input", (e) => {
    const val = parseFloat((e.target as HTMLInputElement).value);
    const time = (val / 100) * DURATION;
    
    if (isPlaying) {
        player.pause();
        isPlaying = false;
        btnPlay.innerText = "▶ Play";
    }
    
    player.seek(time);
    updateTimeDisplay(time);
});

// Export Simulation
btnExport.addEventListener("click", async () => {
    btnExport.disabled = true;
    const originalText = btnExport.innerText;
    btnExport.innerText = "⏳ Rendering on Server...";

    // Simple payload for this demo
    const payload = {
        resolution: "1280x720",
        fps: FPS,
        duration: DURATION
    };

    try {
        const response = await fetch("/api/export", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error("Server failed to render");

        // 1. Get the binary data (Blob)
        const blob = await response.blob();

        // 2. Create a temporary download link
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = "tiramisu-video.mp4";
        document.body.appendChild(a);
        
        // 3. Trigger download
        a.click();

        // 4. Cleanup
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);

        alert("✅ Download Started!");

    } catch (error) {
        console.error(error);
        alert("❌ Render failed. Check server console.");
    } finally {
        btnExport.disabled = false;
        btnExport.innerText = originalText;
    }
});


// UI Update Loop (keeps slider in sync during playback)
function updateUiLoop() {
    if (!isPlaying) return;

    // We can calculate current time based on the player's internal state
    // For this simple demo, we approximate it or expose a getter in Client.ts
    // But since we don't have a public getter for currentTime yet, 
    // we track it via our own start time logic or just rely on visual sync.
    
    // NOTE: To make this perfect, TiramisuPlayer needs a `getCurrentTime()` method.
    // For now, the timeline won't auto-move in this demo without that getter,
    // but scrubbing works perfectly.
    
    requestAnimationFrame(updateUiLoop);
}

function updateTimeDisplay(seconds: number) {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = Math.floor(seconds % 60).toString().padStart(2, "0");
    timeDisplay.innerText = `${m}:${s}`;
}