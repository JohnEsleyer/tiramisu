import { Tiramisu, type RenderContext } from "./src/Tiramisu";

// 1. Configure the renderer
const engine = new Tiramisu({
    width: 1920,
    height: 1080,
    fps: 30,
    durationSeconds: 5,
    outputFile: "out.mp4"
});

// 2. Define the scene
// IMPORTANT: This function runs in the Browser! 
// You cannot use 'console.log' to see output in your terminal (unless you pipe it).
// You cannot use external node_modules here.
engine.scene(({ ctx, width, height, frame, progress, fps }: RenderContext) => {
    
    // --- Background ---
    const hue = Math.floor(progress * 360);
    ctx.fillStyle = `hsl(${hue}, 50%, 10%)`;
    ctx.fillRect(0, 0, width, height);

    // --- Grid Lines ---
    ctx.strokeStyle = `rgba(255, 255, 255, 0.1)`;
    ctx.lineWidth = 2;
    const gridSize = 100;
    const offset = (frame * 2) % gridSize; // Moving grid effect
    
    for(let x = offset; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }

    // --- Bouncing Text ---
    ctx.save();
    ctx.translate(width / 2, height / 2);
    
    // Scale animation
    const scale = 1 + Math.sin(progress * Math.PI * 4) * 0.2;
    ctx.scale(scale, scale);
    
    // Rotation animation
    ctx.rotate(progress * Math.PI * 2);

    // Draw Text
    ctx.fillStyle = "white";
    ctx.font = "bold 120px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Tiramisu 🍰", 0, 0);
    
    // Draw Subtext
    ctx.font = "30px monospace";
    ctx.fillStyle = "#aaa";
    ctx.fillText(`Frame: ${frame}`, 0, 80);
    
    ctx.restore();

    // --- Progress Bar ---
    ctx.fillStyle = "red";
    ctx.fillRect(0, height - 20, width * progress, 20);
});

// 3. Run
await engine.render();