# Troubleshooting

## FFmpeg Not Found

Server rendering and audio analysis require FFmpeg on PATH.

- Verify with `ffmpeg -version`.
- Install via your OS package manager.

## Blank Frames In Server Render

Common causes:

- The draw function closes over values that are not serializable. Use `config.data` instead.
- Asset paths are wrong. Paths are resolved from the project root and served by the internal HTTP server.

## WebCodecs Errors

- Ensure your browser supports WebCodecs.
- Ensure MP4Box is loaded and available as `window.MP4Box`.
- If WebCodecs is unreliable, set `data.useVideoElement = true` for server rendering or use `TiramisuPlayer` for preview.

## Audio Playback Doesn’t Start

Browsers require a user gesture before playing audio. Call `player.play()` from a click or input handler.

## Fonts Not Applying

`FontFace` loading happens during `load()`. Confirm the font URL is accessible and check browser network logs.

## GPU Context Issues

If WebGL2 fails to initialize, confirm your environment allows hardware acceleration and does not block WebGL.
