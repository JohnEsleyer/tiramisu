import { Tiramisu } from "./src/Tiramisu";

const engine = new Tiramisu({
    width: 1280,
    height: 720,
    fps: 30,
    durationSeconds: 6,
    outputFile: "timeline_demo.mp4",
    fonts: [
        { name: 'Roboto', url: 'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxK.woff2' },
        { name: 'Lobster', url: 'https://fonts.gstatic.com/s/lobster/v28/neILzCirqoswsqX9_oUD.woff2' }
    ]
});

// Clip 1: Background (Runs for full duration)
engine.addClip(0, 6, ({ ctx, width, height }) => {
    ctx.fillStyle = "#2c3e50";
    ctx.fillRect(0, 0, width, height);
}, 0); // zIndex 0

// Clip 2: Intro Text (0s to 3s)
engine.addClip(0, 3, ({ ctx, width, height, localProgress, utils }) => {
    const y = utils.lerp(-100, height/2, utils.easeOutElastic(localProgress));
    
    ctx.font = "100px 'Lobster'"; // Using Custom Font
    ctx.fillStyle = "#ecf0f1";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Hello World", width/2, y);
    
    ctx.font = "30px 'Roboto'";
    ctx.fillStyle = "#bdc3c7";
    ctx.fillText("Timeline System V1", width/2, y + 80);
}, 1);

// Clip 3: Outro Circle (3s to 6s)
engine.addClip(3, 3, ({ ctx, width, height, localProgress, utils }) => {
    const scale = utils.lerp(0, 20, localProgress);
    const alpha = 1 - localProgress;
    
    ctx.translate(width/2, height/2);
    ctx.beginPath();
    ctx.arc(0, 0, 50 * scale, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(231, 76, 60, ${alpha})`;
    ctx.fill();
}, 1);

// Clip 4: Overlay Watermark (Appears at 4s)
engine.addClip(4, 2, ({ ctx, width, height, localProgress }) => {
    ctx.font = "20px 'Roboto'";
    ctx.fillStyle = "white";
    ctx.globalAlpha = localProgress; // Fade in
    ctx.fillText("Built with Tiramisu", width - 200, height - 50);
    ctx.globalAlpha = 1.0; // Reset
}, 2); // zIndex 2 (Top)

await engine.render();