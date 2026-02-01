// src/Utils.ts
var TiramisuUtils = {
  lerp: (start, end, t) => start * (1 - t) + end * t,
  clamp: (val, min, max) => Math.min(Math.max(val, min), max),
  remap: (value, low1, high1, low2, high2) => {
    return low2 + (high2 - low2) * (value - low1) / (high1 - low1);
  },
  toRad: (deg) => deg * (Math.PI / 180),
  easeInQuad: (t) => t * t,
  easeOutQuad: (t) => t * (2 - t),
  easeInOutQuad: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeInCubic: (t) => t * t * t,
  easeOutCubic: (t) => --t * t * t + 1,
  easeInElastic: (t) => {
    if (t === 0)
      return 0;
    if (t === 1)
      return 1;
    return -Math.pow(2, 10 * (t - 1)) * Math.sin((t - 1 - 0.3 / 4) * (2 * Math.PI) / 0.3);
  },
  easeOutElastic: (t) => {
    if (t === 0)
      return 0;
    if (t === 1)
      return 1;
    return Math.pow(2, -10 * t) * Math.sin((t - 0.3 / 4) * (2 * Math.PI) / 0.3) + 1;
  },
  easeOutBounce: (t) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) {
      return n1 * t * t;
    } else if (t < 2 / d1) {
      return n1 * (t -= 1.5 / d1) * t + 0.75;
    } else if (t < 2.5 / d1) {
      return n1 * (t -= 2.25 / d1) * t + 0.9375;
    } else {
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
  },
  drawRoundedRect: (ctx, x, y, w, h, r) => {
    if (w < 2 * r)
      r = w / 2;
    if (h < 2 * r)
      r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },
  drawParagraph: (ctx, text, x, y, maxWidth, lineHeight) => {
    const words = text.split(" ");
    let line = "";
    let currentY = y;
    for (let n = 0;n < words.length; n++) {
      const testLine = line + words[n] + " ";
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, x, currentY);
        line = words[n] + " ";
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, currentY);
    return currentY + lineHeight;
  }
};
var BROWSER_UTILS_CODE = `
window.TiramisuUtils = {
    lerp: ${TiramisuUtils.lerp.toString()},
    clamp: ${TiramisuUtils.clamp.toString()},
    remap: ${TiramisuUtils.remap.toString()},
    toRad: ${TiramisuUtils.toRad.toString()},
    easeInQuad: ${TiramisuUtils.easeInQuad.toString()},
    easeOutQuad: ${TiramisuUtils.easeOutQuad.toString()},
    easeInOutQuad: ${TiramisuUtils.easeInOutQuad.toString()},
    easeInCubic: ${TiramisuUtils.easeInCubic.toString()},
    easeOutCubic: ${TiramisuUtils.easeOutCubic.toString()},
    easeInElastic: ${TiramisuUtils.easeInElastic.toString()},
    easeOutElastic: ${TiramisuUtils.easeOutElastic.toString()},
    easeOutBounce: ${TiramisuUtils.easeOutBounce.toString()},
    drawRoundedRect: ${TiramisuUtils.drawRoundedRect.toString()},
    drawParagraph: ${TiramisuUtils.drawParagraph.toString()}
};
`;

