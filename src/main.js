// Rainforest — app shell: layout, fixed-timestep loop, input, debug overlay.
// Game world lives in state.js / render.js.
import { DESIGN, MAX_DPR } from './config.js';
import { plotAt } from './state.js';
import { plantSeed, unlockPlot, updateWorld, survivalChance, WATER_PER_COLLECT } from './game.js';
import { renderScene } from './render.js';
import { createHud } from './hud.js';
import { loadGame, saveGame } from './save.js';
import { initOnboarding } from './onboarding.js';
import { initBoot } from './boot.js';

const canvas = document.getElementById('game');
const debugEl = document.getElementById('debug');
const ctx = canvas.getContext('2d');

const view = { cssW: 0, cssH: 0, dpr: 1, scale: 1, insets: { t: 0, r: 0, b: 0, l: 0 } };
let showDebug = false;

// Restore the save (with offline progress applied) or start fresh.
const state = loadGame();

// Manually fetching water from jugs — the early gameplay action.
// Becomes renewable via rain later. Amount tuned in the feel pass (S10).
const hud = createHud({
  onCollectWater() { state.water += WATER_PER_COLLECT; },
});

// --- Layout: fit design aspect inside usable area (viewport minus insets) ---
function readInsets() {
  const cs = getComputedStyle(document.documentElement);
  const px = (n) => parseFloat(cs.getPropertyValue(n)) || 0;
  view.insets = { t: px('--safe-t'), r: px('--safe-r'), b: px('--safe-b'), l: px('--safe-l') };
}

function layout() {
  readInsets();
  const vp = window.visualViewport;
  const availW = (vp ? vp.width : innerWidth) - view.insets.l - view.insets.r;
  const availH = (vp ? vp.height : innerHeight) - view.insets.t - view.insets.b;

  const scale = Math.min(availW / DESIGN.w, availH / DESIGN.h);
  const cssW = Math.floor(DESIGN.w * scale);
  const cssH = Math.floor(DESIGN.h * scale);
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);

  Object.assign(view, { cssW, cssH, dpr, scale: cssW / DESIGN.w });

  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);

  const s = view.scale * dpr;
  ctx.setTransform(s, 0, 0, s, 0, 0);
}

// Map a pointer event (client px) to design-unit coordinates, or null if outside.
function eventToDesign(e) {
  const r = canvas.getBoundingClientRect();
  const x = (e.clientX - r.left) / view.scale;
  const y = (e.clientY - r.top) / view.scale;
  if (x < 0 || y < 0 || x > DESIGN.w || y > DESIGN.h) return null;
  return { x, y };
}

// --- Fixed-timestep loop ---------------------------------------------------
const STEP = 1 / 60; // seconds per update
let acc = 0;
let last = performance.now();

function update(dt) {
  updateWorld(state, dt);
}

function frame(now) {
  let elapsed = (now - last) / 1000;
  last = now;
  if (elapsed > 0.25) elapsed = 0.25; // clamp after tab was hidden
  acc += elapsed;
  while (acc >= STEP) {
    update(STEP);
    acc -= STEP;
  }
  renderScene(ctx, state);
  hud.update(state);
  updateDebug(now);
  requestAnimationFrame(frame);
}

// --- Debug overlay ---------------------------------------------------------
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
  const m = state.meters;
  debugEl.textContent =
    `field ${view.cssW}x${view.cssH}  ar ${(view.cssW / view.cssH).toFixed(3)}\n` +
    `dpr ${view.dpr}  scale ${view.scale.toFixed(3)}\n` +
    `insets t${i.t} r${i.r} b${i.b} l${i.l}\n` +
    `soil ${m.soil.toFixed(2)} shade ${m.shade.toFixed(2)} humid ${m.humidity.toFixed(2)}\n` +
    `survival ${(survivalChance(state) * 100).toFixed(0)}%  fps ${fps}`;
}

// --- Input & wiring --------------------------------------------------------
function toggleDebug() {
  showDebug = !showDebug;
  debugEl.hidden = !showDebug;
}

addEventListener('keydown', (e) => { if (e.key === 'd' || e.key === 'D') toggleDebug(); });
addEventListener('pointerdown', (e) => {
  if (e.clientX < 70 && e.clientY < 44) { toggleDebug(); return; } // above the eco panel
  const p = eventToDesign(e);
  if (!p) return;
  const plotIndex = plotAt(state, p.x, p.y);
  if (plotIndex === -1) return;
  const plot = state.plots[plotIndex];
  if (!plot.unlocked) unlockPlot(state, plotIndex); // tap locked land to buy it
  else plantSeed(state, plotIndex);
});

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

// Persist periodically and whenever the app is backgrounded/closed, so the
// saved timestamp is fresh for offline-progress on the next resume.
setInterval(() => saveGame(state), 5000);
addEventListener('visibilitychange', () => { if (document.hidden) saveGame(state); });
addEventListener('pagehide', () => saveGame(state));

layout();
// Title screen first; on Start, show the first-run explainer (once). The game
// loop runs behind the overlays so the desert is already rendered.
initBoot(state, initOnboarding);
requestAnimationFrame(frame);
