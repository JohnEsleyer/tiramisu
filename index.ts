import { existsSync } from "node:fs";
import { Tiramisu } from "./src/Tiramisu";
import { drawSynthwave } from "./src/scenes/SynthwaveScene";
import type { SceneData } from "./src/types";

const AUDIO_FILE = "music.mp3";

if (!existsSync(AUDIO_FILE)) {
    console.error(`❌ Error: '${AUDIO_FILE}' not found. Please add music.mp3.`);
    process.exit(1);
}

const engine = new Tiramisu<SceneData>({
    width: 1920,
    height: 1080,
    fps: 30,
    durationSeconds: 15,
    outputFile: "synthwave_vibes.mp4",
    audioFile: AUDIO_FILE,
    fonts: [{ name: 'Press Start 2P', url: 'https://fonts.gstatic.com/s/pressstart2p/v14/e3t4euO8T-267oIAQAu6jDQyK3nVivM.woff2' }],
    data: { stars: [], gridOffset: 0 }
});

engine.addClip(0, 15, drawSynthwave, 0);

await engine.render();