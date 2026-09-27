// Rainforest — Phase 0, Slice 1: responsive canvas baseline.
// An empty desert that renders correctly on every screen size, inside a
// fit-to-safe-area portrait play field. No gameplay yet — this is the scaffold
// that every later slice builds on. See PROGRESS.md and CLAUDE.md.

// Logical "design" resolution. All drawing uses these units; the canvas is
// scaled to fit the real screen, so gameplay code never deals with pixels/DPR.
const DESIGN = { w: 450, h: 975 }; // ~9:19.5 portrait
const MAX_DPR = 3; // cap so cheap high-DPI phones don't render 4x the pixels

const canvas = document.getElementById('game');
const debugEl = document.getElementById('debug');
const ctx = canvas.getContext('2d');

const view = { cssW: 0, cssH: 0, dpr: 1, insets: { t: 0, r: 0, b: 0, l: 0 } };
let showDebug = false;

function readInsets() {
  const cs = getComputedStyle(document.documentElement);
  const px = (name) => parseFloat(cs.getPropertyValue(name)) || 0;
  view.insets = {
    t: px('--safe-t'), r: px('--safe-r'), b: px('--safe-b'), l: px('--safe-l'),
  };
}

// Fit the design aspect ratio inside the usable area (visual viewport minus
// safe-area insets), letterboxing rather than stretching.
function layout() {
  readInsets();
  const vp = window.visualViewport;
  const availW = (vp ? vp.width : innerWidth) - view.insets.l - view.insets.r;
  const availH = (vp ? vp.height : innerHeight) - view.insets.t - view.insets.b;

  const scale = Math.min(availW / DESIGN.w, availH / DESIGN.h);
  const cssW = Math.floor(DESIGN.w * scale);
  const cssH = Math.floor(DESIGN.h * scale);
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);

  view.cssW = cssW;
  view.cssH = cssH;
  view.dpr = dpr;

  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);

  // One transform maps design units → device pixels for all drawing.
  const s = (cssW / DESIGN.w) * dpr;
  ctx.setTransform(s, 0, 0, s, 0, 0);
}

// --- Render (design-unit coordinates) ------------------------------------
function drawScene() {
  const { w, h } = DESIGN;
  const horizon = h * 0.62;

  // Sky
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#8fb7d6');
  sky.addColorStop(1, '#e7d6a8');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizon);

  // Sun
  ctx.fillStyle = '#fff4d6';
  ctx.beginPath();
  ctx.arc(w * 0.74, h * 0.16, 42, 0, Math.PI * 2);
  ctx.fill();

  // Sand
  const sand = ctx.createLinearGradient(0, horizon, 0, h);
  sand.addColorStop(0, '#d9b579');
  sand.addColorStop(1, '#b8894d');
  ctx.fillStyle = sand;
  ctx.fillRect(0, horizon, w, h - horizon);

  // Lone figure (placeholder) standing on the sand.
  ctx.fillStyle = '#4a3a24';
  ctx.fillRect(w * 0.5 - 4, horizon + 30, 8, 26);
  ctx.beginPath();
  ctx.arc(w * 0.5, horizon + 24, 7, 0, Math.PI * 2);
  ctx.fill();
}

// --- Debug overlay --------------------------------------------------------
let fps = 0, frames = 0, fpsSince = performance.now();
function updateDebug(now) {
  frames++;
  if (now - fpsSince >= 500) {
    fps = Math.round((frames * 1000) / (now - fpsSince));
    frames = 0;
    fpsSince = now;
  }
  if (!showDebug) return;
  const i = view.insets;
  const ar = (view.cssW / view.cssH).toFixed(3);
  debugEl.textContent =
    `field ${view.cssW}x${view.cssH}  ar ${ar}\n` +
    `dpr ${view.dpr}  design ${DESIGN.w}x${DESIGN.h}\n` +
    `insets t${i.t} r${i.r} b${i.b} l${i.l}\n` +
    `fps ${fps}`;
}

// --- Loop -----------------------------------------------------------------
function frame(now) {
  drawScene();
  updateDebug(now);
  requestAnimationFrame(frame);
}

// --- Wiring ---------------------------------------------------------------
function toggleDebug() {
  showDebug = !showDebug;
  debugEl.hidden = !showDebug;
}

addEventListener('keydown', (e) => { if (e.key === 'd' || e.key === 'D') toggleDebug(); });
// Tap the top-left corner (where the overlay lives) to toggle on touch devices.
addEventListener('pointerdown', (e) => {
  if (e.clientX < 80 && e.clientY < 80) toggleDebug();
});

// Recompute layout on every source of size change. Debounced + idempotent so
// foldables firing rapid resize events on fold/unfold stay correct.
let relayoutQueued = false;
function scheduleLayout() {
  if (relayoutQueued) return;
  relayoutQueued = true;
  requestAnimationFrame(() => { relayoutQueued = false; layout(); });
}
addEventListener('resize', scheduleLayout);
addEventListener('orientationchange', scheduleLayout);
if (window.visualViewport) {
  visualViewport.addEventListener('resize', scheduleLayout);
  visualViewport.addEventListener('scroll', scheduleLayout);
}

layout();
requestAnimationFrame(frame);
