const SAMPLE_A = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
const SAMPLE_B = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4';

const state = {
  gl: null,
  program: null,
  vao: null,
  textures: [],
  videos: [null, null],
  files: [null, null],
  clips: [null, null],
  playing: false,
  startTime: 0,
  playhead: 0,
  duration: 10,
  lastFrameTime: 0,
  fpsSamples: [],
  canvas: null,
  uniform: {},
  initError: null,
  screen: {
    width: 1920,
    height: 1080,
    fit: 'contain'
  }
};

const ui = {};
let tabButtons = [];
let tabSections = [];
let screenApplyTimer = null;

const SCREEN_SIZES = [
  { label: '1920x1080', width: 1920, height: 1080 },
  { label: '1280x720', width: 1280, height: 720 },
  { label: '2560x1440', width: 2560, height: 1440 },
  { label: '3840x2160', width: 3840, height: 2160 },
  { label: '1080x1920', width: 1080, height: 1920 },
  { label: '1080x1080', width: 1080, height: 1080 }
];

const vertexSrc = `#version 300 es
in vec2 a_position;
in vec2 a_uv;
out vec2 v_uv;
void main() {
  v_uv = a_uv;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const fragmentSrc = `#version 300 es
precision highp float;
precision highp sampler2D;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_tex0;
uniform sampler2D u_tex1;

uniform float u_active0;
uniform float u_active1;
uniform float u_opacity0;
uniform float u_opacity1;

uniform vec2 u_scale0;
uniform vec2 u_scale1;
uniform vec2 u_translate0;
uniform vec2 u_translate1;
uniform float u_rotate0;
uniform float u_rotate1;

uniform float u_brightness0;
uniform float u_brightness1;
uniform float u_contrast0;
uniform float u_contrast1;
uniform float u_saturation0;
uniform float u_saturation1;

vec3 applyBCS(vec3 color, float brightness, float contrast, float saturation) {
  color += brightness;
  color = (color - 0.5) * contrast + 0.5;
  float luma = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(luma), color, saturation);
  return clamp(color, 0.0, 1.0);
}

vec4 sampleLayer(
  sampler2D tex,
  vec2 uv,
  vec2 scale,
  vec2 translate,
  float rotate,
  float opacity,
  float isActive,
  float brightness,
  float contrast,
  float saturation
) {
  if (isActive < 0.5) return vec4(0.0);
  vec2 p = uv - translate;
  float s = sin(-rotate);
  float c = cos(-rotate);
  p = mat2(c, -s, s, c) * p;
  p /= scale;
  p += 0.5;
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) return vec4(0.0);
  vec4 color = texture(tex, p);
  color.rgb = applyBCS(color.rgb, brightness, contrast, saturation);
  color.a *= opacity;
  return color;
}

