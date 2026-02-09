// ../../src/Utils.ts
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
  },
  createLayer: (width, height) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    return {
      canvas,
      ctx,
      width,
      height,
      clear: () => {
        ctx.clearRect(0, 0, width, height);
      },
      drawTo: (targetCtx, x = 0, y = 0, dw, dh) => {
        if (dw !== undefined && dh !== undefined) {
          targetCtx.drawImage(canvas, x, y, dw, dh);
        } else {
          targetCtx.drawImage(canvas, x, y);
        }
      },
      applyBlur: (radius) => {
        if (radius <= 0)
          return;
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        const copy = new Uint8ClampedArray(data);
        const r = Math.ceil(radius);
        const side = 2 * r + 1;
        for (let y = 0;y < height; y++) {
          for (let x = 0;x < width; x++) {
            let rSum = 0, gSum = 0, bSum = 0, aSum = 0, count = 0;
            for (let ky = -r;ky <= r; ky++) {
              for (let kx = -r;kx <= r; kx++) {
                const px = Math.min(width - 1, Math.max(0, x + kx));
                const py = Math.min(height - 1, Math.max(0, y + ky));
                const idx2 = (py * width + px) * 4;
                rSum += copy[idx2];
                gSum += copy[idx2 + 1];
                bSum += copy[idx2 + 2];
                aSum += copy[idx2 + 3];
                count++;
              }
            }
            const idx = (y * width + x) * 4;
            data[idx] = rSum / count;
            data[idx + 1] = gSum / count;
            data[idx + 2] = bSum / count;
            data[idx + 3] = aSum / count;
          }
        }
        ctx.putImageData(imageData, 0, 0);
      },
      applyBrightness: (amount) => {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        const adjustment = Math.round(amount * 255);
        for (let i = 0;i < data.length; i += 4) {
          data[i] = Math.max(0, Math.min(255, data[i] + adjustment));
          data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + adjustment));
          data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + adjustment));
        }
        ctx.putImageData(imageData, 0, 0);
      },
      applyContrast: (amount) => {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        const factor = 259 * (amount * 255 + 255) / (255 * (259 - amount * 255));
        for (let i = 0;i < data.length; i += 4) {
          data[i] = Math.max(0, Math.min(255, factor * (data[i] - 128) + 128));
          data[i + 1] = Math.max(0, Math.min(255, factor * (data[i + 1] - 128) + 128));
          data[i + 2] = Math.max(0, Math.min(255, factor * (data[i + 2] - 128) + 128));
        }
        ctx.putImageData(imageData, 0, 0);
      },
      applyTint: (color) => {
        ctx.save();
        ctx.globalCompositeOperation = "source-atop";
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      },
      applyGrayscale: () => {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        for (let i = 0;i < data.length; i += 4) {
          const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          data[i] = gray;
          data[i + 1] = gray;
          data[i + 2] = gray;
        }
        ctx.putImageData(imageData, 0, 0);
      }
    };
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
    drawMasked: ${TiramisuUtils.drawMasked.toString()},
    createLayer: ${TiramisuUtils.createLayer.toString()}
};
`;

// ../../src/Client.ts
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
            utils: TiramisuUtils,
            layer: {
              create: (w, h) => {
                const width = w ?? this.config.width;
                const height = h ?? this.config.height;
                return TiramisuUtils.createLayer(width, height);
              }
            }
          });
        }
      }
    }
  }
}

// app.ts
var canvasId = "preview-canvas";
var playerState = {
  blur: 5,
  brightness: 0.1,
  contrast: 1.2,
  grayscale: false
};
var player = new TiramisuPlayer({
  width: 1280,
  height: 720,
  fps: 30,
  durationSeconds: 10,
  canvas: canvasId,
  data: playerState
});
player.addClip(0, 10, ({ ctx, width, height, localProgress }) => {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  const hue = localProgress * 360 % 360;
  gradient.addColorStop(0, `hsl(${hue}, 60%, 20%)`);
  gradient.addColorStop(1, `hsl(${(hue + 60) % 360}, 60%, 10%)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}, 0);
