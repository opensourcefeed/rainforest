// Gameplay rules and actions. state.js holds data + geometry; this holds the
// verbs and the per-frame world update.
import { STARTER_PLOTS } from './config.js';

export const SEED_COST = 2; // cheap, but enough that water is a real early constraint

// Land expansion: unlocking a plot costs water, rising with how many you own —
// the main early water sink and sense of growth.
const UNLOCK_BASE = 4;
const UNLOCK_GROWTH = 1.35;

export function unlockedCount(state) {
  let n = 0;
  for (const p of state.plots) if (p.unlocked) n++;
  return n;
}

// Cost to unlock the next plot.
export function unlockCost(state) {
  const beyond = Math.max(0, unlockedCount(state) - STARTER_PLOTS);
  return Math.ceil(UNLOCK_BASE * Math.pow(UNLOCK_GROWTH, beyond));
}

export function allUnlocked(state) {
  return unlockedCount(state) >= state.plots.length;
}

// Try to unlock plot `index`. Handles its own feedback; returns true on success.
export function unlockPlot(state, index) {
  const plot = state.plots[index];
  if (!plot || plot.unlocked) return false;
  const cost = unlockCost(state);
  if (state.water < cost) {
    pushFx(state, plot.col, plot.row, 'need', `${cost}💧`);
    return false;
  }
  state.water -= cost;
  plot.unlocked = true;
  pushFx(state, plot.col, plot.row, 'unlock', `−${cost}`);
  return true;
}

// Plant lifecycle timing (seconds). Failure is quick so the player learns fast.
const SETTLE_TIME = 1.2;     // seedling settles, then survival is rolled
const DEAD_CLEAR_TIME = 1.0; // a dead plant lingers (visible), then the plot frees

// Survival rises from BASE toward MAX as the environment (average of the three
// meters) improves. Low base so the barren start is a real struggle.
export const BASE_SURVIVAL = 0.25;
export const MAX_SURVIVAL = 0.9;

// How fast a single MATURE plant enriches each meter (per second). Small, so a
// grove builds the environment gradually — progression should be felt over
// minutes of tending, not seconds. (Feel pass, S10.)
const METER_GAIN = 0.0008;

// Seconds for a survivor to grow from sprout to mature.
const GROW_TIME = 25;

// Slow passive water trickle so a player is never hard-stuck at 0 water, plus
// how much a manual collect grants. (Feel pass, S10.)
export const WATER_REGEN_PER_SEC = 0.08;
export const WATER_PER_COLLECT = 3;
export const START_WATER = 8;

// Transient feedback effects. Kinds: 'chance' (survival % shown when planting),
// 'survive' (green pop), 'die' (wither mark). Aged in updateWorld.
export const FX_TTL = { chance: 1.1, survive: 0.9, die: 0.9, unlock: 1.0, need: 1.0 };

function pushFx(state, col, row, kind, text) {
  state.fx.push({ col, row, kind, text, age: 0, ttl: FX_TTL[kind] });
}

// Count of currently-living plants (for the HUD).
export function livingCount(state) {
  let n = 0;
  for (const p of state.plots) if (p.plant && p.plant.status === 'alive') n++;
  return n;
}

export function avgMeter(state) {
  const m = state.meters;
  return (m.soil + m.shade + m.humidity) / 3;
}

// Progression stages, keyed off the environment average. Phase 0 covers 1–2.
export const STAGES = [
  { name: 'Barren desert', min: 0 },
  { name: 'Scrubland', min: 0.2 },
];

export function currentStage(state) {
  const a = avgMeter(state);
  let index = 0;
  for (let i = 0; i < STAGES.length; i++) if (a >= STAGES[i].min) index = i;
  return { index, name: STAGES[index].name };
}

// 0..1 greening progress used to tint the scene from desert toward scrubland.
export function greening(state) {
  return Math.min(1, avgMeter(state) / 0.4);
}

// Progress toward the next stage: { nextName, pct } where pct is 0..1 of the
// way from the current stage's threshold to the next. At the last stage,
// nextName is null and pct is 1.
export function stageProgress(state) {
  const a = avgMeter(state);
  const { index } = currentStage(state);
  const next = STAGES[index + 1];
  if (!next) return { nextName: null, pct: 1 };
  const from = STAGES[index].min;
  const pct = Math.max(0, Math.min(1, (a - from) / (next.min - from)));
  return { nextName: next.name, pct };
}

export function survivalChance(state) {
  return BASE_SURVIVAL + avgMeter(state) * (MAX_SURVIVAL - BASE_SURVIVAL);
}

// Attempt to plant a seed in plot `index`. Returns true if it happened.
export function plantSeed(state, index) {
  const plot = state.plots[index];
  if (!plot || !plot.unlocked || plot.planted) return false;
  if (state.water < SEED_COST) return false;

  state.water -= SEED_COST;
  plot.planted = true;
  plot.plant = { status: 'settling', age: 0, growth: 0 };
  // Show the odds the player is up against, so failure reads as informative.
  pushFx(state, plot.col, plot.row, 'chance', Math.round(survivalChance(state) * 100) + '%');
  return true;
}

// Advance every plant and let the living ones enrich the environment.
export function updateWorld(state, dt) {
  const m = state.meters;
  state.water += WATER_REGEN_PER_SEC * dt; // slow trickle — never hard-stuck

  // Age and expire transient effects.
  for (let i = state.fx.length - 1; i >= 0; i--) {
    state.fx[i].age += dt;
    if (state.fx[i].age >= state.fx[i].ttl) state.fx.splice(i, 1);
  }

  for (const plot of state.plots) {
    const p = plot.plant;
    if (!p) continue;
    p.age += dt;

    if (p.status === 'settling' && p.age >= SETTLE_TIME) {
      p.status = Math.random() < survivalChance(state) ? 'alive' : 'dead';
      pushFx(state, plot.col, plot.row, p.status === 'alive' ? 'survive' : 'die');
      p.age = 0; // reuse as time-in-status
    } else if (p.status === 'dead' && p.age >= DEAD_CLEAR_TIME) {
      plot.planted = false; // free the plot to replant cheaply
      plot.plant = null;
    } else if (p.status === 'alive') {
      p.growth = Math.min(1, p.growth + dt / GROW_TIME);
      // Young plants contribute a little, mature plants the full amount.
      const g = METER_GAIN * dt * (0.3 + 0.7 * p.growth);
      m.soil = Math.min(1, m.soil + g);
      m.shade = Math.min(1, m.shade + g);
      m.humidity = Math.min(1, m.humidity + g);
    }
  }
}
