import { TiramisuPlayer } from "../../src/Client.js";

interface TrackItem {
    id: string;
    type: 'video' | 'text';
    start: number;
    duration: number;
    content: string; // URL or Text
    x: number;
    y: number;
    scale: number;
    filters: {
        blur: number;
        brightness: number;
    }
}

const project: TrackItem[] = [
    { 
        id: '1', type: 'video', start: 0, duration: 10, 
        content: '/nature.mp4', x: 0, y: 0, scale: 1,
        filters: { blur: 0, brightness: 1 } 
    },
    { 
        id: '2', type: 'text', start: 2, duration: 5, 
        content: 'ADVENTURE AWAITS', x: 640, y: 360, scale: 1,
        filters: { blur: 0, brightness: 1 } 
    }
];

const player = new TiramisuPlayer({
    width: 1280, height: 720, fps: 30, durationSeconds: 10,
    canvas: "editor-canvas",
    videos: project.filter(i => i.type === 'video').map(i => i.content)
});

// The Unified Rendering Logic (Works for Preview and MP4 Export)
const renderProject = ({ ctx, width, height, frame, fps, videos, layer, utils }) => {
    const time = frame / fps;

    project.forEach(item => {
        if (time >= item.start && time < (item.start + item.duration)) {
            const itemLayer = layer.create(width, height);
            
            if (item.type === 'video' && videos.get(item.content)) {
                videos.get(item.content).getFrame(time).then(bitmap => {
                    utils.drawMediaCover(itemLayer.ctx, bitmap, width, height);
                });
            } else if (item.type === 'text') {
                itemLayer.ctx.fillStyle = "white";
                itemLayer.ctx.font = `bold ${80 * item.scale}px Inter`;
                itemLayer.ctx.textAlign = "center";
                itemLayer.ctx.fillText(item.content, item.x, item.y);
            }

            // Apply Dynamic Effects
            if (item.filters.blur > 0) itemLayer.applyBlur(item.filters.blur);
            if (item.filters.brightness !== 1) itemLayer.applyBrightness(item.filters.brightness - 1);
            
            itemLayer.drawTo(ctx);
        }
    });
};

player.addClip(0, 10, renderProject);
player.load();

// --- Interactive UI Logic ---
// Drag and drop text
window.addEventListener('mousedown', (e) => {
    const textItem = project.find(i => i.type === 'text');
    if (textItem) {
        textItem.x = e.clientX; // Simplified drag
        textItem.y = e.clientY;
        player.renderFrame(Math.floor((player as any).pausedAt * 30));
    }
});

// Render Trigger
document.getElementById('render-btn').onclick = async () => {
    const response = await fetch('/api/render-pro', {
        method: 'POST',
        body: JSON.stringify({ project })
    });
    // Download logic...
};