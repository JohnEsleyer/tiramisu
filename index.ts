import { Tiramisu } from "./src/Tiramisu";
import { existsSync } from "fs";

// 1. Configuration
const AUDIO_FILE = "music.mp3";

if (!existsSync(AUDIO_FILE)) {
    console.error(`❌ Error: '${AUDIO_FILE}' not found in project root.`);
    console.error("   Please add a music file named 'music.mp3' and try again.");
    process.exit(1);
}

// Define State for Stars
interface SceneData {
    stars: { x: number, y: number, size: number, blinkOffset: number }[];
    gridOffset: number;
}

const engine = new Tiramisu<SceneData>({
    width: 1920,
    height: 1080,
    fps: 30,
    durationSeconds: 15, // Adjustable duration
    outputFile: "synthwave_vibes.mp4",
    audioFile: AUDIO_FILE,
    fonts: [
        { name: 'Press Start 2P', url: 'https://fonts.gstatic.com/s/pressstart2p/v14/e3t4euO8T-267oIAQAu6jDQyK3nVivM.woff2' }
    ],
    data: {
        stars: [],
        gridOffset: 0
    }
});

// Clip: The Main Synthwave Scene
engine.addClip(0, 30, ({ ctx, width, height, audioVolume, frame, data, utils }) => {
    
    // --- 1. Init Stars (Once) ---
    if (data.stars.length === 0) {
        for (let i = 0; i < 200; i++) {
            data.stars.push({
                x: Math.random() * width,
                y: Math.random() * (height / 2), // Stars only in sky
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
    data.stars.forEach(star => {
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
    const sunBaseSize = 250;
    const sunPulse = audioVolume * 50;
    const sunRadius = sunBaseSize + sunPulse;

    ctx.save();
    ctx.translate(width / 2, horizonY - 100);
    
    // Sun Glow
    ctx.shadowColor = "#ff00cc";
    ctx.shadowBlur = 50 + (audioVolume * 50);
    
    // Sun Gradient
    const sunGrad = ctx.createLinearGradient(0, -sunRadius, 0, sunRadius);
    // Fix: Corrected hex typo from #fwd700 to #ffd700
    sunGrad.addColorStop(0, "#ffd700");
    sunGrad.addColorStop(0.5, "#ff0055");
    sunGrad.addColorStop(1, "#9900ff");
    
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(0, 0, sunRadius, 0, Math.PI * 2);
    ctx.fill();

    // Sun Horizontal Stripes (Retro effect)
    ctx.fillStyle = "#24243e"; 
    for(let i = 0; i < 10; i++) {
        const y = i * 40 - 50;
        const h = 5 + i * 2;
        if (y < sunRadius && y > -sunRadius) {
            ctx.fillRect(-sunRadius, y, sunRadius * 2, h);
        }
    }
    ctx.restore();

    // --- 5. Retro Grid (The Ground) ---
    const speed = 10 + (audioVolume * 20); 
    data.gridOffset = (data.gridOffset + speed) % 200;

    // Ground Background
    ctx.fillStyle = "#110011";
    ctx.fillRect(0, horizonY, width, height / 2);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, horizonY, width, height/2);
    ctx.clip();

    ctx.strokeStyle = "#ff00cc";
    ctx.lineWidth = 2;
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#ff00cc";

    const centerX = width / 2;

    // Draw Vertical Lines
    for (let x = -width; x < width * 2; x += 100) {
        ctx.beginPath();
        ctx.moveTo(centerX, horizonY);
        const spread = (x - centerX) * 4; 
        ctx.lineTo(centerX + spread, height);
        ctx.stroke();
    }

    // Draw Horizontal Lines
    for (let z = 0; z < 2000; z += 200) {
        const effectiveZ = 2000 - ((z + data.gridOffset) % 2000);
        const scale = 400;
        const screenY = horizonY + (200 / effectiveZ) * scale;

        if (screenY < height) {
            ctx.lineWidth = utils.remap(effectiveZ, 0, 2000, 4, 1);
            ctx.globalAlpha = utils.remap(effectiveZ, 0, 2000, 1, 0); 
            
            ctx.beginPath();
            ctx.moveTo(0, screenY);
            ctx.lineTo(width, screenY);
            ctx.stroke();
        }
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    // --- 6. Text Overlay ---
    const offsetX = audioVolume > 0.6 ? (Math.random() * 10 - 5) : 0;
    const offsetY = audioVolume > 0.6 ? (Math.random() * 10 - 5) : 0;

    ctx.fillStyle = "white";
    ctx.font = "80px 'Press Start 2P', monospace";
    ctx.textAlign = "center";
    ctx.shadowColor = "#00d2ff";
    ctx.shadowBlur = 0;
    
    ctx.fillText("TIRAMISU", width / 2 + offsetX, height / 3 + offsetY);
    
    ctx.font = "30px 'Press Start 2P', monospace";
    ctx.fillStyle = "#ff00cc";
    ctx.fillText("AUDIO REACTIVE ENGINE", width / 2 + offsetX, height / 3 + 60 + offsetY);

    // --- 7. Vignette ---
    const grad = ctx.createRadialGradient(width/2, height/2, height/3, width/2, height/2, height);
    grad.addColorStop(0, "transparent");
    grad.addColorStop(1, "black");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

}, 0);

await engine.render();