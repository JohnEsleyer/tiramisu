import { TiramisuPlayer } from "../../src/Client.js";

const player = new TiramisuPlayer({
    width: 1280, height: 720, fps: 30, durationSeconds: 5,
    canvas: "marketing-canvas",
    videos: ['/bg.mp4', '/product.mp4']
});

player.addClip(0, 5, ({ ctx, width, height, localProgress, layer, videos, utils }) => {
    // 1. Create Background Layer
    const bg = layer.create();
    if (videos.has('/bg.mp4')) {
        videos.get('/bg.mp4').getFrame(localProgress * 5).then(bitmap => {
            utils.drawMediaCover(bg.ctx, bitmap, width, height);
        });
    }
    bg.applyBlur(15);
    bg.drawTo(ctx);

    // 2. Create Masked Video (Luma Matte)
    const drawText = (c) => {
        c.font = "900 200px Montserrat";
        c.textAlign = "center";
        c.fillStyle = "white";
        c.fillText("SALE", width/2, height/2);
    };
    
    const drawProduct = (c) => {
        if (videos.has('/product.mp4')) {
            videos.get('/product.mp4').getFrame(localProgress * 5).then(bitmap => {
                utils.drawMediaFit(c, bitmap, width, height);
            });
        }
    };

    // Use the custom drawMasked utility
    utils.drawMasked(ctx, drawProduct, drawText);
    
    // 3. Dynamic UI Ticker
    ctx.fillStyle = "rgba(255, 0, 0, 0.8)";
    const tickerX = (localProgress * -2000) % width;
    ctx.font = "40px Monospace";
    ctx.fillText("50% OFF - LIMITED TIME - 50% OFF - LIMITED TIME", tickerX, 700);
    
    // 4. Pulsing CTA Button
    const pulse = Math.sin(localProgress * Math.PI * 4) * 0.1 + 1;
    const buttonScale = pulse;
    
    ctx.save();
    ctx.translate(width - 200, height - 100);
    ctx.scale(buttonScale, buttonScale);
    
    // Button background
    ctx.fillStyle = "#ff4444";
    ctx.fillRect(-80, -30, 160, 60);
    
    // Button text
    ctx.fillStyle = "white";
    ctx.font = "bold 24px Arial";
    ctx.textAlign = "center";
    ctx.fillText("BUY NOW!", 0, 8);
    
    ctx.restore();
    
    // 5. Price Tag Animation
    const priceOpacity = Math.min(localProgress * 3, 1);
    ctx.globalAlpha = priceOpacity;
    
    ctx.fillStyle = "#00ff00";
    ctx.font = "bold 48px Arial";
    ctx.textAlign = "center";
    ctx.fillText("$299 $149", width/2, height - 50);
    
    ctx.globalAlpha = 1;
});

player.load();

// Animation controls
let isPlaying = false;

document.getElementById('play-btn').onclick = () => {
    if (!isPlaying) {
        player.play();
        isPlaying = true;
    }
};

document.getElementById('pause-btn').onclick = () => {
    player.pause();
    isPlaying = false;
};

document.getElementById('render-btn').onclick = async () => {
    const response = await fetch('/api/render-marketing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            template: 'sale-promo',
            duration: 5,
            customText: 'FLASH SALE'
        })
    });
    
    if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'marketing-video.mp4';
        a.click();
        URL.revokeObjectURL(url);
    }
};