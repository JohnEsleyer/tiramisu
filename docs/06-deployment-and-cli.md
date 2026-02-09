# Deployment and Performance

## Zero-Disk-Waste Pipeline
Tiramisu is designed for high-performance server environments. 
- **Streaming**: Instead of saving thousands of PNGs to the disk, Tiramisu captures the Puppeteer screenshot buffer and immediately writes it to the `stdin` of FFmpeg.
- **Hardware Acceleration**: The `TiramisuEncoder` automatically detects and uses:
    - `h264_nvenc` (Nvidia)
    - `h264_videotoolbox` (Apple Silicon/Intel Mac)
    - `libx264` (Fallback CPU)

## CLI Progress Bar
When rendering via the `Tiramisu` class, the console provides a live progress bar, frame counts, and a calculated ETA.

## Cache Management
The `.tiramisu-cache` folder stores extracted video frames. You can keep this folder to speed up future renders of the same video or clear it to save disk space.
