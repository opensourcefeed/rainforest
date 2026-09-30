// Rainforest — app shell: layout, fixed-timestep loop, input, debug overlay.
// Game world lives in state.js / render.js.
import { MAX_DPR, CONTROL_BAND } from './config.js';
import { plotAt } from './state.js';
import { computeLayout, L } from './layout.js';
import { plantSeed, unlockPlot, updateWorld, survivalChance, WATER_PER_COLLECT } from './game.js';
import { renderScene, renderBackdrop } from './render.js';
import { createHud } from './hud.js';
import { loadGame, saveGame } from './save.js';
import { initOnboarding } from './onboarding.js';
import { initBoot } from './boot.js';
import { createCelebration } from './celebrate.js';

const canvas = document.getElementById('game');
const bgCanvas = document.getElementById('bg');
const debugEl = document.getElementById('debug');
const hudEl = document.getElementById('hud');
const ctx = canvas.getContext('2d');
const bgCtx = bgCanvas.getContext('2d');

const view = { dpr: 1, insets: { t: 0, r: 0, b: 0, l: 0 } };
let showDebug = false;

// Restore the save (with offline progress applied) or start fresh.
const state = loadGame();

// Manually fetching water from jugs — the early gameplay action.
// Becomes renewable via rain later. Amount tuned in the feel pass (S10).
const hud = createHud({
  onCollectWater() { state.water += WATER_PER_COLLECT; },
  onSelectType(id) { state.selectedType = id; },
  // Selector height changes when a new tier unlocks; re-measure the reserve.
  onLayoutChange() { scheduleLayout(); },
});

// --- Adaptive layout: both canvases fill the window; the game lays out in
// screen px (see layout.js). ---
function readInsets() {
  const cs = getComputedStyle(document.documentElement);
  const px = (n) => parseFloat(cs.getPropertyValue(n)) || 0;
  view.insets = { t: px('--safe-t'), r: px('--safe-r'), b: px('--safe-b'), l: px('--safe-l') };
}

function layout() {
  readInsets();
  const vp = window.visualViewport;
  const winW = Math.round(vp ? vp.width : innerWidth);
  const winH = Math.round(vp ? vp.height : innerHeight);
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  view.dpr = dpr;

  // Measure the bottom control cluster (selector is its top) to reserve space
  // so the grid never sits under the controls.
  let reserveCss = CONTROL_BAND;
  const typesEl = hudEl.querySelector('.hud-types');
  if (typesEl) {
    const top = typesEl.getBoundingClientRect().top;
    reserveCss = Math.max(CONTROL_BAND, Math.min(winH - top + 8, winH * 0.5));
  }
  computeLayout(winW, winH, reserveCss);

  for (const [cv, cx] of [[canvas, ctx], [bgCanvas, bgCtx]]) {
    cv.style.width = winW + 'px';
    cv.style.height = winH + 'px';
    cv.width = Math.round(winW * dpr);
    cv.height = Math.round(winH * dpr);
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

// Pointer event (client px) -> canvas/screen px.
function eventToScreen(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

// Stage-up celebration modal. While it's up the world is paused (the scene
// still animates behind it); Continue clears the milestone and resumes.
let paused = false;
const celebrate = createCelebration({
  onContinue() { state.milestone = null; paused = false; },
});

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
  if (paused) {
    acc = 0; // no catch-up burst on resume
  } else {
    acc += elapsed;
    while (acc >= STEP) {
      update(STEP);
      acc -= STEP;
    }
  }
  renderBackdrop(bgCtx, state, now);
  renderScene(ctx, state, now);
  hud.update(state);
  // A new milestone pauses the game and raises the celebration.
  if (state.milestone && !paused) {
    paused = true;
    celebrate.show(state.milestone);
  }
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
    `win ${L.w}x${L.h}  dpr ${view.dpr}\n` +
    `tile ${L.tw.toFixed(0)}  unit ${L.unit.toFixed(2)}  reserve ${L.reserve.toFixed(0)}\n` +
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
  const p = eventToScreen(e);
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

hud.update(state); // build the selector so the first layout can measure it
layout();
// Title screen first; on Start, show the first-run explainer (once). The game
// loop runs behind the overlays so the desert is already rendered.
initBoot(state, initOnboarding);
requestAnimationFrame(frame);
