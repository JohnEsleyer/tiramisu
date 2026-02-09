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

// examples/video-audio-overlay/app.ts
var canvasId = "preview-canvas";
var videoInput = document.getElementById("video-input");
var resolutionSelect = document.getElementById("resolution-select");
var textInput = document.getElementById("overlay-text");
var colorInput = document.getElementById("overlay-color");
var btnPlay = document.getElementById("btn-play");
var btnRender = document.getElementById("btn-render");
var statusEl = document.getElementById("status");
var metaEl = document.getElementById("meta-info");
var appState = {
  width: 1280,
  height: 720,
  text: "TIRAMISU ENGINE",
  color: "#3b82f6",
  videoUrl: null,
  videoFile: null,
  duration: 5
};
metaEl.innerText = `${appState.width} x ${appState.height} @ 30FPS`;
var player = new TiramisuPlayer({
  width: appState.width,
  height: appState.height,
  fps: 30,
  durationSeconds: appState.duration,
  canvas: canvasId,
  data: appState
});
function setupClips() {
  player.addClip(0, 300, ({ ctx, width, height, videos, data }) => {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, width, height);
    if (!data.videoUrl) {
      ctx.strokeStyle = "#333";
      ctx.lineWidth = 1;
      const gridSize = 100;
      for (let x = 0;x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0;y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      ctx.fillStyle = "#64748b";
      ctx.font = "bold 24px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("NO MEDIA SOURCE", width / 2, height / 2);
      return;
    }
    const vid = videos[data.videoUrl];
    if (vid && vid.readyState >= 1) {
      if (vid.muted)
        vid.muted = false;
      const vidRatio = vid.videoWidth / vid.videoHeight;
      const canvasRatio = width / height;
      let drawW = width;
      let drawH = height;
      let offsetX = 0;
      let offsetY = 0;
      if (canvasRatio > vidRatio) {
        drawW = height * vidRatio;
        offsetX = (width - drawW) / 2;
      } else {
        drawH = width / vidRatio;
        offsetY = (height - drawH) / 2;
      }
      ctx.drawImage(vid, offsetX, offsetY, drawW, drawH);
    } else {
      ctx.fillStyle = "white";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Loading...", width / 2, height / 2);
    }
  }, 0);
  player.addClip(0, 300, ({ ctx, width, height, frame, fps, utils, data }) => {
    const currentTime = frame / fps;
    const entranceDuration = 1;
    const t = Math.min(currentTime / entranceDuration, 1);
    const easedT = utils.easeOutCubic(t);
    const safeMarginBottom = height * 0.12;
    const cardHeight = 140;
    const cardWidth = Math.min(width * 0.85, 600);
    const x = (width - cardWidth) / 2;
    const targetY = height - safeMarginBottom - cardHeight;
    const startY = height + 20;
    const y = utils.lerp(startY, targetY, easedT);
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = "white";
    utils.drawRoundedRect(ctx, x, y, cardWidth, cardHeight, 20);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    const stripWidth = 8;
    ctx.fillStyle = data.color;
    ctx.save();
    ctx.beginPath();
    utils.drawRoundedRect(ctx, x, y, cardWidth, cardHeight, 20);
    ctx.clip();
    ctx.fillRect(x, y, stripWidth + 20, cardHeight);
    ctx.restore();
    const contentX = x + 45;
    const centerY = y + cardHeight / 2;
    ctx.fillStyle = "#0f172a";
    ctx.font = "800 42px 'Segoe UI', Roboto, sans-serif";
    ctx.textBaseline = "bottom";
    ctx.textAlign = "left";
    ctx.fillText(data.text, contentX, centerY + 5);
    ctx.fillStyle = "#64748b";
    ctx.font = "600 24px 'Segoe UI', Roboto, sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText(`PREVIEW: ${width}x${height}px`, contentX, centerY + 10);
  }, 1);
}
setupClips();
player.seek(0);
resolutionSelect.addEventListener("change", async () => {
  const [w, h] = resolutionSelect.value.split("x").map(Number);
  appState.width = w;
  appState.height = h;
  metaEl.innerText = `${w} x ${h} @ 30FPS`;
  const wasPlaying = player.isPlaying;
  if (wasPlaying)
    player.pause();
  player = new TiramisuPlayer({
    width: w,
    height: h,
    fps: 30,
    durationSeconds: appState.duration,
    canvas: canvasId,
    data: appState,
    videos: appState.videoUrl ? [appState.videoUrl] : []
  });
  setupClips();
  await player.load();
  player.seek(0);
  if (wasPlaying)
    player.play();
});
textInput.addEventListener("input", (e) => {
  appState.text = e.target.value;
  if (!player.isPlaying)
    player.seek(0);
});
colorInput.addEventListener("input", (e) => {
  appState.color = e.target.value;
  if (!player.isPlaying)
    player.seek(0);
});
videoInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file)
    return;
  appState.videoFile = file;
  statusEl.innerText = "⏳ Reading video file...";
  if (appState.videoUrl)
    URL.revokeObjectURL(appState.videoUrl);
  appState.videoUrl = URL.createObjectURL(file);
  const tempVideo = document.createElement("video");
  tempVideo.preload = "metadata";
  tempVideo.src = appState.videoUrl;
  await new Promise((resolve) => {
    tempVideo.onloadedmetadata = () => {
      appState.duration = tempVideo.duration;
      resolve(null);
    };
  });
  player.config.durationSeconds = appState.duration;
  player.config.videos = [appState.videoUrl];
  player.clips.forEach((clip) => clip.endFrame = Math.floor(appState.duration * 30));
  await player.load();
  player.seek(0);
  statusEl.innerText = `✅ Ready: ${file.name} (${appState.duration.toFixed(1)}s)`;
  btnPlay.disabled = false;
  btnRender.disabled = false;
});
btnPlay.addEventListener("click", () => {
  const isPlaying = player.isPlaying;
  if (isPlaying) {
    player.pause();
    btnPlay.innerHTML = "▶ Play Preview";
    btnPlay.style.background = "";
  } else {
    player.play();
    btnPlay.innerHTML = "⏸ Pause Preview";
    btnPlay.style.background = "#d97706";
  }
});
btnRender.addEventListener("click", async () => {
  if (!appState.videoFile)
    return;
  btnRender.disabled = true;
  btnRender.innerText = "⏳ Uploading...";
  statusEl.innerText = "\uD83D\uDE80 Processing on server...";
  try {
    const formData = new FormData;
    formData.append("video", appState.videoFile);
    formData.append("fps", "30");
    formData.append("duration", appState.duration.toString());
    formData.append("width", appState.width.toString());
    formData.append("height", appState.height.toString());
    formData.append("text", appState.text);
    formData.append("color", appState.color);
    const response = await fetch("/api/export", { method: "POST", body: formData });
    if (!response.ok)
      throw new Error("Render failed");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tiramisu_${appState.width}x${appState.height}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    statusEl.innerText = "✨ Download Started!";
  } catch (e) {
    console.error(e);
    statusEl.innerText = "❌ Render Failed.";
  } finally {
    btnRender.disabled = false;
    btnRender.innerText = "\uD83C\uDFAC Render MP4";
  }
});
