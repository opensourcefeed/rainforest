// Persistence + offline/idle progress. localStorage for now (native storage in
// Phase 2). Every access is wrapped in try/catch: private mode, cleared data,
// or preview contexts can throw or return null, and the game must still run.
import { createState } from './state.js';
import { updateWorld, currentStage } from './game.js';

const SAVE_KEY = 'rainforest.save.v1';

// The WebView doesn't run in the background, so we compute idle progress from
// the saved timestamp on resume. Cap it so a long absence is bounded work and
// bounded reward.
const OFFLINE_CAP_SEC = 4 * 3600;
const OFFLINE_STEP = 0.5; // coarse step keeps the catch-up loop cheap

export function saveGame(state) {
  try {
    const payload = {
      t: Date.now(),
      water: state.water,
      meters: state.meters,
      selectedType: state.selectedType,
      upgrades: state.upgrades,
      stats: state.stats,
      quests: state.quests,
      legacy: state.legacy,
      forests: state.forests,
      daily: state.daily,
      stageReached: state.stageReached,
      plots: state.plots.map((p) => ({
        col: p.col, row: p.row, unlocked: p.unlocked, planted: p.planted, plant: p.plant,
      })),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false; // storage unavailable — game continues unsaved
  }
}

// Returns a fresh-or-restored state, having applied any offline progress.
export function loadGame() {
  const state = createState();
  let raw = null;
  try {
    raw = localStorage.getItem(SAVE_KEY);
  } catch {
    return state; // storage blocked — start fresh
  }
  if (!raw) return state;

  try {
    const data = JSON.parse(raw);
    if (typeof data.water === 'number') state.water = data.water;
    if (data.meters) Object.assign(state.meters, data.meters);
    if (typeof data.selectedType === 'string') state.selectedType = data.selectedType;
    if (data.upgrades && typeof data.upgrades === 'object') state.upgrades = data.upgrades;
    if (data.stats && typeof data.stats === 'object') Object.assign(state.stats, data.stats);
    if (Array.isArray(data.quests)) state.quests = data.quests;
    if (typeof data.legacy === 'number') state.legacy = data.legacy;
    if (typeof data.forests === 'number') state.forests = data.forests;
    if (data.daily && typeof data.daily === 'object') state.daily = data.daily;
    if (Array.isArray(data.plots) && data.plots.length === state.plots.length) {
      state.plots = data.plots;
      // Migrate pre-expansion saves: no `unlocked` field means every plot was
      // plantable, so unlock them all (don't strand an existing grove).
      if (state.plots.some((p) => p.unlocked === undefined)) {
        state.plots.forEach((p) => { p.unlocked = true; });
      }
    }
    // Don't re-grant milestone bonuses for stages already reached. Trust the
    // saved value if present; otherwise seed from the restored environment.
    state.stageReached = Number.isInteger(data.stageReached)
      ? data.stageReached
      : currentStage(state).index;

    const elapsed = Math.max(0, (Date.now() - (data.t || Date.now())) / 1000);
    const capped = Math.min(elapsed, OFFLINE_CAP_SEC);
    const waterBefore = state.water;
    applyOffline(state, capped);
    state.offlineGain = Math.max(0, state.water - waterBefore); // for the while-away note
    state.offlineSeconds = capped; // for the boot screen "while away" note (not persisted)
    state.milestone = null; // don't pop a banner from offline catch-up
    state.events = []; // don't play a burst of sounds from offline catch-up
  } catch {
    return createState(); // corrupt save — start clean rather than crash
  }
  return state;
}

// Advance the world by `seconds` in coarse steps (used for idle catch-up).
export function applyOffline(state, seconds) {
  let remaining = seconds;
  while (remaining > 0) {
    const step = Math.min(OFFLINE_STEP, remaining);
    updateWorld(state, step);
    remaining -= step;
  }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}
