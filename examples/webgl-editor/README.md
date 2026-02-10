# WebGL Editor Example

A complete WebGL-powered video editing interface showcasing Tiramisu 2.0 capabilities.

## Features

- **Real-time Video Editing**: Load and edit videos with GPU-accelerated effects
- **WebGL Effects**: Brightness, contrast, saturation, grayscale, blur, and more
- **GL Transitions**: CrossZoom, Swirl, PageCurl, Glitch, and FilmBurn
- **Live Preview**: See changes in real-time as you adjust parameters
- **Modern UI**: Clean, responsive interface with intuitive controls

## Usage

1. **Start the dev server**:
   ```bash
   pnpm run dev:server
   ```

2. **Open in browser**:
   Navigate to `http://localhost:3001/examples/webgl-editor/`

3. **Load videos**:
   - Click "Load Video 1" or "Load Video 2" buttons
   - Or use the "Load Sample Video" button for demo content

4. **Apply effects**:
   - Use the adjustment sliders for brightness, contrast, and saturation
   - Click effect buttons to add grayscale or blur
   - Select GL transitions from the dropdown

5. **Playback**:
   - Use play/pause buttons
   - Scrub with the seek bar

## Technical Details

- Uses `TiramisuEditor` with WebGL2 and WebCodecs
- Real-time shader-based effects processing
- GPU texture pooling for performance
- Memory-efficient video frame management

## Requirements

- Modern browser with WebGL2 support
- WebCodecs API support (Chrome 94+, Edge 94+)
- Sufficient GPU memory for video processing

## File Structure

```
examples/webgl-editor/
├── index.html          # Main UI interface
├── app.ts              # Application logic
├── app.js              # Compiled JavaScript
├── app.js.map          # Source map
└── demo.ts             # Demo implementation
```