// src/Client.ts
class TiramisuPlayer {
  config;
  clips = [];
  canvas;
  ctx;
  loadedAssets = {};
  loadedVideos = {};
  isPlaying = false;
  animationFrameId = null;
  audioContext = null;
  audioBuffer = null;
  audioSource = null;
  audioAnalyser = null;
  startTime = 0;
  pausedAt = 0;
  constructor(config) {
    this.config = config;
    if (typeof config.canvas === "string") {
      this.canvas = document.getElementById(config.canvas);
    } else if (config.canvas instanceof HTMLCanvasElement) {
      this.canvas = config.canvas;
    } else {
      throw new Error("TiramisuPlayer: No valid canvas element provided.");
    }
    this.canvas.width = config.width;
    this.canvas.height = config.height;
    this.ctx = this.canvas.getContext("2d");
  }
  addClip(startSeconds, durationSeconds, fn, zIndex = 0) {
    const startFrame = Math.floor(startSeconds * this.config.fps);
    const endFrame = startFrame + Math.floor(durationSeconds * this.config.fps);
    this.clips.push({
      id: crypto.randomUUID(),
      startFrame,
      endFrame,
      zIndex,
      drawFunction: fn
    });
    this.clips.sort((a, b) => a.zIndex - b.zIndex);
  }
  async load() {
    console.log("\uD83C\uDF70 Tiramisu Client: Loading assets...");
    if (this.config.assets) {
      const promises = this.config.assets.map((src) => new Promise((resolve) => {
        const img = new Image;
        img.crossOrigin = "Anonymous";
        img.src = src;
        img.onload = () => {
          this.loadedAssets[src] = img;
          resolve();
        };
        img.onerror = () => {
          console.warn(`Failed to load ${src}`);
          resolve();
        };
      }));
      await Promise.all(promises);
    }
    if (this.config.videos) {
      const promises = this.config.videos.map((src) => new Promise((resolve) => {
        const vid = document.createElement("video");
        vid.crossOrigin = "Anonymous";
        vid.src = src;
        vid.muted = true;
        vid.playsInline = true;
        vid.style.display = "none";
        vid.preload = "auto";
        document.body.appendChild(vid);
        vid.onloadeddata = () => {
          this.loadedVideos[src] = vid;
          resolve();
        };
        vid.onerror = () => {
          console.warn(`Failed to load ${src}`);
          resolve();
        };
      }));
      await Promise.all(promises);
    }
    if (this.config.fonts) {
      const promises = this.config.fonts.map(async (f) => {
        const font = new FontFace(f.name, `url(${f.url})`);
        try {
          const loaded = await font.load();
          document.fonts.add(loaded);
        } catch (e) {
          console.error(`Failed to load font ${f.name}`, e);
        }
      });
      await Promise.all(promises);
    }
    if (this.config.audioFile) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext);
      const response = await fetch(this.config.audioFile);
      const arrayBuffer = await response.arrayBuffer();
      this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      this.audioAnalyser = this.audioContext.createAnalyser();
      this.audioAnalyser.fftSize = 256;
    }
    console.log("\uD83C\uDF70 Tiramisu Client: Ready.");
    this.renderFrame(0);
  }
  play() {
    if (this.isPlaying)
      return;
    this.isPlaying = true;
    if (this.audioContext && this.audioBuffer) {
      if (this.audioContext.state === "suspended")
        this.audioContext.resume();
      this.audioSource = this.audioContext.createBufferSource();
      this.audioSource.buffer = this.audioBuffer;
      this.audioSource.connect(this.audioAnalyser);
      this.audioAnalyser.connect(this.audioContext.destination);
      const offset = this.pausedAt;
      this.startTime = this.audioContext.currentTime - offset;
      this.audioSource.start(0, offset);
    } else {
      this.startTime = performance.now() / 1000 - this.pausedAt;
    }
    this.loop();
  }
  pause() {
    if (!this.isPlaying)
      return;
    this.isPlaying = false;
    if (this.animationFrameId)
      cancelAnimationFrame(this.animationFrameId);
    if (this.audioSource) {
      this.audioSource.stop();
      this.audioSource.disconnect();
      this.audioSource = null;
    }
    if (this.audioContext) {
      this.pausedAt = this.audioContext.currentTime - this.startTime;
    } else {
      this.pausedAt = performance.now() / 1000 - this.startTime;
    }
  }
  seek(timeSeconds) {
    this.pausedAt = TiramisuUtils.clamp(timeSeconds, 0, this.config.durationSeconds);
    if (this.isPlaying) {
      this.pause();
      this.play();
    } else {
      const frame = Math.floor(this.pausedAt * this.config.fps);
      this.renderFrame(frame);
    }
  }
  loop() {
    if (!this.isPlaying)
      return;
    let currentTime = 0;
    if (this.audioContext) {
      currentTime = this.audioContext.currentTime - this.startTime;
    } else {
      currentTime = performance.now() / 1000 - this.startTime;
    }
    if (currentTime >= this.config.durationSeconds) {
      this.pause();
      this.pausedAt = 0;
      return;
    }
    const currentFrame = Math.floor(currentTime * this.config.fps);
    this.renderFrame(currentFrame);
    this.animationFrameId = requestAnimationFrame(() => this.loop());
  }
  getAudioVolume() {
    if (!this.audioAnalyser)
      return 0;
    const dataArray = new Uint8Array(this.audioAnalyser.frequencyBinCount);
    this.audioAnalyser.getByteTimeDomainData(dataArray);
    let sum = 0;
    for (let i = 0;i < dataArray.length; i++) {
      const x = (dataArray[i] - 128) / 128;
      sum += x * x;
    }
    return Math.sqrt(sum / dataArray.length) * 2;
  }
  renderFrame(frame) {
    const totalFrames = Math.ceil(this.config.fps * this.config.durationSeconds);
    const progress = frame / (totalFrames - 1 || 1);
    const volume = this.getAudioVolume();
    this.ctx.clearRect(0, 0, this.config.width, this.config.height);
    const currentTime = frame / this.config.fps;
    Object.values(this.loadedVideos).forEach((vid) => {
      if (Math.abs(vid.currentTime - currentTime) > 0.1) {
        vid.currentTime = currentTime;
      }
    });
    for (const clip of this.clips) {
      if (frame >= clip.startFrame && frame < clip.endFrame) {
        const localFrame = frame - clip.startFrame;
        const duration = clip.endFrame - clip.startFrame;
        const localProgress = localFrame / (duration - 1 || 1);
        if (typeof clip.drawFunction === "function") {
          clip.drawFunction({
            frame,
            progress,
            localFrame,
            localProgress,
            audioVolume: volume,
            ctx: this.ctx,
            canvas: this.canvas,
            width: this.config.width,
            height: this.config.height,
            fps: this.config.fps,
            data: this.config.data || {},
            assets: this.loadedAssets,
            videos: this.loadedVideos,
            utils: TiramisuUtils
          });
        }
      }
    }
  }
}

