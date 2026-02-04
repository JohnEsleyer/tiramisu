```markdown
# Deployment and CLI

## Zero-Disk Pipeline
Tiramisu is designed for high-performance server environments. 

1.  **Headless Browser**: Starts a Puppeteer instance.
2.  **Streaming**: Instead of saving thousands of PNGs to your hard drive, Tiramisu takes the screenshot buffer and immediately writes it to the `stdin` of FFmpeg.
3.  **Hardware Acceleration**: The `TiramisuEncoder` automatically detects `h264_nvenc` (Nvidia) or `h264_videotoolbox` (Apple Silicon) to speed up encoding.

## Clean Up
Tiramisu generates a `.tiramisu-cache` folder to store extracted video frames. You should periodically clear this folder in production to save space, or use it as a persistent cache to speed up subsequent renders of the same source video.
```