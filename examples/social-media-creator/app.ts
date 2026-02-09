import { TiramisuPlayer } from "../../src/Client.js";

// Social media templates
const socialTemplates = {
    tiktok: { width: 1080, height: 1920, ratio: "9:16" },
    instagram: { width: 1080, height: 1080, ratio: "1:1" },
    youtube: { width: 1920, height: 1080, ratio: "16:9" },
    twitter: { width: 1200, height: 675, ratio: "16:9" }
};

let currentTemplate = socialTemplates.tiktok;

const player = new TiramisuPlayer({
    width: currentTemplate.width,
    height: currentTemplate.height,
    fps: 30,
    durationSeconds: 15,
    canvas: "social-canvas",
    videos: ['/bg.mp4', '/content.mp4']
});

// TikTok-style viral content generator
const renderTikTokStyle = ({ ctx, width, height, frame, fps, localProgress, videos, layer, utils, audioVolume }) => {
    const time = frame / fps;
    
    // Dynamic gradient background based on audio
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    const hue = (audioVolume * 360 + localProgress * 180) % 360;
    gradient.addColorStop(0, `hsl(${hue}, 70%, 60%)`);
    gradient.addColorStop(1, `hsl(${(hue + 60) % 360}, 70%, 40%)`);
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // Main content area with video
    const contentSize = Math.min(width * 0.8, height * 0.6);
    const contentX = (width - contentSize) / 2;
    const contentY = height * 0.2;
    
    // Video content with zoom effect
    if (videos.has('/content.mp4')) {
        videos.get('/content.mp4').getFrame(time).then(bitmap => {
            const zoom = 1 + Math.sin(localProgress * Math.PI * 2) * 0.1;
            ctx.save();
            ctx.translate(contentX + contentSize/2, contentY + contentSize/2);
            ctx.scale(zoom, zoom);
            ctx.translate(-contentSize/2, -contentSize/2);
            
            // Rounded corners mask
            utils.drawRoundedRect(ctx, 0, 0, contentSize, contentSize, 30);
            ctx.clip();
            
            utils.drawMediaCover(ctx, bitmap, contentSize, contentSize);
            ctx.restore();
        });
    }
    
    // Text overlay with typewriter effect
    const text = "This changed my life! 🤯 #viral #trending #amazing";
    const visibleChars = Math.floor(localProgress * text.length);
    const visibleText = text.substring(0, visibleChars);
    
    // Text background
    const textBg = layer.create(width, height);
    textBg.ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    textBg.ctx.fillRect(20, height - 150, width - 40, 130);
    
    // Main text
    textBg.ctx.fillStyle = "white";
    textBg.ctx.font = "bold 48px Arial";
    textBg.ctx.textAlign = "left";
    textBg.ctx.fillText(visibleText, 40, height - 80);
    
    // Hashtags with animation
    const hashtags = ["#fyp", "#viral", "#trending", "#lifehacks", "#mindblown"];
    hashtags.forEach((tag, index) => {
        const tagOpacity = Math.max(0, localProgress - index * 0.1);
        textBg.ctx.globalAlpha = tagOpacity;
        textBg.ctx.fillStyle = `hsl(${(hue + index * 30) % 360}, 80%, 70%)`;
        textBg.ctx.font = "bold 36px Arial";
        textBg.ctx.fillText(tag, 40 + index * 200, height - 30);
    });
    
    textBg.drawTo(ctx);
    
    // Side panel with engagement metrics
    const sidePanel = layer.create(120, height);
    sidePanel.ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    sidePanel.ctx.fillRect(0, 0, 120, height);
    
    // Heart icon with pulse
    const heartSize = 60 + Math.sin(localProgress * Math.PI * 8) * 10;
    sidePanel.ctx.fillStyle = "#ff0050";
    sidePanel.ctx.font = `${heartSize}px Arial`;
    sidePanel.ctx.textAlign = "center";
    sidePanel.ctx.fillText("❤️", 60, height * 0.3);
    
    // Engagement numbers
    sidePanel.ctx.fillStyle = "white";
    sidePanel.ctx.font = "bold 24px Arial";
    const likes = Math.floor(1000000 + localProgress * 500000);
    sidePanel.ctx.fillText(likes.toLocaleString(), 60, height * 0.3 + 80);
    
    sidePanel.drawTo(ctx);
    
    // Watermark/logo
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.font = "bold 32px Arial";
    ctx.textAlign = "right";
    ctx.fillText("@CreatorName", width - 20, 40);
};