void main() {
  vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);
  vec4 a = sampleLayer(
    u_tex0, uv, u_scale0, u_translate0, u_rotate0,
    u_opacity0, u_active0, u_brightness0, u_contrast0, u_saturation0
  );
  vec4 b = sampleLayer(
    u_tex1, uv, u_scale1, u_translate1, u_rotate1,
    u_opacity1, u_active1, u_brightness1, u_contrast1, u_saturation1
  );

  vec4 outColor = a + b * (1.0 - a.a);
  fragColor = outColor;
}
`;

function $(id) {
  return document.getElementById(id);
}

function initUI() {
  ui.playToggle = $('play-toggle');
  ui.stop = $('stop');
  ui.scrub = $('scrub');
  ui.timecode = $('timecode');
  ui.fps = $('fps');
  ui.engine = $('engine-state');
  ui.screenBadge = $('screen-badge');
  ui.screenSize = $('screen-size');
  ui.fitMode = $('fit-mode');
  ui.screenWidth = $('screen-width');
  ui.screenHeight = $('screen-height');
  ui.screenApply = $('screen-apply');
  ui.screenStatus = $('screen-status');
  ui.screenAspect = $('screen-aspect');
  ui.export = $('export');
  ui.exportStatus = $('export-status');
  ui.exportModal = $('export-modal');
  ui.exportModalTitle = $('export-modal-title');
  ui.exportModalBody = $('export-modal-body');
  ui.exportProgress = $('export-progress-fill');
  ui.statusA = $('status-a');
  ui.statusB = $('status-b');
  ui.ratioA = $('ratio-a');
  ui.ratioB = $('ratio-b');
  ui.sampleA = $('sample-a');
  ui.sampleB = $('sample-b');
  ui.fileA = $('file-a');
  ui.fileB = $('file-b');
  ui.laneA = $('lane-a');
  ui.laneB = $('lane-b');
  ui.playheadA = $('playhead-a');
  ui.playheadB = $('playhead-b');

  tabButtons = Array.from(document.querySelectorAll('[data-tab]'));
  tabSections = Array.from(document.querySelectorAll('[data-tab-content]'));

  ui.controls = {
    a: {
      start: $('start-a'),
      duration: $('duration-a'),
      opacity: $('opacity-a'),
      scale: $('scale-a'),
      x: $('x-a'),
      y: $('y-a'),
      rot: $('rot-a'),
      bright: $('bright-a'),
      contrast: $('contrast-a'),
      sat: $('sat-a')
    },
    b: {
      start: $('start-b'),
      duration: $('duration-b'),
      opacity: $('opacity-b'),
      scale: $('scale-b'),
      x: $('x-b'),
      y: $('y-b'),
      rot: $('rot-b'),
      bright: $('bright-b'),
      contrast: $('contrast-b'),
      sat: $('sat-b')
    }
  };
}

function initGL() {
  const canvas = $('gl-canvas');
  const gl = canvas.getContext('webgl2', { antialias: true });
  if (!gl) {
    throw new Error('WebGL2 not supported');
  }
  state.canvas = canvas;
  state.gl = gl;

  const vs = compile(gl, gl.VERTEX_SHADER, vertexSrc);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragmentSrc);
  const program = link(gl, vs, fs);

  state.program = program;
  state.vao = createQuad(gl, program);
  state.textures = [createTexture(gl), createTexture(gl)];

  state.uniform = {
    u_tex0: gl.getUniformLocation(program, 'u_tex0'),
    u_tex1: gl.getUniformLocation(program, 'u_tex1'),
    u_active0: gl.getUniformLocation(program, 'u_active0'),
    u_active1: gl.getUniformLocation(program, 'u_active1'),
    u_opacity0: gl.getUniformLocation(program, 'u_opacity0'),
    u_opacity1: gl.getUniformLocation(program, 'u_opacity1'),
    u_scale0: gl.getUniformLocation(program, 'u_scale0'),
    u_scale1: gl.getUniformLocation(program, 'u_scale1'),
    u_translate0: gl.getUniformLocation(program, 'u_translate0'),
    u_translate1: gl.getUniformLocation(program, 'u_translate1'),
    u_rotate0: gl.getUniformLocation(program, 'u_rotate0'),
    u_rotate1: gl.getUniformLocation(program, 'u_rotate1'),
    u_brightness0: gl.getUniformLocation(program, 'u_brightness0'),
    u_brightness1: gl.getUniformLocation(program, 'u_brightness1'),
    u_contrast0: gl.getUniformLocation(program, 'u_contrast0'),
    u_contrast1: gl.getUniformLocation(program, 'u_contrast1'),
    u_saturation0: gl.getUniformLocation(program, 'u_saturation0'),
    u_saturation1: gl.getUniformLocation(program, 'u_saturation1')
  };

  resize();
  window.addEventListener('resize', resize);
}

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const error = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(error || 'Shader compile error');
  }
  return shader;
}

function link(gl, vs, fs) {
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const error = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(error || 'Program link error');
  }
  return program;
}

function createQuad(gl, program) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const data = new Float32Array([
    -1, -1, 0, 0,
     1, -1, 1, 0,
    -1,  1, 0, 1,
     1,  1, 1, 1
  ]);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

  const posLoc = gl.getAttribLocation(program, 'a_position');
  const uvLoc = gl.getAttribLocation(program, 'a_uv');

  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);

  gl.enableVertexAttribArray(uvLoc);
  gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 16, 8);

  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  return vao;
}

function createTexture(gl) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
  gl.bindTexture(gl.TEXTURE_2D, null);
  return tex;
}

function resize() {
  const canvas = state.canvas;
  if (!canvas) return;
  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  state.gl.viewport(0, 0, canvas.width, canvas.height);
}

function makeVideo() {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = 'anonymous';
  video.preload = 'auto';
  return video;
}

function loadVideo(index, url, label) {
  const video = state.videos[index] || makeVideo();
  video.src = url;
  state.videos[index] = video;
  const status = index === 0 ? ui.statusA : ui.statusB;
  status.textContent = label;

  return new Promise((resolve, reject) => {
    const onReady = () => {
      status.textContent = `${label} (${formatTime(video.duration)})`;
      updateAspectWarnings();
      resolve();
    };
    const onError = () => {
      status.textContent = 'Failed to load video';
      reject(new Error('Video load error'));
    };
    video.addEventListener('loadedmetadata', onReady, { once: true });
    video.addEventListener('error', onError, { once: true });
    video.load();
  });
}

function initClips() {
  state.clips[0] = createClip('A');
  state.clips[1] = createClip('B');
  updateDuration();
  updateTimeline();
}

function createClip(label) {
  return {
    label,
    start: 0,
    duration: 6,
    opacity: 1,
    scale: 1,
    x: 0.5,
    y: 0.5,
    rot: 0,
    brightness: 0,
    contrast: 1,
    saturation: 1
  };
}

function bindControls() {
  ui.playToggle.addEventListener('click', () => togglePlay());
  ui.stop.addEventListener('click', () => stop());
  ui.export.addEventListener('click', () => exportServerRender());
  if (ui.screenSize) {
    ui.screenSize.addEventListener('change', (e) => setScreenSize(e.target.value));
  }
  if (ui.fitMode) {
    ui.fitMode.addEventListener('change', (e) => setFitMode(e.target.value));
  }
  if (ui.screenApply) {
    ui.screenApply.addEventListener('click', () => applyCustomSize());
  }
  if (ui.screenWidth) {
    ui.screenWidth.addEventListener('input', () => scheduleCustomSizeApply());
  }
  if (ui.screenHeight) {
    ui.screenHeight.addEventListener('input', () => scheduleCustomSizeApply());
  }
  tabButtons.forEach((button) => {
    button.addEventListener('click', () => switchTab(button.dataset.tab));
  });
  ui.scrub.addEventListener('input', (e) => {
    setPlayhead(parseFloat(e.target.value));
    if (state.playing) {
      state.startTime = performance.now() / 1000 - state.playhead;
    }
  });

  ui.sampleA.addEventListener('click', () => {
    loadVideo(0, SAMPLE_A, 'Sample A loaded').then(() => syncPlayhead());
  });
  ui.sampleB.addEventListener('click', () => {
    loadVideo(1, SAMPLE_B, 'Sample B loaded').then(() => syncPlayhead());
  });

  ui.fileA.addEventListener('change', (e) => handleFile(e, 0));
  ui.fileB.addEventListener('change', (e) => handleFile(e, 1));

  bindClipInputs('a', 0);
  bindClipInputs('b', 1);
}

function togglePlay() {
  if (state.playing) {
    pause();
  } else {
    play();
  }
  updatePlayButton();
}

function updatePlayButton() {
  if (!ui.playToggle) return;
  ui.playToggle.textContent = state.playing ? 'Pause' : 'Play';
}

function setExportModal(active, title, body) {
  if (!ui.exportModal) return;
  ui.exportModal.classList.toggle('active', active);
  if (title && ui.exportModalTitle) ui.exportModalTitle.textContent = title;
  if (body && ui.exportModalBody) ui.exportModalBody.textContent = body;
  if (!active && ui.exportProgress) ui.exportProgress.style.width = '0%';
}

function setScreenSize(value) {
  const size = SCREEN_SIZES.find((item) => item.label === value);
  if (!size) return;
  state.screen.width = size.width;
  state.screen.height = size.height;
  if (ui.screenWidth) ui.screenWidth.value = String(size.width);
  if (ui.screenHeight) ui.screenHeight.value = String(size.height);
  document.documentElement.style.setProperty('--screen-aspect', `${size.width} / ${size.height}`);
  if (ui.screenBadge) ui.screenBadge.textContent = `${size.width}x${size.height}`;
  updateScreenUI();
  resize();
  if (state.gl) render();
}

function setFitMode(value) {
  state.screen.fit = value === 'cover' ? 'cover' : 'contain';
  updateScreenUI();
  if (state.gl) render();
}

function updateScreenUI() {
  const { width, height } = state.screen;
  const aspect = width / height;
  if (ui.screenStatus) ui.screenStatus.textContent = `Screen ${width}x${height}`;
  if (ui.screenAspect) ui.screenAspect.textContent = `Aspect ${formatAspectRatio(width, height)} (${aspect.toFixed(2)})`;
  updateAspectWarnings();
}

function scheduleCustomSizeApply() {
  if (screenApplyTimer) {
    clearTimeout(screenApplyTimer);
  }
  screenApplyTimer = setTimeout(() => {
    screenApplyTimer = null;
    applyCustomSize();
  }, 150);
}

function switchTab(tabId) {
  if (!tabId) return;
  tabButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === tabId);
  });
  tabSections.forEach((section) => {
    section.hidden = section.dataset.tabContent !== tabId;
  });
}

function applyCustomSize() {
  const width = parseInt(ui.screenWidth?.value || '', 10);
  const height = parseInt(ui.screenHeight?.value || '', 10);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 320 || height < 240) {
    return;
  }
  state.screen.width = width;
  state.screen.height = height;
  if (ui.screenSize) ui.screenSize.value = '';
  document.documentElement.style.setProperty('--screen-aspect', `${width} / ${height}`);
  if (ui.screenBadge) ui.screenBadge.textContent = `${width}x${height}`;
  updateScreenUI();
  resize();
  if (state.gl) render();
}

function updateAspectWarnings() {
  const screenAspect = state.screen.width / state.screen.height;
  [0, 1].forEach((index) => {
    const video = state.videos[index];
    const label = index === 0 ? ui.ratioA : ui.ratioB;
    if (!label) return;
    if (!video || !video.videoWidth || !video.videoHeight) {
      label.textContent = '';
      return;
    }
    const videoAspect = video.videoWidth / video.videoHeight;
    const diff = Math.abs(videoAspect - screenAspect);
    if (diff < 0.02) {
      label.textContent = `Aspect match: ${formatAspectRatio(video.videoWidth, video.videoHeight)}`;
      return;
    }
    const modeLabel = state.screen.fit === 'cover' ? 'Crop to Fill' : 'Maintain Ratio';
    label.textContent = `Aspect mismatch: video ${formatAspectRatio(video.videoWidth, video.videoHeight)} vs screen ${formatAspectRatio(state.screen.width, state.screen.height)}. ${modeLabel} applied.`;
  });
}

async function exportServerRender() {
  if (!ui.export) return;
  ui.export.disabled = true;
  const originalText = ui.export.textContent;
  ui.export.textContent = 'Rendering...';
  if (ui.exportStatus) ui.exportStatus.textContent = 'Sending job to server';
  setExportModal(true, 'Rendering on server', 'Sending render job...');
  let failed = false;

  const payload = await buildExportPayload();

  try {
    const response = await fetch('/api/export-canvas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Server failed to render (HTTP ${response.status})`);
    }

    const { jobId } = await response.json();
    if (!jobId) {
      throw new Error('No job id returned from server');
    }

    await pollExportJob(jobId);

    if (ui.exportStatus) ui.exportStatus.textContent = 'Download started';
    setExportModal(true, 'Render complete', 'Download started.');
  } catch (error) {
    console.error(error);
    if (ui.exportStatus) ui.exportStatus.textContent = 'Export failed (check server)';
    failed = true;
    const message = error instanceof Error ? error.message : String(error);
    setExportModal(
      true,
      'Export failed',
      `Server did not accept the job. Ensure /api/export-canvas is implemented. ${message}`
    );
  } finally {
    ui.export.disabled = false;
    ui.export.textContent = originalText;
    setTimeout(() => setExportModal(false), failed ? 3500 : 1200);
  }
}