// client-test.ts
var config = {
  width: 1280,
  height: 720,
  fps: 60,
  durationSeconds: 5,
  canvas: "preview-canvas"
};
var player = new TiramisuPlayer(config);
var backgroundClip = ({ ctx, width, height }) => {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#0f172a");
  gradient.addColorStop(1, "#1e1b4b");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
};
player.addClip(0, 5, backgroundClip, 0);
var orbClip = ({ ctx, width, height, localProgress, utils }) => {
  const x = utils.lerp(200, width - 200, (Math.sin(localProgress * Math.PI * 2 - Math.PI / 2) + 1) / 2);
  const bounce = Math.abs(Math.sin(localProgress * Math.PI * 4)) * 150;
  const y = height / 2 + 100 - bounce;
  ctx.shadowBlur = 40;
  ctx.shadowColor = "#38bdf8";
  ctx.beginPath();
  ctx.arc(x, y, 40, 0, Math.PI * 2);
  ctx.fillStyle = "white";
  ctx.fill();
  ctx.shadowBlur = 0;
};
player.addClip(0, 5, orbClip, 1);
var textClip = ({ ctx, width, height, localProgress, utils }) => {
  let opacity = 1;
  if (localProgress < 0.2)
    opacity = localProgress / 0.2;
  if (localProgress > 0.8)
    opacity = 1 - (localProgress - 0.8) / 0.2;
  const entryProgress = Math.min(localProgress / 0.3, 1);
  const yOffset = utils.lerp(50, 0, utils.easeOutCubic(entryProgress));
  ctx.globalAlpha = opacity;
  ctx.fillStyle = "white";
  ctx.font = "bold 60px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("CREATED WITH TIRAMISU", width / 2, height / 2 + yOffset);
  ctx.globalAlpha = 1;
};
player.addClip(1, 3, textClip, 2);
player.load().then(() => {
  console.log("Starting client preview...");
  player.play();
});
window.tiramisuPlayer = player;
