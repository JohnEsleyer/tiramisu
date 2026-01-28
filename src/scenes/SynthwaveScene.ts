import type { RenderContext, SceneData, Star } from "../types";

export const drawSynthwave = ({ ctx, width, height, audioVolume, frame, data, utils }: RenderContext<SceneData>) => {
    // --- 1. Init Stars (Once) ---
    if (data.stars.length === 0) {
        for (let i = 0; i < 200; i++) {
            data.stars.push({
                x: Math.random() * width,
                y: Math.random() * (height / 2),
                size: Math.random() * 2 + 1,
                blinkOffset: Math.random() * 10
            });
        }
    }

    // --- 2. Sky Gradient ---
    const horizonY = height / 2;
    const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
    skyGrad.addColorStop(0, "#0f0c29");
    skyGrad.addColorStop(0.5, "#302b63");
    skyGrad.addColorStop(1, "#24243e");
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, horizonY);

    // --- 3. Stars ---
    ctx.fillStyle = "white";
    data.stars.forEach((star: Star) => {
        const blink = Math.sin(frame * 0.1 + star.blinkOffset);
        if (blink > 0) {
            ctx.globalAlpha = blink;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fill();
        }
    });
    ctx.globalAlpha = 1.0;

    // --- 4. The Sun ---
    const sunRadius = 250 + (audioVolume * 50);
    ctx.save();
    ctx.translate(width / 2, horizonY - 100);
    ctx.shadowColor = "#ff00cc";
    ctx.shadowBlur = 50 + (audioVolume * 50);
    const sunGrad = ctx.createLinearGradient(0, -sunRadius, 0, sunRadius);
    sunGrad.addColorStop(0, "#ffd700");
    sunGrad.addColorStop(0.5, "#ff0055");
    sunGrad.addColorStop(1, "#9900ff");
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(0, 0, sunRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#24243e"; 
    for(let i = 0; i < 10; i++) {
        const y = i * 40 - 50;
        if (y < sunRadius && y > -sunRadius) ctx.fillRect(-sunRadius, y, sunRadius * 2, 5 + i * 2);
    }
    ctx.restore();

    // --- 5. Retro Grid ---
    data.gridOffset = (data.gridOffset + 10 + (audioVolume * 20)) % 200;
    ctx.fillStyle = "#110011";
    ctx.fillRect(0, horizonY, width, height / 2);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, horizonY, width, height/2);
    ctx.clip();
    ctx.strokeStyle = "#ff00cc";
    ctx.lineWidth = 2;
    for (let x = -width; x < width * 2; x += 100) {
        ctx.beginPath();
        ctx.moveTo(width / 2, horizonY);
        ctx.lineTo(width / 2 + (x - width / 2) * 4, height);
        ctx.stroke();
    }
    for (let z = 0; z < 2000; z += 200) {
        const effectiveZ = 2000 - ((z + data.gridOffset) % 2000);
        const screenY = horizonY + (200 / effectiveZ) * 400;
        if (screenY < height) {
            ctx.globalAlpha = utils.remap(effectiveZ, 0, 2000, 1, 0); 
            ctx.beginPath(); ctx.moveTo(0, screenY); ctx.lineTo(width, screenY); ctx.stroke();
        }
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    // --- 6. Text Overlay ---
    const off = audioVolume > 0.6 ? (Math.random() * 10 - 5) : 0;
    ctx.fillStyle = "white";
    ctx.font = "80px 'Press Start 2P', monospace";
    ctx.textAlign = "center";
    ctx.fillText("TIRAMISU", width / 2 + off, height / 3 + off);
};