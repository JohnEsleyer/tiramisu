# Overview

Tiramisu is a TypeScript video engine focused on two workflows:

- Server-side rendering: compose frames with a familiar 2D canvas API and export to MP4 via FFmpeg.
- Client-side preview: render the same composition logic in the browser for interactive playback, including audio-reactive visuals.

In Tiramisu 2.x, a WebGL/WebCodecs pipeline was added for GPU-accelerated playback and shader-based effects.

## What You Can Build

- Programmatic video generation (titles, kinetic typography, data-driven animations)
- Browser previews of server-rendered scenes
- WebGL-powered effect chains for video clips
- Multi-clip compositions with audio-reactive animations

## Key APIs (Exports)

- `Tiramisu`: server-side renderer that captures canvas frames and pipes them into FFmpeg.
- `TiramisuPlayer`: client-side 2D canvas previewer for the same clip-based API.
- `TiramisuWebGLPlayer`: WebGL/WebCodecs previewer with shader effects.
- `TiramisuEditor`: editor-style WebGL API with tracks, clips, and effects.
- WebGL components: `TiramisuRenderer`, `TextureManager`, `ShaderManager`, `WebCodecsVideoSource`, plus GLSL shader constants.

## Core Model

- A video is composed of clips.
- Each clip has a time range and a draw function.
- Draw functions receive a render context with frame timing, assets, audio analysis data, and utility helpers.
- On the server, the draw function is stringified and executed inside a headless browser.

## When To Use Which API

- Use `Tiramisu` for final MP4 export.
- Use `TiramisuPlayer` for local preview or embedding in a web app.
- Use `TiramisuWebGLPlayer` or `TiramisuEditor` for GPU-based effects and WebCodecs decoding.
