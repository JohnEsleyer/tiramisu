import { Tiramisu, type RenderContext } from "./src/Tiramisu";

// Define the shape of our injected data
interface MyVideoData {
    title: string;
    subtitle: string;
    primaryColor: string;
}

// 1. Setup Engine
const engine = new Tiramisu<MyVideoData>({
    width: 1920,
    height: 1080,
    fps: 60,
    durationSeconds: 4,
    outputFile: "advanced_demo.mp4",
    // Injected Data
    data: {
        title: "Tiramisu Assets",
        subtitle: "Image Preloading & Data Injection",
        primaryColor: "#00d2ff"
    },
    // Assets to Preload (Remote URL for demo purposes)
    assets: [
        "https://upload.wikimedia.org/wikipedia/commons/6/65/Bun_logo.svg"
    ]
});

// 2. Define Scene
engine.scene(({ ctx, width, height, progress, frame, data, assets }) => {
    // Background
    const bgGradient = ctx.createLinearGradient(0, 0, width, height);
    bgGradient.addColorStop(0, "#1a1a2e");
    bgGradient.addColorStop(1, "#16213e");
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Dynamic Data Usage
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Draw Preloaded Image
    const logoUrl = "https://upload.wikimedia.org/wikipedia/commons/6/65/Bun_logo.svg";
    const logo = assets[logoUrl];
    
    if (logo) {
        const logoSize = 300;
        const floatY = Math.sin(progress * Math.PI * 2) * 20;
        
        ctx.save();
        ctx.translate(centerX, centerY - 50 + floatY);
        // Simple shadow
        ctx.shadowColor = data.primaryColor;
        ctx.shadowBlur = 40;
        ctx.drawImage(logo, -logoSize/2, -logoSize/2, logoSize, logoSize);
        ctx.restore();
    }

    // Text Animations
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    
    // Title
    ctx.font = "bold 80px sans-serif";
    ctx.fillText(data.title, centerX, centerY + 200);

    // Subtitle (Typewriter effect)
    ctx.font = "40px monospace";
    ctx.fillStyle = data.primaryColor;
    
    const charsToShow = Math.floor(data.subtitle.length * Math.min(progress * 2, 1));
    const currentText = data.subtitle.substring(0, charsToShow);
    ctx.fillText(currentText, centerX, centerY + 270);

    // Progress bar at bottom
    ctx.fillStyle = data.primaryColor;
    ctx.fillRect(0, height - 10, width * progress, 10);
});

// 3. Render
await engine.render();