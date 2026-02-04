// src/Utils.ts
var mulberry32 = (a) => {
  return function() {
    let t = a += 1831565813;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
};
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
  seededRandomGenerator: (seed) => mulberry32(seed),
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
  drawMediaFit: (ctx, media, targetW, targetH) => {
    if (!media)
      return;
    let sw = 0, sh = 0;
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
      dw = targetW;
      dh = targetW / sourceRatio;
      dx = 0;
      dy = (targetH - dh) / 2;
    } else {
      dh = targetH;
      dw = targetH * sourceRatio;
      dx = (targetW - dw) / 2;
      dy = 0;
    }
    ctx.drawImage(media, dx, dy, dw, dh);
  },
  drawMediaCover: (ctx, media, targetW, targetH) => {
    if (!media)
      return;
    let sw = 0, sh = 0;
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
  },
  drawMasked: (ctx, contentFn, maskFn) => {
    const { width, height } = ctx.canvas;
    const buffer = document.createElement("canvas");
    buffer.width = width;
    buffer.height = height;
    const bCtx = buffer.getContext("2d");
    maskFn(bCtx);
    bCtx.globalCompositeOperation = "source-in";
    contentFn(bCtx);
    ctx.drawImage(buffer, 0, 0);
  }
};
var BROWSER_UTILS_CODE = `
const mulberry32 = ${mulberry32.toString()};

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
    // Pass the generator function creator for deterministic randomness
    seededRandomGenerator: mulberry32, 
    drawRoundedRect: ${TiramisuUtils.drawRoundedRect.toString()},
    drawMediaFit: ${TiramisuUtils.drawMediaFit.toString()},
    drawMediaCover: ${TiramisuUtils.drawMediaCover.toString()},
    drawMasked: ${TiramisuUtils.drawMasked.toString()}
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
        this.audioAnalyser.fftSize = 64;
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
  getAudioBands(count = 32) {
    if (!this.audioAnalyser)
      return Array(count).fill(0);
    const dataArray = new Uint8Array(this.audioAnalyser.frequencyBinCount);
    this.audioAnalyser.getByteFrequencyData(dataArray);
    const bins = Array.from(dataArray.slice(0, count));
    return bins.map((v) => v / 255);
  }
  renderFrame(frame) {
    const totalFrames = Math.ceil(this.config.fps * this.config.durationSeconds);
    const progress = frame / (totalFrames - 1 || 1);
    const volume = this.getAudioVolume();
    const bands = this.getAudioBands(32);
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
            audioBands: bands,
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

// examples/meme-generator/app.ts
var appState = {
  topText: "TOP TEXT",
  bottomText: "BOTTOM TEXT",
  topPos: { x: 640, y: 100 },
  bottomPos: { x: 640, y: 620 },
  fontSize: 60,
  videoUrl: null,
  videoFile: null,
  duration: 5
};
var canvas = document.getElementById("preview-canvas");
var player = new TiramisuPlayer({
  width: 1280,
  height: 720,
  fps: 30,
  durationSeconds: appState.duration,
  canvas,
  data: appState
});
var memeClip = ({ ctx, width, height, videos, data }) => {
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, width, height);
  if (data.videoUrl && videos[data.videoUrl]) {
    const vid = videos[data.videoUrl];
    const sRatio = vid.videoWidth / vid.videoHeight;
    const tRatio = width / height;
    let dw = width, dh = height;
    if (sRatio > tRatio)
      dh = width / sRatio;
    else
      dw = height * sRatio;
    ctx.drawImage(vid, (width - dw) / 2, (height - dh) / 2, dw, dh);
  }
  const drawMemeText = (text, x, y) => {
    ctx.font = `bold ${data.fontSize}px Impact, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = "white";
    ctx.strokeStyle = "black";
    ctx.lineWidth = 6;
    ctx.strokeText(text.toUpperCase(), x, y);
    ctx.fillText(text.toUpperCase(), x, y);
  };
  drawMemeText(data.topText, data.topPos.x, data.topPos.y);
  drawMemeText(data.bottomText, data.bottomPos.x, data.bottomPos.y);
};
player.addClip(0, 600, memeClip);
var dragging = null;
canvas.addEventListener("mousedown", (e) => {
  const rect = canvas.getBoundingClientRect();
  const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
  const mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
  if (Math.abs(mouseY - appState.topPos.y) < 50)
    dragging = "top";
  else if (Math.abs(mouseY - appState.bottomPos.y) < 50)
    dragging = "bottom";
});
window.addEventListener("mousemove", (e) => {
  if (!dragging)
    return;
  const rect = canvas.getBoundingClientRect();
  const mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
  if (dragging === "top")
    appState.topPos.y = mouseY;
  else
    appState.bottomPos.y = mouseY;
  if (!player.isPlaying)
    player.renderFrame(Math.floor(player.pausedAt * 30));
});
window.addEventListener("mouseup", () => dragging = null);
var videoInput = document.getElementById("video-input");
var topTextInput = document.getElementById("top-text");
var btnRender = document.getElementById("btn-render");
topTextInput.oninput = (e) => {
  appState.topText = e.target.value;
  player.renderFrame(0);
};
videoInput.onchange = async (e) => {
  const file = e.target.files[0];
  appState.videoFile = file;
  appState.videoUrl = URL.createObjectURL(file);
  player.config.videos = [appState.videoUrl];
  await player.load();
  player.seek(0);
};
btnRender.onclick = async () => {
  if (!appState.videoFile)
    return alert("Upload a video first");
  btnRender.innerText = "⏳ Rendering...";
  const formData = new FormData;
  formData.append("video", appState.videoFile);
  formData.append("memeData", JSON.stringify({
    topText: appState.topText,
    bottomText: appState.bottomText,
    topPos: appState.topPos,
    bottomPos: appState.bottomPos
  }));
  const resp = await fetch("/api/render-meme", { method: "POST", body: formData });
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "meme.mp4";
  a.click();
  btnRender.innerText = "\uD83C\uDFAC Render MP4";
};
player.load();