// Instagram story style
const renderInstagramStory = ({ ctx, width, height, localProgress, videos, layer, utils }) => {
    // Gradient background
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#405DE6");
    gradient.addColorStop(0.5, "#5851DB");
    gradient.addColorStop(1, "#833AB4");
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // User avatar and name
    ctx.fillStyle = "white";
    ctx.font = "bold 36px Arial";
    ctx.textAlign = "left";
    ctx.fillText("@yourstory", 40, 80);
    
    // Content with polls and stickers simulation
    const contentArea = layer.create(width * 0.8, height * 0.7);
    contentArea.ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    contentArea.ctx.fillRect(0, 0, width * 0.8, height * 0.7);
    
    // Poll sticker
    contentArea.ctx.fillStyle = "#ffffff";
    contentArea.ctx.font = "bold 32px Arial";
    contentArea.ctx.textAlign = "center";
    contentArea.ctx.fillText("What's your favorite?", width * 0.4, 100);
    
    // Poll options with progress bars
    const pollOptions = ["Coffee", "Tea", "Smoothies"];
    pollOptions.forEach((option, index) => {
        const y = 150 + index * 80;
        const progress = Math.random() * 0.5 + 0.2; // Simulated poll data
        
        contentArea.ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
        contentArea.ctx.fillRect(50, y, width * 0.6, 40);
        
        contentArea.ctx.fillStyle = "#ffffff";
        contentArea.ctx.fillRect(50, y, width * 0.6 * progress, 40);
        
        contentArea.ctx.fillStyle = "#000000";
        contentArea.ctx.font = "bold 24px Arial";
        contentArea.ctx.fillText(`${option} (${Math.round(progress * 100)}%)`, width * 0.4, y + 28);
    });
    
    contentArea.drawTo(ctx);
    
    // Story progress bar
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.fillRect(0, 0, width, 4);
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, width * localProgress, 4);
};

// YouTube thumbnail generator style
const renderYouTubeStyle = ({ ctx, width, height, localProgress, videos, layer, utils }) => {
    // Bold, eye-catching background
    ctx.fillStyle = "#FF0000";
    ctx.fillRect(0, 0, width, height);
    
    // Chaos effect with multiple elements
    const elements = 10;
    for (let i = 0; i < elements; i++) {
        const x = (Math.random() * width);
        const y = (Math.random() * height);
        const size = Math.random() * 100 + 50;
        const hue = (localProgress * 360 + i * 36) % 360;
        
        ctx.fillStyle = `hsl(${hue}, 80%, 60%)`;
        ctx.fillRect(x, y, size, size);
    }
    
    // Big bold text
    ctx.fillStyle = "yellow";
    ctx.font = "900 120px Arial";
    ctx.textAlign = "center";
    ctx.strokeStyle = "black";
    ctx.lineWidth = 8;
    ctx.strokeText("YOU WON'T BELIEVE", width/2, height/2);
    ctx.fillText("YOU WON'T BELIEVE", width/2, height/2);
    
    // More bold text
    ctx.fillStyle = "white";
    ctx.font = "900 80px Arial";
    ctx.strokeStyle = "red";
    ctx.lineWidth = 6;
    ctx.strokeText("WHAT HAPPENS NEXT!", width/2, height/2 + 100);
    ctx.fillText("WHAT HAPPENS NEXT!", width/2, height/2 + 100);
    
    // Thumbnail face (simulated)
    const faceY = height * 0.3;
    ctx.fillStyle = "#FFD700";
    ctx.beginPath();
    ctx.arc(width * 0.2, faceY, 80, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = "black";
    ctx.beginPath();
    ctx.arc(width * 0.18, faceY - 20, 10, 0, Math.PI * 2);
    ctx.arc(width * 0.22, faceY - 20, 10, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = "red";
    ctx.beginPath();
    ctx.arc(width * 0.2, faceY + 10, 30, 0, Math.PI);
    ctx.fill();
};

// Template switching functionality
function switchTemplate(templateName) {
    currentTemplate = socialTemplates[templateName];
    
    // Update canvas
    const canvas = document.getElementById('social-canvas');
    canvas.width = currentTemplate.width;
    canvas.height = currentTemplate.height;
    
    // Update player configuration
    player.updateConfig({
        width: currentTemplate.width,
        height: currentTemplate.height
    });
    
    // Select appropriate render function
    switch(templateName) {
        case 'tiktok':
            player.clearClips();
            player.addClip(0, 15, renderTikTokStyle);
            break;
        case 'instagram':
            player.clearClips();
            player.addClip(0, 15, renderInstagramStory);
            break;
        case 'youtube':
            player.clearClips();
            player.addClip(0, 5, renderYouTubeStyle); // Thumbnails are static
            break;
    }
    
    player.load();
}

// Initialize with TikTok template
switchTemplate('tiktok');

// Export template switching function
if (typeof window !== 'undefined') {
    (window as any).switchTemplate = switchTemplate;
    (window as any).socialTemplates = socialTemplates;
}

// UI event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Template buttons
    document.querySelectorAll('.template-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const template = e.target.dataset.template;
            switchTemplate(template);
            
            // Update active button
            document.querySelectorAll('.template-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
        });
    });
    
    // Play controls
    document.getElementById('play-btn').onclick = () => {
        player.play();
    };
    
    document.getElementById('pause-btn').onclick = () => {
        player.pause();
    };
    
    // Render buttons
    document.getElementById('render-btn').onclick = async () => {
        const response = await fetch('/api/render-social', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                template: Object.keys(socialTemplates).find(key => socialTemplates[key] === currentTemplate),
                format: 'mp4',
                quality: 'high'
            })
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `social-${currentTemplate.ratio}.mp4`;
            a.click();
            URL.revokeObjectURL(url);
        }
    };
});

export { switchTemplate, socialTemplates };