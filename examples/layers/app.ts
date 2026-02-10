import { TiramisuPlayer } from "../../src/Client.js";

const canvasId = "preview-canvas";

const playerState = {
    blur: 5,
    brightness: 0.1,
    contrast: 1.2,
    grayscale: false,
};

const player = new TiramisuPlayer({
    width: 1280,
    height: 720,
    fps: 30,
    durationSeconds: 10,
    canvas: canvasId,
    data: playerState,
});

// Layer 0: Background gradient
player.addClip(0, 10, ({ ctx, width, height, localProgress }) => {
    // Create animated gradient
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    const hue = (localProgress * 360) % 360;
    gradient.addColorStop(0, `hsl(${hue}, 60%, 20%)`);
    gradient.addColorStop(1, `hsl(${(hue + 60) % 360}, 60%, 10%)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
}, 0);

// Layer 1: Animated circles in a separate layer
player.addClip(0, 10, ({ ctx, width, height, localProgress, layer, data }) => {
    // Create an offscreen layer
    const circlesLayer = layer.create(width, height);

    // Draw animated circles on the layer
    for (let i = 0; i < 5; i++) {
        const t = localProgress + (i * 0.2);
        const x = (Math.sin(t * Math.PI * 2) * 0.3 + 0.5) * width;
        const y = (Math.cos(t * Math.PI * 2) * 0.3 + 0.5) * height;
        const radius = 50 + Math.sin(t * Math.PI * 4) * 20;

        circlesLayer.ctx.beginPath();
        circlesLayer.ctx.arc(x, y, radius, 0, Math.PI * 2);

        const hue = (t * 180 + i * 72) % 360;
        circlesLayer.ctx.fillStyle = `hsla(${hue}, 80%, 60%, 0.7)`;
        circlesLayer.ctx.fill();
        circlesLayer.ctx.strokeStyle = `hsla(${hue}, 80%, 80%, 1)`;
        circlesLayer.ctx.lineWidth = 3;
        circlesLayer.ctx.stroke();
    }

    // Apply blur effect to the layer
    circlesLayer.applyBlur(data.blur);

    // Apply brightness adjustment
    circlesLayer.applyBrightness(data.brightness);

    // Apply contrast adjustment
    circlesLayer.applyContrast(data.contrast);

    // Apply grayscale if checked
    if (data.grayscale) {
        circlesLayer.applyGrayscale();
    }

    // Draw the processed layer to the main canvas
    circlesLayer.drawTo(ctx);
}, 1);

// Layer 2: Text overlay with vignette effect
player.addClip(0, 10, ({ ctx, width, height, localProgress, layer }) => {
    // Create a vignette layer
    const vignetteLayer = layer.create(width, height);

    // Draw radial gradient for vignette
    const gradient = vignetteLayer.ctx.createRadialGradient(
        width / 2, height / 2, 0,
        width / 2, height / 2, width * 0.7
    );
    gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.6)");

    vignetteLayer.ctx.fillStyle = gradient;
    vignetteLayer.ctx.fillRect(0, 0, width, height);

    // Draw the vignette
    vignetteLayer.drawTo(ctx);

    // Add text
    ctx.save();
    ctx.fillStyle = "white";
    ctx.font = "bold 48px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const text = "LAYERS DEMO";
    const bounce = Math.sin(localProgress * Math.PI * 4) * 10;
    ctx.fillText(text, width / 2, height / 2 + bounce);

    // Add subtitle
    ctx.font = "24px sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.fillText("Offscreen Buffers + Effects", width / 2, height / 2 + bounce + 40);
    ctx.restore();
}, 2);

// Layer 3: Border frame
player.addClip(0, 10, ({ ctx, width, height, layer }) => {
    // Create a border layer
    const borderLayer = layer.create(width, height);

    // Draw decorative border
    const borderThickness = 20;
    borderLayer.ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    borderLayer.ctx.lineWidth = borderThickness;

    // Draw the border
    borderLayer.ctx.strokeRect(
        borderThickness / 2,
        borderThickness / 2,
        width - borderThickness,
        height - borderThickness
    );

    // Draw corner accents
    const cornerSize = 60;
    const positions = [
        [0, 0],
        [width, 0],
        [width, height],
        [0, height],
    ];

    borderLayer.ctx.fillStyle = "#f59e0b";
    positions.forEach(([x, y]) => {
        borderLayer.ctx.beginPath();
        borderLayer.ctx.arc(x, y, cornerSize / 2, 0, Math.PI * 2);
        borderLayer.ctx.fill();
    });

    // Apply a subtle glow effect using blur
    const glowLayer = layer.create(width, height);
    glowLayer.ctx.drawImage(borderLayer.canvas, 0, 0);
    glowLayer.applyBlur(10);
    glowLayer.applyTint("rgba(245, 158, 11, 0.3)");

    // Composite: first glow, then border
    glowLayer.drawTo(ctx);
    borderLayer.drawTo(ctx);
}, 3);

// Load and render first frame
player.load();

// Event handlers for controls
const blurRange = document.getElementById("blur-range") as HTMLInputElement;
const blurValue = document.getElementById("blur-value") as HTMLSpanElement;
const brightnessRange = document.getElementById("brightness-range") as HTMLInputElement;
const brightnessValue = document.getElementById("brightness-value") as HTMLSpanElement;
const contrastRange = document.getElementById("contrast-range") as HTMLInputElement;
const contrastValue = document.getElementById("contrast-value") as HTMLSpanElement;
const grayscaleCheck = document.getElementById("grayscale-check") as HTMLInputElement;
const btnPlay = document.getElementById("btn-play") as HTMLButtonElement;

blurRange.addEventListener("input", (e) => {
    const target = e.target as HTMLInputElement;
    playerState.blur = parseFloat(target.value);
    blurValue.textContent = `${playerState.blur}px`;
    if (!(player as any).isPlaying) player.renderFrame(Math.floor((player as any).pausedAt * 30));
});

brightnessRange.addEventListener("input", (e) => {
    const target = e.target as HTMLInputElement;
    playerState.brightness = parseFloat(target.value);
    brightnessValue.textContent = playerState.brightness.toFixed(2);
    if (!(player as any).isPlaying) player.renderFrame(Math.floor((player as any).pausedAt * 30));
});

contrastRange.addEventListener("input", (e) => {
    const target = e.target as HTMLInputElement;
    playerState.contrast = parseFloat(target.value);
    contrastValue.textContent = playerState.contrast.toFixed(1);
    if (!(player as any).isPlaying) player.renderFrame(Math.floor((player as any).pausedAt * 30));
});

grayscaleCheck.addEventListener("change", (e) => {
    const target = e.target as HTMLInputElement;
    playerState.grayscale = target.checked;
    if (!(player as any).isPlaying) player.renderFrame(Math.floor((player as any).pausedAt * 30));
});

btnPlay.addEventListener("click", () => {
    if ((player as any).isPlaying) {
        player.pause();
        btnPlay.textContent = "▶ Play";
    } else {
        player.play();
        btnPlay.textContent = "⏸ Pause";
    }
});
