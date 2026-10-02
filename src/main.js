// Rainforest — app shell: layout, fixed-timestep loop, input, debug overlay.
// Game world lives in state.js / render.js.
import { MAX_DPR, CONTROL_BAND } from './config.js';
import { plotAt, iconAt, tileCenter } from './state.js';
import { activeDims } from './world.js';
import { computeLayout, L } from './layout.js';
import { actOnTile, tileAction, updateWorld, survivalChance, collectAmount, initQuests, doPrestige, claimDaily, markDailyStart } from './game.js';
import { renderScene, renderBackdrop } from './render.js';
import { createHud } from './hud.js';
import { createShop } from './shop.js';
import { createQuests } from './quests.js';
import { createPrestige } from './prestige.js';
import { initAudio, resumeAudio, setRain, sfx } from './sound.js';
import { loadGame, saveGame, clearSave } from './save.js';
import { createSettings } from './settings.js';
import { createGrove } from './grove.js';
import { showDaily } from './daily.js';
import { initOnboarding } from './onboarding.js';
import { showLoader } from './loader.js';
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
initQuests(state); // assign starting goals if none

// The lone man walks to a tapped tile and acts (unlock/plant) on arrival, then
// stays put. lastIdx = the tile he's standing on (so he tracks it on resize).
const man = { x: 0, y: 0, facing: 1, moving: false, queue: [], lastIdx: null };
function manStandAt(idx) {
  const p = state.plots[idx];
  const t = tileCenter(p.col, p.row);
  return { x: t.x, y: t.y + L.th * 0.2 };
}
function manRest() {
  const t = tileCenter(0, activeDims().rows - 1);
  return { x: t.x - L.tw * 0.5, y: t.y + L.th * 0.6 };
}

// Manually fetching water from jugs — the early gameplay action.
// Becomes renewable via rain later. Amount tuned in the feel pass (S10).
const prestige = createPrestige(state, () => {
  if (doPrestige(state)) { sfx.fanfare(); save(); }
});
const shop = createShop(state, () => sfx.upgrade(), () => prestige.show());
const quests = createQuests(state, () => sfx.upgrade());
// Saving is suspended while a reset is in flight, so the unload handlers can't
// write the old forest back after we clear it.
let resetting = false;
const save = () => { if (!resetting) saveGame(state); };
const settings = createSettings({
  onReplayStory() { initOnboarding(true); },
  onReset() { resetting = true; clearSave(); location.reload(); },
});
const grove = createGrove();
const hud = createHud({
  onCollectWater() { state.water += collectAmount(state); if (state.stats) state.stats.collected++; sfx.collect(); },
  onSelectType(id) { state.selectedType = id; },
  onOpenShop() { shop.open(); },
  onOpenQuests() { quests.open(); },
  onOpenSettings() { settings.open(); },
  onOpenGrove() { grove.open(); },
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
  L.dpr = dpr;

  for (const [cv, cx] of [[canvas, ctx], [bgCanvas, bgCtx]]) {
    cv.style.width = winW + 'px';
    cv.style.height = winH + 'px';
    cv.width = Math.round(winW * dpr);
    cv.height = Math.round(winH * dpr);
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Keep the idle man on his current tile (or the rest spot) as the grid resizes.
  if (!man.queue.length) {
    const r = man.lastIdx != null ? manStandAt(man.lastIdx) : manRest();
    man.x = r.x; man.y = r.y;
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

// Walk the man toward his next queued tile and act on arrival.
function moveMan(dt) {
  if (man.queue.length) {
    man.moving = true;
    const idx = man.queue[0];
    const plot = state.plots[idx];
    const t = tileCenter(plot.col, plot.row);
    const tx = t.x, ty = t.y + L.th * 0.2;
    const dx = tx - man.x, dy = ty - man.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dx < -0.5) man.facing = -1; else if (dx > 0.5) man.facing = 1;
    const step = 640 * L.unit * dt; // quick
    if (dist <= step + 4) {
      man.x = tx; man.y = ty;
      const done = actOnTile(state, idx);
      if (done === 'unlock') sfx.unlock();
      else if (done === 'harvest') sfx.harvest();
      else if (done === 'water') sfx.water();
      else if (done === 'uproot') sfx.uproot();
      else if (done) sfx.plant();
      man.lastIdx = idx;
      man.queue.shift();
    } else {
      man.x += dx / dist * step;
      man.y += dy / dist * step;
    }
  } else {
    // Idle: stay where he is (no walking back to the start).
    man.moving = false;
    man.facing = 1;
  }
}

function update(dt) {
  updateWorld(state, dt);
  moveMan(dt);
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
    // Play at most one of each event sound per frame (avoid spam on mass plant).
    if (state.events.length) {
      if (state.events.includes('survive')) sfx.survive();
      if (state.events.includes('wither')) sfx.wither();
      if (state.events.includes('mature')) sfx.mature();
      state.events.length = 0;
    }
  }
  renderBackdrop(bgCtx, state, now);
  renderScene(ctx, state, now, man);
  hud.update(state);
  shop.refresh(); // keep affordability current while open
  quests.refresh();
  setRain(state.rain ? state.rain.intensity : 0);
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
  if (e.target !== canvas) return; // ignore HUD buttons and open overlays
  const p = eventToScreen(e);
  let plotIndex = iconAt(state, p.x, p.y); // fruit / thirst icons first
  if (plotIndex === -1) plotIndex = plotAt(state, p.x, p.y);
  if (plotIndex === -1) return;
  // Queue the tile; the man walks there and acts on arrival (see moveMan).
  // Only walk if the tap would do something (unlock / plant / upgrade).
  if (tileAction(state, plotIndex) && man.queue.length < 8) man.queue.push(plotIndex);
});

// Web Audio must start from a user gesture.
addEventListener('pointerdown', () => { initAudio(); resumeAudio(); });

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
setInterval(save, 5000);
addEventListener('visibilitychange', () => { if (document.hidden) save(); });
addEventListener('pagehide', save);

hud.update(state); // build the selector so the first layout can measure it
layout();
requestAnimationFrame(frame); // game renders behind the overlays immediately
// Loading animation (~2.5s), then the first-run story (once) or straight to play.
showLoader(1500, () => {
  const day = (t) => new Date(t).toLocaleDateString('en-CA'); // local YYYY-MM-DD
  const today = day(Date.now()), yesterday = day(Date.now() - 86400000);
  // First run: the story (streak starts today, no gift on top of it).
  if (initOnboarding()) { markDailyStart(state, today); return; }
  // Returning: a daily gift on a new day, then a short "while away" note.
  const away = () => {
    if ((state.offlineSeconds || 0) <= 60) return;
    const mins = Math.round(state.offlineSeconds / 60);
    const label = mins < 60 ? `${mins} min` : `${Math.round(mins / 60)} h`;
    showToast(`While you were away (${label}) your forest grew · +${Math.floor(state.offlineGain || 0)} 💧`);
  };
  const gift = claimDaily(state, today, yesterday);
  if (gift) { save(); showDaily(gift, away); } else away();
});

// A brief message that fades in and out at the top of the screen.
function showToast(text) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('out'), 4200);
  setTimeout(() => el.remove(), 4800);
}