async function buildExportPayload() {
  const clips = state.clips.map((clip) => clip ? ({
    start: clip.start,
    duration: clip.duration,
    opacity: clip.opacity,
    scale: clip.scale,
    x: clip.x,
    y: clip.y,
    rot: clip.rot,
    brightness: clip.brightness,
    contrast: clip.contrast,
    saturation: clip.saturation
  }) : null);

  const sources = [];
  for (let i = 0; i < state.videos.length; i++) {
    const video = state.videos[i];
    const file = state.files[i];
    if (file) {
      const data = await fileToBase64(file);
      sources.push({ kind: 'file', name: file.name, data });
    } else if (video && video.src && !video.src.startsWith('blob:')) {
      sources.push({ kind: 'url', url: video.src });
    } else {
      sources.push(null);
    }
  }

  return {
    resolution: `${state.screen.width}x${state.screen.height}`,
    fps: 30,
    duration: Number(state.duration) || 10,
    clips,
    sources,
    screen: { ...state.screen }
  };
}

async function pollExportJob(jobId) {
  const start = Date.now();
  const timeoutMs = 5 * 60 * 1000;

  while (Date.now() - start < timeoutMs) {
    const response = await fetch(`/api/export-canvas/status?id=${encodeURIComponent(jobId)}`);
    if (!response.ok) {
      throw new Error(`Status check failed (HTTP ${response.status})`);
    }

    const status = await response.json();
    if (status.status === 'failed') {
      throw new Error(status.error || 'Server render failed');
    }

    if (status.status === 'done' && status.downloadUrl) {
      setExportModal(true, 'Rendering on server', 'Encoding complete. Downloading...');
      const download = await fetch(status.downloadUrl);
      if (!download.ok) {
        throw new Error(`Download failed (HTTP ${download.status})`);
      }
      const blob = await download.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = 'tiramisu-webgl-next.mp4';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      return;
    }

    const percent = Math.max(0, Math.min(100, Math.round(status.percent || 0)));
    setExportModal(true, 'Rendering on server', `Progress: ${percent}%`);
    if (ui.exportStatus) ui.exportStatus.textContent = `Rendering ${percent}%`;
    if (ui.exportProgress) ui.exportProgress.style.width = `${percent}%`;
    await new Promise((r) => setTimeout(r, 500));
  }

  throw new Error('Render timed out');
}

