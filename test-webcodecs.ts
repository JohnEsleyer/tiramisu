import { Tiramisu } from "./src/Tiramisu";

const video = new Tiramisu({
    width: 1280,
    height: 720,
    fps: 30,
    durationSeconds: 2,
    outputFile: "./test-output.mp4",
    videos: ["./examples/assets/sample.mp4"],
});

video.addClip(0, 2, ({ ctx, width, height, videos }) => {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, width, height);
    
    const video = videos["./examples/assets/sample.mp4"];
    if (video) {
        ctx.drawImage(video, 0, 0, width, height);
    }
});

console.log("Starting render with WebCodecs...");
video.render().then(() => {
    console.log("Render complete!");
}).catch(err => {
    console.error("Render failed:", err);
});