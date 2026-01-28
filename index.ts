import { Tiramisu, type RenderContext } from "./src/Tiramisu";

const engine = new Tiramisu({
    width: 1280,
    height: 720,
    fps: 30,
    durationSeconds: 4,
    outputFile: "bounce.mp4"
});

engine.scene(({ ctx, width, height, progress, utils }) => {
    // Background
    ctx.fillStyle = "#222";
    ctx.fillRect(0, 0, width, height);

    const centerX = width / 2;
    const groundY = height - 100;
    const startY = 100;

    // Use easeOutBounce for the drop animation
    // We map progress (0-1) to the animation
    const bounceProgress = utils.easeOutBounce(progress);
    
    // Interpolate Y position
    const currentY = utils.lerp(startY, groundY, bounceProgress);

    // Draw Ground
    ctx.fillStyle = "#444";
    ctx.fillRect(0, groundY, width, 10);

    // Draw Ball
    ctx.beginPath();
    ctx.arc(centerX, currentY - 30, 30, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${progress * 360}, 70%, 50%)`;
    ctx.fill();
    ctx.shadowBlur = 20;
    ctx.shadowColor = "rgba(0,0,0,0.5)";

    // Text
    ctx.fillStyle = "white";
    ctx.font = "20px monospace";
    ctx.fillText(`Progress: ${progress.toFixed(2)}`, 20, 40);
    ctx.fillText(`Y: ${currentY.toFixed(0)}`, 20, 70);
    ctx.fillText(`Ease: easeOutBounce`, 20, 100);
});

await engine.render();