async function fileToBase64(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function setExportState(payload) {
  if (!payload) return;
  if (Array.isArray(payload.clips)) {
    payload.clips.forEach((clip, index) => {
      if (!clip || !state.clips[index]) return;
      Object.assign(state.clips[index], clip);
    });
  }

  if (Array.isArray(payload.sources)) {
    for (let i = 0; i < payload.sources.length; i++) {
      const source = payload.sources[i];
      if (!source) continue;
      if (source.url) {
        await loadVideo(i, source.url, `Source ${i + 1}`);
      }
    }
  }

  if (payload.duration) {
    state.duration = Number(payload.duration) || state.duration;
    ui.scrub.max = state.duration.toFixed(2);
  }

  if (payload.screen && payload.screen.width && payload.screen.height) {
    state.screen.width = payload.screen.width;
    state.screen.height = payload.screen.height;
    state.screen.fit = payload.screen.fit === 'cover' ? 'cover' : 'contain';
    if (ui.screenSize) ui.screenSize.value = `${state.screen.width}x${state.screen.height}`;
    if (ui.fitMode) ui.fitMode.value = state.screen.fit;
    if (ui.screenWidth) ui.screenWidth.value = String(state.screen.width);
    if (ui.screenHeight) ui.screenHeight.value = String(state.screen.height);
    setScreenSize(`${state.screen.width}x${state.screen.height}`);
    setFitMode(state.screen.fit);
  }

  updateTimeline();
  updateTimecode();
  render();
}

function renderAt(time) {
  const clamped = Math.max(0, Math.min(time, state.duration));
  state.playhead = clamped;
  updateTimeline();
  updateTimecode();
  syncPlayhead();
  render();
}

function bindClipInputs(prefix, index) {
  const group = ui.controls[prefix];
  Object.entries(group).forEach(([key, input]) => {
    input.addEventListener('input', () => {
      const clip = state.clips[index];
      if (!clip) return;
      clip.start = parseFloat(group.start.value) || 0;
      clip.duration = parseFloat(group.duration.value) || 0;
      clip.opacity = parseFloat(group.opacity.value) || 0;
      clip.scale = parseFloat(group.scale.value) || 1;
      clip.x = parseFloat(group.x.value) || 0.5;
      clip.y = parseFloat(group.y.value) || 0.5;
      clip.rot = parseFloat(group.rot.value) || 0;
      clip.brightness = parseFloat(group.bright.value) || 0;
      clip.contrast = parseFloat(group.contrast.value) || 1;
      clip.saturation = parseFloat(group.sat.value) || 1;
      updateDuration();
      updateTimeline();
      if (!state.playing) render();
    });
  });

  const clip = state.clips[index];
  group.start.value = clip.start;
  group.duration.value = clip.duration;
  group.opacity.value = clip.opacity;
  group.scale.value = clip.scale;
  group.x.value = clip.x;
  group.y.value = clip.y;
  group.rot.value = clip.rot;
}

function handleFile(event, index) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  state.files[index] = file;
  const url = URL.createObjectURL(file);
  loadVideo(index, url, file.name)
    .then(() => syncPlayhead())
    .catch(() => {});
}