player.addClip(0, 10, ({ ctx, width, height, localProgress, layer, data }) => {
  const circlesLayer = layer.create(width, height);
  for (let i = 0;i < 5; i++) {
    const t = localProgress + i * 0.2;
    const x = (Math.sin(t * Math.PI * 2) * 0.3 + 0.5) * width;
    const y = (Math.cos(t * Math.PI * 2) * 0.3 + 0.5) * height;
    const radius = 50 + Math.sin(t * Math.PI * 4) * 20;
    circlesLayer.ctx.beginPath();
    circlesLayer.ctx.arc(x, y, radius, 0, Math.PI * 2);
    const hue = (t * 180 + i * 72) % 360;
    circlesLayer.ctx.fillStyle = `hsla(${hue}, 80%, 60%, 0.7)`;
    circlesLayer.ctx.fill();
    circlesLayer.ctx.strokeStyle = `hsla(${hue}, 80%, 80%, 1)`;
    circlesLayer.ctx.lineWidth = 3;
    circlesLayer.ctx.stroke();
  }
  circlesLayer.applyBlur(data.blur);
  circlesLayer.applyBrightness(data.brightness);
  circlesLayer.applyContrast(data.contrast);
  if (data.grayscale) {
    circlesLayer.applyGrayscale();
  }
  circlesLayer.drawTo(ctx);
}, 1);
player.addClip(0, 10, ({ ctx, width, height, localProgress, layer }) => {
  const vignetteLayer = layer.create(width, height);
  const gradient = vignetteLayer.ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width * 0.7);
  gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0.6)");
  vignetteLayer.ctx.fillStyle = gradient;
  vignetteLayer.ctx.fillRect(0, 0, width, height);
  vignetteLayer.drawTo(ctx);
  ctx.save();
  ctx.fillStyle = "white";
  ctx.font = "bold 48px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const text = "LAYERS DEMO";
  const bounce = Math.sin(localProgress * Math.PI * 4) * 10;
  ctx.fillText(text, width / 2, height / 2 + bounce);
  ctx.font = "24px sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
  ctx.fillText("Offscreen Buffers + Effects", width / 2, height / 2 + bounce + 40);
  ctx.restore();
}, 2);
player.addClip(0, 10, ({ ctx, width, height, layer }) => {
  const borderLayer = layer.create(width, height);
  const borderThickness = 20;
  borderLayer.ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
  borderLayer.ctx.lineWidth = borderThickness;
  borderLayer.ctx.strokeRect(borderThickness / 2, borderThickness / 2, width - borderThickness, height - borderThickness);
  const cornerSize = 60;
  const positions = [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height]
  ];
  borderLayer.ctx.fillStyle = "#f59e0b";
  positions.forEach(([x, y]) => {
    borderLayer.ctx.beginPath();
    borderLayer.ctx.arc(x, y, cornerSize / 2, 0, Math.PI * 2);
    borderLayer.ctx.fill();
  });
  const glowLayer = layer.create(width, height);
  glowLayer.ctx.drawImage(borderLayer.canvas, 0, 0);
  glowLayer.applyBlur(10);
  glowLayer.applyTint("rgba(245, 158, 11, 0.3)");
  glowLayer.drawTo(ctx);
  borderLayer.drawTo(ctx);
}, 3);
player.load();
var blurRange = document.getElementById("blur-range");
var blurValue = document.getElementById("blur-value");
var brightnessRange = document.getElementById("brightness-range");
var brightnessValue = document.getElementById("brightness-value");
var contrastRange = document.getElementById("contrast-range");
var contrastValue = document.getElementById("contrast-value");
var grayscaleCheck = document.getElementById("grayscale-check");
var btnPlay = document.getElementById("btn-play");
blurRange.addEventListener("input", (e) => {
  playerState.blur = parseFloat(e.target.value);
  blurValue.textContent = `${playerState.blur}px`;
  if (!player.isPlaying)
    player.renderFrame(Math.floor(player.pausedAt * 30));
});
brightnessRange.addEventListener("input", (e) => {
  playerState.brightness = parseFloat(e.target.value);
  brightnessValue.textContent = playerState.brightness.toFixed(2);
  if (!player.isPlaying)
    player.renderFrame(Math.floor(player.pausedAt * 30));
});
contrastRange.addEventListener("input", (e) => {
  playerState.contrast = parseFloat(e.target.value);
  contrastValue.textContent = playerState.contrast.toFixed(1);
  if (!player.isPlaying)
    player.renderFrame(Math.floor(player.pausedAt * 30));
});
grayscaleCheck.addEventListener("change", (e) => {
  playerState.grayscale = e.target.checked;
  if (!player.isPlaying)
    player.renderFrame(Math.floor(player.pausedAt * 30));
});
btnPlay.addEventListener("click", () => {
  if (player.isPlaying) {
    player.pause();
    btnPlay.textContent = "▶ Play";
  } else {
    player.play();
    btnPlay.textContent = "⏸ Pause";
  }
});
