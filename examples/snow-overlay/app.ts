import { TiramisuPlayer } from "../../src/Client.js";
import type { DrawFunction } from "../../src/types.js";

const canvasId = "preview-canvas";
const statusEl = document.getElementById("status") as HTMLDivElement;
const btnPlay = document.getElementById("btn-play") as HTMLButtonElement;
const btnRender = document.getElementById("btn-render") as HTMLButtonElement;

// --- Configuration ---
const DURATION = 6;
const FPS = 30;
const PARTICLE_COUNT = 300;
const RENDER_WIDTH = 1280;
const RENDER_HEIGHT = 720;
const RANDOM_SEED = 12345; // Master seed for deterministic output

const player = new TiramisuPlayer({
    width: RENDER_WIDTH,
    height: RENDER_HEIGHT,
    fps: FPS,
    durationSeconds: DURATION,
    canvas: canvasId,
    data: { 
        particleCount: PARTICLE_COUNT, 
        randomSeed: RANDOM_SEED,
        totalDuration: DURATION,
        maxParticleSpeed: 100 // pixels per second
    }
});

// --- 1. Background Layer ---
player.addClip(0, DURATION, ({ ctx, width, height }) => {
    // Gradient from dark blue to black
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#0e131f");
    grad.addColorStop(1, "#1c253c");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
}, 0);


// --- 2. Particle System (Snow) Layer ---
const snowClip: DrawFunction = ({ ctx, width, height, frame, fps, data, utils }) => {
    
    // Create a deterministic RNG for the particle's properties
    // The master seed ensures the overall layout is the same on all runs
    const masterRNG = utils.seededRandomGenerator(data.randomSeed); 
    
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.shadowBlur = 4;
    ctx.shadowColor = "white";
    
    // Iterate over a fixed number of particles
    for (let i = 0; i < data.particleCount; i++) {
        // Use a unique seed for each particle (index + master seed)
        const particleSeed = data.randomSeed + i;
        // Re-seeding per particle for deterministic properties
        const pRNG = utils.seededRandomGenerator(particleSeed);

        // --- Deterministic Particle Properties ---
        // Seeded random properties
        const startX = pRNG() * width;
        const startY = pRNG() * height; // Initial Y is for stagger
        const size = utils.lerp(1, 3, pRNG()); // 1px to 3px
        
        // Falling speed is based on size for a sense of perspective
        const fallSpeed = utils.lerp(10, data.maxParticleSpeed, size / 3); // Pixels per second
        
        // Wind/Drift (sine wave)
        const windAmplitude = utils.lerp(20, 80, pRNG());
        const windFrequency = utils.lerp(0.5, 1.5, pRNG()); // waves per clip duration

        // --- Current Position Calculation ---
        const currentTime = frame / fps;
        
        // Y Position: Moves down and wraps around (infinite loop)
        const yTravel = fallSpeed * currentTime;
        const y = (startY + yTravel) % height;

        // X Position: Sine wave for horizontal drift
        // Normalized time for sine wave calculation
        const normalizedTime = currentTime / data.totalDuration; 
        const xDrift = Math.sin(normalizedTime * Math.PI * 2 * windFrequency) * windAmplitude;
        const x = startX + xDrift;
        
        // Draw the particle
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    }
    
    ctx.shadowBlur = 0;
};
player.addClip(0, DURATION, snowClip, 1);


// --- UI Logic ---
btnPlay.addEventListener("click", () => {
    const isPlaying = (player as any).isPlaying;
    if (isPlaying) {
        player.pause();
        btnPlay.innerText = "▶ Play Preview";
    } else {
        player.play();
        btnPlay.innerText = "⏸ Pause Preview";
    }
});

btnRender.addEventListener("click", async () => {
    btnRender.disabled = true;
    btnRender.innerText = "⏳ Rendering...";
    statusEl.innerText = "🎬 Sending render job to server...";

    try {
        const payload = {
            width: RENDER_WIDTH, height: RENDER_HEIGHT,
            fps: FPS, duration: DURATION,
            particleCount: PARTICLE_COUNT,
            randomSeed: RANDOM_SEED,
            maxParticleSpeed: 100
        };

        const response = await fetch("/api/render-snow", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error("Server render failed");

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `snow_overlay_render.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        statusEl.innerText = "✨ Success! Check your downloads.";
    } catch (err) {
        console.error(err);
        statusEl.innerText = "❌ Error during render/download.";
    } finally {
        btnRender.disabled = false;
        btnRender.innerText = "🎬 Render MP4";
    }
});

player.load().then(() => {
    statusEl.innerText = "✅ Ready to play.";
    player.seek(0);
});