function updateDuration() {
  const maxEnd = state.clips.reduce((acc, clip) => {
    if (!clip) return acc;
    return Math.max(acc, clip.start + clip.duration);
  }, 0);
  state.duration = Math.max(5, maxEnd || 10);
  ui.scrub.max = state.duration.toFixed(2);
  if (state.playhead > state.duration) {
    setPlayhead(state.duration);
  }
}

function updateTimeline() {
  renderClip(ui.laneA, state.clips[0], ui.playheadA);
  renderClip(ui.laneB, state.clips[1], ui.playheadB);
}

function renderClip(lane, clip, playhead) {
  lane.querySelectorAll('.clip').forEach(el => el.remove());
  if (!clip) return;
  const duration = state.duration || 1;
  const left = (clip.start / duration) * 100;
  const width = (clip.duration / duration) * 100;
  const el = document.createElement('div');
  el.className = 'clip';
  el.style.left = `${left}%`;
  el.style.width = `${Math.max(2, width)}%`;
  el.textContent = `Layer ${clip.label}`;
  lane.appendChild(el);
  playhead.style.left = `${(state.playhead / duration) * 100}%`;
}

function play() {
  if (state.playing) return;
  state.playing = true;
  state.startTime = performance.now() / 1000 - state.playhead;
  ui.engine.textContent = 'playing';
  updatePlayButton();
  tick();
}

