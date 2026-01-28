import { Tiramisu, type RenderContext } from "./src/Tiramisu";

const engine = new Tiramisu({
    width: 1280,
    height: 720,
    fps: 30,
    durationSeconds: 3,
    outputFile: "tiramisu_demo.mp4"
});

engine.scene(({ ctx, width, height, progress }: RenderContext) => {
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;

    ctx.beginPath();
    ctx.arc(centerX + Math.cos(progress * Math.PI * 2) * 100, centerY, 50, 0, Math.PI * 2);
    ctx.fillStyle = "#ffcc00";
    ctx.fill();

    ctx.fillStyle = "white";
    ctx.font = "bold 40px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Tiramisu Modular Engine", centerX, centerY + 150);
});

await engine.render();