// Game state + world geometry. Geometry helpers live here so rendering and
// input hit-testing share one source of truth.
import { STARTER_PLOTS } from './config.js';
import { START_WATER, TYPE_BY_ID, PLANT_TYPES } from './game.js';
import { L } from './layout.js';
import { activeDims, setActiveWorld, FIRST_WORLD_ID } from './world.js';

// A fresh set of plots sized to a given world's grid (first STARTER_PLOTS
// unlocked, the rest locked desert bought with water).
export function freshPlots(worldId) {
  setActiveWorld(worldId);
  const { cols, rows } = activeDims();
  const plots = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      plots.push({ col, row, planted: false, unlocked: plots.length < STARTER_PLOTS });
    }
  }
  return plots;
}

export function createState() {
  setActiveWorld(FIRST_WORLD_ID);
  const plots = freshPlots(FIRST_WORLD_ID);
  return {
    // --- Which world is being tended, and saved state for every unlocked one.
    // GLOBAL fields (water/upgrades/legacy/stats/daily/quests) are shared across
    // all worlds; PER-WORLD fields (meters/plots/stageReached/selectedType/
    // restoredDate) live on `state.*` for the active world and are snapshotted
    // into `worlds[id]` on save or when switching worlds (see save.js, A4/A8).
    worldId: FIRST_WORLD_ID,
    worlds: {}, // { [id]: perWorldSnapshot } — filled on save/switch
    restoredDate: null, // local YYYY-MM-DD this (active) world was restored, else null
    completionPromptSeen: false, // has the "this land is whole" modal auto-popped for this world
    water: START_WATER, // main early currency (jugs). Renewable via rain later.
    // Hidden environment meters, 0..1. Living plants raise them; survival
    // chance reads from them, so the desert bootstraps itself.
    meters: { soil: 0, shade: 0, humidity: 0 },
    selectedType: 'seed', // which plant type the next tap plants
    upgrades: {}, // permanent upgrade levels bought with water (see game.UPGRADES)
    stats: { planted: 0, collected: 0, unlocked: 0, upgraded: 0, replaced: 0 }, // cumulative, for quests
    quests: [], // active quest instances (assigned by game.initQuests)
    legacy: 0, // permanent prestige currency (survives "plant a new forest")
    forests: 0, // how many forests grown to completion
    daily: { last: null, streak: 0 }, // daily gift streak (local dates)
    stageReached: 0, // highest stage index rewarded (so bonuses fire once)
    milestone: null, // transient {name, bonus, age} for the reward banner
    // Rain: unlocks once humidity is high enough, then cycles. `intensity` eases
    // 0..1 so showers build and wean off gradually. Transient (not persisted).
    rain: { unlocked: false, active: false, timer: 0, intensity: 0 },
    // Transient visual effects (floating text, survive/die pops). Aged and
    // cleared in updateWorld; drawn by render. Not persisted.
    fx: [],
    events: [], // one-shot game events (e.g. 'survive'/'wither') → sounds; drained each frame

    plots,
  };
}

// --- Per-world snapshots ---------------------------------------------------
// The active world's live fields (meters/plots/stageReached/selectedType/
// restoredDate) are captured into a plain snapshot for `state.worlds` (on save
// or before switching), and applied back when a world becomes active. Rain is
// transient — it's re-derived from humidity, not stored.

export function activeSnapshot(state) {
  return {
    meters: { ...state.meters },
    plots: state.plots.map((p) => ({
      col: p.col, row: p.row, unlocked: p.unlocked, planted: p.planted, plant: p.plant,
    })),
    stageReached: state.stageReached,
    selectedType: state.selectedType,
    restoredDate: state.restoredDate || null,
    completionPromptSeen: !!state.completionPromptSeen,
  };
}

// Make `id` the active world, writing its snapshot into the live fields.
export function applySnapshot(state, id, snap) {
  setActiveWorld(id);
  state.worldId = id;
  state.meters = { soil: 0, shade: 0, humidity: 0, ...(snap.meters || {}) };
  state.plots = Array.isArray(snap.plots) && snap.plots.length ? snap.plots : freshPlots(id);
  state.stageReached = Number.isInteger(snap.stageReached) ? snap.stageReached : 0;
  state.selectedType = typeof snap.selectedType === 'string' ? snap.selectedType : 'seed';
  state.restoredDate = snap.restoredDate || null;
  state.completionPromptSeen = !!snap.completionPromptSeen;
  // Rain + transient effects reset; rain re-derives from humidity next frame.
  state.rain = { unlocked: false, active: false, timer: 0, intensity: 0 };
  state.fx = [];
  state.events = [];
  state.milestone = null;
}

// Base-space (CSS px, pre-camera) center of a tile. Drawing happens through the
// camera transform (see layout.applyCamera), so this stays camera-independent;
// input code inverts the camera via screenToBase() before hit-testing.
export function tileCenter(col, row) {
  return { x: L.ox + (col - row) * L.tw, y: L.oy + (col + row) * L.th };
}

// A screen (CSS px) point mapped back into base space: base = (screen - cam)/zoom.
function screenToBase(x, y) {
  return { x: (x - L.camX) / L.zoom, y: (y - L.camY) / L.zoom };
}

// Drawn height (px) of a plant. Kept short (a bit over one tile) so tall tiers
// don't tower over and hide the tiles behind them. Render + hit-testing share it.
export function plantHeight(plant) {
  const type = TYPE_BY_ID[plant.typeId] || PLANT_TYPES[0];
  const growth = plant.status === 'settling' ? 0.25 : 0.4 + 0.6 * (plant.growth || 0);
  const v = 0.86 + 0.28 * (plant.v ?? 0.5); // per-plant size variation
  return Math.min(L.th * 1.7 * growth * type.size * v, L.th * 2.4 * v);
}

// A ripe fruit or thirst bubble floats above its plant; tapping the icon itself
// should hit that plant (checked before the ground tile). Returns index or -1.
export function iconAt(state, x, y) {
  const r = 16 * L.unit;
  const b = screenToBase(x, y); // compare in base space (where tileCenter lives)
  for (let i = 0; i < state.plots.length; i++) {
    const pl = state.plots[i].plant;
    if (!pl || pl.status !== 'alive' || !(pl.ripe || pl.thirsty)) continue;
    const c = tileCenter(state.plots[i].col, state.plots[i].row);
    const iy = c.y - plantHeight(pl) - 8 * L.unit;
    if ((b.x - c.x) ** 2 + (b.y - iy) ** 2 <= r * r) return i;
  }
  return -1;
}

// Which plot is under a point (screen px) — purely by the ground tile diamond
// (inverse iso transform), so EVERY tile is tappable by its own diamond
// regardless of what's planted on neighbouring tiles.
export function plotAt(state, x, y) {
  const b = screenToBase(x, y);
  const px = b.x - L.ox, py = b.y - L.oy;
  const col = Math.round((px / L.tw + py / L.th) / 2);
  const row = Math.round((py / L.th - px / L.tw) / 2);
  const { cols, rows } = activeDims();
  if (col < 0 || row < 0 || col >= cols || row >= rows) return -1;
  return row * cols + col;
}