function pause() {
  state.playing = false;
  ui.engine.textContent = 'paused';
  state.videos.forEach(video => video && video.pause());
  updatePlayButton();
}

function stop() {
  pause();
  setPlayhead(0);
}

function setPlayhead(time) {
  state.playhead = Math.max(0, Math.min(time, state.duration));
  ui.scrub.value = state.playhead.toFixed(2);
  updateTimeline();
  updateTimecode();
  syncPlayhead();
  render();
}

function syncPlayhead() {
  state.clips.forEach((clip, index) => {
    const video = state.videos[index];
    if (!clip || !video) return;
    const localTime = state.playhead - clip.start;
    if (localTime < 0 || localTime > clip.duration) {
      video.pause();
      return;
    }
    if (Math.abs(video.currentTime - localTime) > 0.05) {
      video.currentTime = Math.max(0, localTime);
    }
    if (state.playing && video.paused) {
      video.play().catch(() => {});
    }
  });
}

function updateTimecode() {
  ui.timecode.textContent = `${formatTime(state.playhead)} / ${formatTime(state.duration)}`;
}

function tick() {
  if (!state.playing) return;
  const now = performance.now() / 1000;
  state.playhead = now - state.startTime;
  if (state.playhead >= state.duration) {
    stop();
    return;
  }
  ui.scrub.value = state.playhead.toFixed(2);
  updateTimeline();
  updateTimecode();
  syncPlayhead();
  render();
  updateFps();
  requestAnimationFrame(tick);
}

function updateFps() {
  const now = performance.now();
  state.fpsSamples.push(now);
  while (state.fpsSamples.length && state.fpsSamples[0] < now - 1000) {
    state.fpsSamples.shift();
  }
  ui.fps.textContent = `${state.fpsSamples.length} fps`;
}

