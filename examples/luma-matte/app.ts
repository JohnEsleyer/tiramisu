import { TiramisuPlayer } from "../../src/Client";

const canvasId = "preview-canvas";
const videoUrl = "/flower.mp4"; // Point to the local file

const player = new TiramisuPlayer({
    width: 1280,
    height: 720,
    fps: 30,
    durationSeconds: 10,
    canvas: canvasId,
    videos: [videoUrl]
});

// Layer 0: Solid Background
player.addClip(0, 10, ({ ctx, width, height }) => {
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);
}, 0);

// Layer 1: Masked Video
player.addClip(0, 10, ({ ctx, width, height, videos, utils, localProgress }) => {
    
    // Define the shape (Mask)
    const drawMask = (c: CanvasRenderingContext2D) => {
        c.fillStyle = "white"; // Color doesn't matter, only alpha/shape
        c.font = "900 180px sans-serif";
        c.textAlign = "center";
        c.textBaseline = "middle";
        
        const yOffset = Math.sin(localProgress * Math.PI * 2) * 40;
        c.fillText("TIRAMISU", width / 2, height / 2 + yOffset);
    };

    // Define what goes inside (Content)
    const drawContent = (c: CanvasRenderingContext2D) => {
        if (videos[videoUrl]) {
            // Draw the video to the temporary context
            utils.drawMediaCover(c, videos[videoUrl], width, height);
        }
    };

    // Execute the masking using our new isolated buffer helper
    utils.drawMasked(ctx, drawContent, drawMask);
}, 1);

player.load().then(() => player.play());

document.getElementById('btn-play')?.addEventListener('click', () => {
    player.play();
});

const btnRender = document.getElementById("btn-render") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLDivElement;

btnRender.addEventListener("click", async () => {
    btnRender.disabled = true;
    btnRender.innerText = "⏳ Rendering...";
    statusEl.innerText = "🎬 Engine is processing frames on server...";

    try {
        const response = await fetch("/api/export-mask", { method: "POST" });
        
        if (!response.ok) throw new Error("Server render failed");

        // 1. Get the binary data
        const blob = await response.blob();
        
        // 2. Create a URL for the blob
        const url = window.URL.createObjectURL(blob);
        
        // 3. Create a hidden link and click it to trigger download
        const a = document.createElement("a");
        a.style.display = "none";
        a.href = url;
        a.download = "tiramisu_render.mp4"; // Default filename
        document.body.appendChild(a);
        
        a.click();
        
        // 4. Cleanup
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        statusEl.innerText = "✨ Success! Check your downloads.";
    } catch (err) {
        console.error(err);
        statusEl.innerText = "❌ Error during render/download.";
    } finally {
        btnRender.disabled = false;
        btnRender.innerText = "🎬 Render MP4";
    }
});