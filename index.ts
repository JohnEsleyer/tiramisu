import { Tiramisu } from "./src/Tiramisu";

const engine = new Tiramisu({
    width: 1280,
    height: 720,
    fps: 30,
    durationSeconds: 5,
    outputFile: "text_demo.mp4",
    fonts: [
        { name: 'Roboto', url: 'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxK.woff2' }
    ]
});

// Clip 1: Background
engine.addClip(0, 5, ({ ctx, width, height }) => {
    ctx.fillStyle = "#1e272e";
    ctx.fillRect(0, 0, width, height);
}, 0);

// Clip 2: Wrapped Text Box
engine.addClip(0, 5, ({ ctx, width, height, localProgress, utils }) => {
    const boxWidth = 600;
    const boxHeight = 400;
    const x = (width - boxWidth) / 2;
    const y = utils.lerp(height + 100, (height - boxHeight) / 2, utils.easeOutCubic(Math.min(localProgress * 2, 1)));
    
    // Draw Panel
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 2;
    
    utils.drawRoundedRect(ctx, x, y, boxWidth, boxHeight, 20);
    ctx.fill();
    ctx.stroke();

    // Draw Header
    ctx.fillStyle = "#00d2ff";
    ctx.font = "bold 40px 'Roboto'";
    ctx.fillText("Feature: Text Wrapping", x + 30, y + 60);

    // Draw Wrapped Body Text
    ctx.fillStyle = "#d2dae2";
    ctx.font = "30px 'Roboto'";
    
    const longText = "This is a demonstration of the new drawParagraph utility. " + 
                     "It automatically splits long strings into lines based on a maximum width. " +
                     "This makes it much easier to create cards, subtitles, and descriptions " +
                     "without manually calculating line breaks.";
    
    // Opacity fade in for text
    ctx.globalAlpha = Math.max(0, (localProgress - 0.5) * 2);
    utils.drawParagraph(ctx, longText, x + 30, y + 120, boxWidth - 60, 45);
    ctx.globalAlpha = 1;

}, 1);

await engine.render();