function render() {
  const gl = state.gl;
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(state.program);
  gl.bindVertexArray(state.vao);

  updateTexture(0);
  updateTexture(1);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, state.textures[0]);
  gl.uniform1i(state.uniform.u_tex0, 0);

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, state.textures[1]);
  gl.uniform1i(state.uniform.u_tex1, 1);

  const clipA = state.clips[0];
  const clipB = state.clips[1];

  applyClipUniforms(clipA, 0);
  applyClipUniforms(clipB, 1);

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.bindVertexArray(null);
}

function applyClipUniforms(clip, index) {
  const u = state.uniform;
  if (!clip) return;
  const video = state.videos[index];
  const active = video && isClipActive(clip, state.playhead) ? 1 : 0;

  const prefix = index === 0 ? '0' : '1';
  const fitScale = getFitScale(video);
  const scaleX = clip.scale * fitScale.x;
  const scaleY = clip.scale * fitScale.y;

  state.gl.uniform1f(u[`u_active${prefix}`], active);
  state.gl.uniform1f(u[`u_opacity${prefix}`], clip.opacity);
  state.gl.uniform2f(u[`u_scale${prefix}`], scaleX, scaleY);
  state.gl.uniform2f(u[`u_translate${prefix}`], clip.x, clip.y);
  state.gl.uniform1f(u[`u_rotate${prefix}`], clip.rot);
  state.gl.uniform1f(u[`u_brightness${prefix}`], clip.brightness);
  state.gl.uniform1f(u[`u_contrast${prefix}`], clip.contrast);
  state.gl.uniform1f(u[`u_saturation${prefix}`], clip.saturation);
}

function getFitScale(video) {
  if (!video || !video.videoWidth || !video.videoHeight) {
    return { x: 1, y: 1 };
  }
  const screenAspect = state.screen.width / state.screen.height;
  const videoAspect = video.videoWidth / video.videoHeight;
  if (Math.abs(screenAspect - videoAspect) < 0.0001) {
    return { x: 1, y: 1 };
  }
  if (state.screen.fit === 'cover') {
    if (screenAspect > videoAspect) {
      return { x: 1, y: screenAspect / videoAspect };
    }
    return { x: videoAspect / screenAspect, y: 1 };
  }
  // contain
  if (screenAspect > videoAspect) {
    return { x: videoAspect / screenAspect, y: 1 };
  }
  return { x: 1, y: screenAspect / videoAspect };
}

function isClipActive(clip, time) {
  return time >= clip.start && time <= clip.start + clip.duration;
}

function updateTexture(index) {
  const video = state.videos[index];
  if (!video) return;
  if (video.readyState < 2) return;
  const gl = state.gl;
  gl.bindTexture(gl.TEXTURE_2D, state.textures[index]);
  try {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
  } catch (error) {
    // Ignore transient errors while seeking
  }
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  const clamped = Math.max(0, seconds);
  const mins = Math.floor(clamped / 60);
  const secs = Math.floor(clamped % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatAspectRatio(width, height) {
  if (!width || !height) return 'N/A';
  const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(width, height);
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;
}

function start() {
  initUI();
  if (ui.screenSize) ui.screenSize.value = `${state.screen.width}x${state.screen.height}`;
  if (ui.fitMode) ui.fitMode.value = state.screen.fit;
  if (ui.screenWidth) ui.screenWidth.value = String(state.screen.width);
  if (ui.screenHeight) ui.screenHeight.value = String(state.screen.height);
  setScreenSize(`${state.screen.width}x${state.screen.height}`);
  setFitMode(state.screen.fit);
  try {
    initGL();
  } catch (error) {
    state.initError = error instanceof Error ? error.message : String(error);
    if (ui.engine) ui.engine.textContent = 'error';
    console.error(error);
  }
  initClips();
  bindControls();
  updateTimecode();
  if (ui.engine && !state.initError) ui.engine.textContent = 'idle';
  if (!state.initError) render();
  updatePlayButton();
  if (tabButtons.length) switchTab(tabButtons[0].dataset.tab);

  window.__webglNext = {
    setExportState,
    renderAt,
    isReady: () => !!state.gl,
    getError: () => state.initError
  };
}

start();
