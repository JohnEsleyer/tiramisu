import { TiramisuPlayer } from "./src/Client";
import { TiramisuUtils } from "./src/Utils";
import type { DrawFunction, RenderConfig } from "./src/types";// Define the configuration, pointing to a canvas element by ID
const config: RenderConfig = {
    width: 1280,
    height: 720,
    fps: 60, 
    durationSeconds: 5,
    canvas: "preview-canvas" // ID of the canvas element in HTML
    // You can add audioFile: "path/to/your.mp3" here to test reactivity!
};

const player = new TiramisuPlayer(config);

/**
 * 1. Background Layer (0-5s)
 * A smooth linear gradient.
 */
const backgroundClip: DrawFunction = ({ ctx, width, height }) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#0f172a"); // Slate 900
    gradient.addColorStop(1, "#1e1b4b"); // Indigo 950
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
};
player.addClip(0, 5, backgroundClip, 0);

/**
 * 2. Animated Orb (0-5s)
 * Moves side-to-side with a sine-wave bounce.
 */
const orbClip: DrawFunction = ({ ctx, width, height, localProgress, utils }) => {
    // X-axis: smooth ping-pong movement
    const x = utils.lerp(200, width - 200, (Math.sin(localProgress * Math.PI * 2 - Math.PI / 2) + 1) / 2);
    
    // Y-axis: bouncing effect
    const bounce = Math.abs(Math.sin(localProgress * Math.PI * 4)) * 150;
    const y = (height / 2 + 100) - bounce;

    // Draw Glow
    ctx.shadowBlur = 40;
    ctx.shadowColor = "#38bdf8";
    
    // Draw Ball
    ctx.beginPath();
    ctx.arc(x, y, 40, 0, Math.PI * 2);
    ctx.fillStyle = "white";
    ctx.fill();
    
    // Reset shadow for next clips
    ctx.shadowBlur = 0;
};
player.addClip(0, 5, orbClip, 1);

/**
 * 3. Text Reveal (1-4s)
 * Slides up and fades in using Easing.
 */
const textClip: DrawFunction = ({ ctx, width, height, localProgress, utils }) => {
    // Opacity: fade in (0-20% of clip) and fade out (80-100% of clip)
    let opacity = 1;
    if (localProgress < 0.2) opacity = localProgress / 0.2;
    if (localProgress > 0.8) opacity = 1 - (localProgress - 0.8) / 0.2;

    // Movement: slide up using easeOutExpo
    const entryProgress = Math.min(localProgress / 0.3, 1);
    const yOffset = utils.lerp(50, 0, utils.easeOutCubic(entryProgress));

    ctx.globalAlpha = opacity;
    ctx.fillStyle = "white";
    ctx.font = "bold 60px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    ctx.fillText("CREATED WITH TIRAMISU", width / 2, height / 2 + yOffset);
    ctx.globalAlpha = 1.0;
};
player.addClip(1, 3, textClip, 2);


// Load and start playback
player.load().then(() => {
    console.log("Starting client preview...");
    player.play();
});

// Expose player controls for browser console testing (optional)
// @ts-ignore
window.tiramisuPlayer = player;