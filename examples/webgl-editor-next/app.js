const SAMPLE_A = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
const SAMPLE_B = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4';

const state = {
  gl: null,
  program: null,
  vao: null,
  textures: [],
  videos: [null, null],
  clips: [null, null],
  playing: false,
  startTime: 0,
  playhead: 0,
  duration: 10,
  lastFrameTime: 0,
  fpsSamples: [],
  canvas: null,
  uniform: {}
};

const ui = {};

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
  ui.play = $('play');
  ui.pause = $('pause');
  ui.stop = $('stop');
  ui.scrub = $('scrub');
  ui.timecode = $('timecode');
  ui.fps = $('fps');
  ui.engine = $('engine-state');
  ui.statusA = $('status-a');
  ui.statusB = $('status-b');
  ui.sampleA = $('sample-a');
  ui.sampleB = $('sample-b');
  ui.fileA = $('file-a');
  ui.fileB = $('file-b');
  ui.laneA = $('lane-a');
  ui.laneB = $('lane-b');
  ui.playheadA = $('playhead-a');
  ui.playheadB = $('playhead-b');

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
  ui.play.addEventListener('click', () => play());
  ui.pause.addEventListener('click', () => pause());
  ui.stop.addEventListener('click', () => stop());
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
  tick();
}

function pause() {
  state.playing = false;
  ui.engine.textContent = 'paused';
  state.videos.forEach(video => video && video.pause());
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

  state.gl.uniform1f(u[`u_active${prefix}`], active);
  state.gl.uniform1f(u[`u_opacity${prefix}`], clip.opacity);
  state.gl.uniform2f(u[`u_scale${prefix}`], clip.scale, clip.scale);
  state.gl.uniform2f(u[`u_translate${prefix}`], clip.x, clip.y);
  state.gl.uniform1f(u[`u_rotate${prefix}`], clip.rot);
  state.gl.uniform1f(u[`u_brightness${prefix}`], clip.brightness);
  state.gl.uniform1f(u[`u_contrast${prefix}`], clip.contrast);
  state.gl.uniform1f(u[`u_saturation${prefix}`], clip.saturation);
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

function start() {
  initUI();
  initGL();
  initClips();
  bindControls();
  updateTimecode();
  ui.engine.textContent = 'idle';
  render();
}

start();
