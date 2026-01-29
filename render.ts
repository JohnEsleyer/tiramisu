import { Tiramisu } from "./index";

const engine = new Tiramisu({
    width: 1280,
    height: 720,
    fps: 60, // Smooth 60fps
    durationSeconds: 5,
    outputFile: "simple_animation.mp4",
});

/**
 * 1. Background Layer (0-5s)
 * A smooth linear gradient.
 */
engine.addClip(0, 5, ({ ctx, width, height }) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#0f172a"); // Slate 900
    gradient.addColorStop(1, "#1e1b4b"); // Indigo 950
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
}, 0);

/**
 * 2. Animated Orb (0-5s)
 * Moves side-to-side with a sine-wave bounce.
 */
engine.addClip(0, 5, ({ ctx, width, height, localProgress, utils }) => {
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
}, 1);

/**
 * 3. Text Reveal (1-4s)
 * Slides up and fades in using Easing.
 */
engine.addClip(1, 3, ({ ctx, width, height, localProgress, utils }) => {
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
}, 2);

/**
 * 4. Progress Ring (0-5s)
 * A small indicator at the bottom.
 */
engine.addClip(0, 5, ({ ctx, width, height, progress }) => {
    const radius = 20;
    const x = width - 60;
    const y = height - 60;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x, y, radius, -Math.PI / 2, (-Math.PI / 2) + (Math.PI * 2 * progress));
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 4;
    ctx.stroke();
}, 3);

// Run the render
await engine.render();