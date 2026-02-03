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
  easeOutBounce: (t) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1)
      return n1 * t * t;
    else if (t < 2 / d1)
      return n1 * (t -= 1.5 / d1) * t + 0.75;
    else if (t < 2.5 / d1)
      return n1 * (t -= 2.25 / d1) * t + 0.9375;
    else
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
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
  drawMediaCover: (ctx, media, targetW, targetH) => {
    if (!media)
      return;
    let sw = 0;
    let sh = 0;
    if (media instanceof HTMLVideoElement) {
      sw = media.videoWidth;
      sh = media.videoHeight;
    } else if (media instanceof HTMLImageElement) {
      sw = media.naturalWidth || media.width;
      sh = media.naturalHeight || media.height;
    }
    if (sw === 0 || sh === 0)
      return;
    const targetRatio = targetW / targetH;
    const sourceRatio = sw / sh;
    let dw, dh, dx, dy;
    if (sourceRatio > targetRatio) {
      dh = targetH;
      dw = targetH * sourceRatio;
      dx = (targetW - dw) / 2;
      dy = 0;
    } else {
      dw = targetW;
      dh = targetW / sourceRatio;
      dx = 0;
      dy = (targetH - dh) / 2;
    }
    ctx.drawImage(media, dx, dy, dw, dh);
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
    easeOutBounce: ${TiramisuUtils.easeOutBounce.toString()},
    drawRoundedRect: ${TiramisuUtils.drawRoundedRect.toString()},
    drawMediaCover: ${TiramisuUtils.drawMediaCover.toString()}
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
    this.loadedAssets = {};
    Object.values(this.loadedVideos).forEach((v) => v.remove());
    this.loadedVideos = {};
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
        vid.onerror = (e) => {
          console.warn(`Failed to load video ${src}`, e);
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
      try {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext);
        const response = await fetch(this.config.audioFile);
        const arrayBuffer = await response.arrayBuffer();
        this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
        this.audioAnalyser = this.audioContext.createAnalyser();
        this.audioAnalyser.fftSize = 256;
      } catch (e) {
        console.error("Failed to load audio file", e);
      }
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
    Object.values(this.loadedVideos).forEach((v) => v.pause());
    if (this.audioSource) {
      this.audioSource.stop();
      this.audioSource.disconnect();
      this.audioSource = null;
    }
    this.pausedAt = this.audioContext ? this.audioContext.currentTime - this.startTime : performance.now() / 1000 - this.startTime;
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
    const targetTime = frame / this.config.fps;
    Object.values(this.loadedVideos).forEach((vid) => {
      if (this.isPlaying) {
        if (vid.paused)
          vid.play().catch(() => {});
        const drift = Math.abs(vid.currentTime - targetTime);
        if (drift > 0.2)
          vid.currentTime = targetTime;
      } else {
        if (!vid.paused)
          vid.pause();
        if (!vid.seeking && Math.abs(vid.currentTime - targetTime) > 0.05) {
          vid.currentTime = targetTime;
        }
      }
    });
    this.ctx.clearRect(0, 0, this.config.width, this.config.height);
    for (const clip of this.clips) {
      if (frame >= clip.startFrame && frame < clip.endFrame) {
        if (typeof clip.drawFunction === "function") {
          clip.drawFunction({
            frame,
            progress,
            localFrame: frame - clip.startFrame,
            localProgress: (frame - clip.startFrame) / (clip.endFrame - clip.startFrame - 1 || 1),
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

// examples/split-screen/app.ts
var appState = {
  width: 1280,
  height: 720,
  wipe: 0.5,
  videoA: null,
  videoB: null,
  duration: 5
};
var canvasId = "preview-canvas";
var player = new TiramisuPlayer({
  width: appState.width,
  height: appState.height,
  fps: 30,
  durationSeconds: appState.duration,
  canvas: canvasId,
  data: appState
});
player.addClip(0, 600, ({ ctx, width, height, videos, data }) => {
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, width, height);
  if (data.videoA && videos[data.videoA]) {
    ctx.drawImage(videos[data.videoA], 0, 0, width, height);
  } else {
    drawPlaceholder(ctx, "VIDEO A", width, height);
  }
}, 0);
player.addClip(0, 600, ({ ctx, width, height, videos, data }) => {
  if (!data.videoB || !videos[data.videoB])
    return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(width * data.wipe, 0, width * (1 - data.wipe), height);
  ctx.clip();
  ctx.drawImage(videos[data.videoB], 0, 0, width, height);
  ctx.restore();
}, 1);
player.addClip(0, 600, ({ ctx, width, height, data }) => {
  const x = width * data.wipe;
  ctx.strokeStyle = "white";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, height);
  ctx.stroke();
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(x, height / 2, 20, 0, Math.PI * 2);
  ctx.fill();
}, 2);
function drawPlaceholder(ctx, text, w, h) {
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#475569";
  ctx.font = "bold 40px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(text, w / 2, h / 2);
}
var btnExport = document.getElementById("btn-export");
var videoAInput = document.getElementById("video-a");
var videoBInput = document.getElementById("video-b");
var wipeRange = document.getElementById("wipe-range");
var btnPlay = document.getElementById("btn-play");
var statusEl = document.getElementById("status");
function updateExportButtonState() {
  if (videoAInput.files?.length && videoBInput.files?.length) {
    btnExport.disabled = false;
    btnExport.classList.remove("bg-slate-700", "text-slate-400", "cursor-not-allowed");
    btnExport.classList.add("bg-pink-600", "text-white", "hover:bg-pink-700");
  }
}
videoAInput.addEventListener("change", updateExportButtonState);
videoBInput.addEventListener("change", updateExportButtonState);
btnExport.addEventListener("click", async () => {
  const fileA = videoAInput.files?.[0];
  const fileB = videoBInput.files?.[0];
  if (!fileA || !fileB)
    return;
  btnExport.disabled = true;
  btnExport.innerText = "⏳ Uploading...";
  statusEl.innerText = "\uD83D\uDE80 Processing split-screen render on server...";
  try {
    const formData = new FormData;
    formData.append("videoA", fileA);
    formData.append("videoB", fileB);
    formData.append("wipe", appState.wipe.toString());
    formData.append("duration", appState.duration.toString());
    formData.append("width", appState.width.toString());
    formData.append("height", appState.height.toString());
    const response = await fetch("/api/export-split", {
      method: "POST",
      body: formData
    });
    if (!response.ok)
      throw new Error("Split render failed");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comparison_render.mp4`;
    a.click();
    URL.revokeObjectURL(url);
    statusEl.innerText = "✨ Render Complete!";
  } catch (e) {
    console.error(e);
    statusEl.innerText = "❌ Export Failed.";
  } finally {
    btnExport.disabled = false;
    btnExport.innerText = "\uD83C\uDFAC Export MP4";
    updateExportButtonState();
  }
});
var handleFile = async (file, key) => {
  const url = URL.createObjectURL(file);
  appState[key] = url;
  const tempVid = document.createElement("video");
  tempVid.src = url;
  await new Promise((r) => tempVid.onloadedmetadata = r);
  appState.duration = Math.min(appState.duration, tempVid.duration);
  player.config.durationSeconds = appState.duration;
  player.config.videos = [appState.videoA, appState.videoB].filter(Boolean);
  await player.load();
  player.seek(0);
  statusEl.innerText = `Loaded ${file.name}`;
};
videoAInput.onchange = (e) => handleFile(e.target.files[0], "videoA");
videoBInput.onchange = (e) => handleFile(e.target.files[0], "videoB");
wipeRange.oninput = (e) => {
  appState.wipe = parseFloat(e.target.value);
  if (!player.isPlaying)
    player.renderFrame(Math.floor(player.pausedAt * 30));
};
btnPlay.onclick = () => {
  if (player.isPlaying) {
    player.pause();
    btnPlay.innerText = "▶ Play Preview";
  } else {
    player.play();
    btnPlay.innerText = "⏸ Pause Preview";
  }
};
