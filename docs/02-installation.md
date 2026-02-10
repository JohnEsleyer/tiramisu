# Installation

## Requirements

- Node.js 18+ for server rendering.
- FFmpeg available on PATH for encoding and audio analysis.
- A modern browser for client preview.
- WebGL2 and WebCodecs for the WebGL pipelines.

## Install As A Library

```bash
npm install tiramisu
```

## Install From Source

```bash
git clone https://github.com/JohnEsleyer/tiramisu.git
cd tiramisu
pnpm install
```

## Optional: Audio Analyzer (Server)

Audio analysis uses a WASM module and FFmpeg. If the WASM module is missing or fails to load, Tiramisu falls back to silence. Ensure FFmpeg is available if you want audio-reactive data.

## Build And Run (Repo)

```bash
pnpm run build
pnpm run typecheck
pnpm run dev
```

## Browser Compatibility Notes

- WebGL2 is required for shader effects.
- WebCodecs + MP4Box are required for GPU-accelerated MP4 decoding.
- If WebCodecs is not available, use the 2D canvas player or `data.useVideoElement` on the server.
