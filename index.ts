import { Tiramisu } from "./src/Tiramisu";

const VIDEO_URL = "https://upload.wikimedia.org/wikipedia/commons/transcoded/c/c0/Big_Buck_Bunny_4K.webm/Big_Buck_Bunny_4K.webm.480p.vp9.webm";

const engine = new Tiramisu({
    width: 1280,
    height: 720,
    fps: 30,
    durationSeconds: 5,
    outputFile: "video_asset_demo.mp4",
    // Pass the URL here so it's available in the browser via 'data'
    data: {
        videoUrl: VIDEO_URL
    },
    videos: [
        VIDEO_URL
    ]
});

// Clip 1: Background Video
engine.addClip(0, 5, ({ ctx, width, height, videos, data }) => {
    // Access via 'data.videoUrl' instead of the external variable
    const vid = videos[data.videoUrl];
    if (vid) {
        ctx.drawImage(vid, 0, 0, width, height);
        
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        ctx.fillRect(0, 0, width, height);
    }
}, 0);

// Clip 2: Picture in Picture
engine.addClip(0, 5, ({ ctx, width, height, videos, localProgress, data }) => {
    const vid = videos[data.videoUrl];
    if (vid) {
        const scale = 0.4;
        const w = width * scale;
        const h = height * scale;
        
        const yOffset = Math.sin(localProgress * Math.PI * 2) * 20;
        const x = width - w - 50;
        const y = 50 + yOffset;

        ctx.lineWidth = 10;
        ctx.strokeStyle = "white";
        ctx.strokeRect(x, y, w, h);

        ctx.drawImage(vid, x, y, w, h);
        
        ctx.fillStyle = "white";
        ctx.font = "bold 30px sans-serif";
        ctx.fillText("Frame Perfect Sync", x, y + h + 40);
    }
}, 1);

await engine.render();