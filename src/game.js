// Gameplay rules and actions. state.js holds data + geometry; this holds the
// verbs and the per-frame world update.
import { STARTER_PLOTS } from './config.js';

export const SEED_COST = 2; // starting seed cost (also PLANT_TYPES[0].cost)

// Plant types, unlocked as the environment reaches each stage. Higher tiers cost
// more water but heal the land faster (meterMul) and yield more water (yieldMul)
// — the core strategy and the deeper water sink. `size`/`color` drive rendering.
export const PLANT_TYPES = [
  { id: 'seed',   name: 'Hardy seed', cost: 2,  minStage: 0, meterMul: 1.0, yieldMul: 0.0, growTime: 20, color: '#7bbf54', size: 1.0 },
  { id: 'cactus', name: 'Cactus',     cost: 6,  minStage: 1, meterMul: 1.7, yieldMul: 0.5, growTime: 22, color: '#4f9a3f', size: 1.15 },
  { id: 'shrub',  name: 'Shrub',      cost: 16, minStage: 2, meterMul: 2.7, yieldMul: 1.2, growTime: 26, color: '#3f8f3a', size: 1.35 },
  { id: 'tree',   name: 'Tree',       cost: 40, minStage: 3, meterMul: 4.5, yieldMul: 2.4, growTime: 32, color: '#2f7f34', size: 1.7 },
  { id: 'canopy', name: 'Canopy',     cost: 95, minStage: 4, meterMul: 7.0, yieldMul: 4.2, growTime: 40, color: '#256b2f', size: 2.1 },
];
export const TYPE_BY_ID = Object.fromEntries(PLANT_TYPES.map((t) => [t.id, t]));

// Types the player can plant right now (reached their stage).
export function availableTypes(state) {
  const stage = currentStage(state).index;
  return PLANT_TYPES.filter((t) => t.minStage <= stage);
}

export function selectedType(state) {
  return TYPE_BY_ID[state.selectedType] || PLANT_TYPES[0];
}

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

// Slow passive water trickle so a player is never hard-stuck at 0 water, plus
// how much a manual collect grants. (Feel pass, S10.)
export const WATER_REGEN_PER_SEC = 0.08;
export const WATER_PER_COLLECT = 3;
export const START_WATER = 8;

// Established plants yield water as the land grows humid (dew/rain) — the idle
// economy: income scales with your grove, so water stops being useless and the
// expand/plant loop sustains itself. Scaled by growth and humidity.
export const WATER_YIELD = 0.16;

// Current total water income per second (trickle + grove yield), for the HUD.
export function waterRate(state) {
  let rate = WATER_REGEN_PER_SEC;
  const humidity = state.meters.humidity;
  for (const plot of state.plots) {
    const p = plot.plant;
    if (p && p.status === 'alive') {
      const type = TYPE_BY_ID[p.typeId] || PLANT_TYPES[0];
      rate += WATER_YIELD * p.growth * humidity * type.yieldMul;
    }
  }
  return rate;
}

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

// Progression stages, keyed off the environment average (0..1).
export const STAGES = [
  { name: 'Barren desert', min: 0 },
  { name: 'Scrubland', min: 0.2 },
  { name: 'Grassland', min: 0.4 },
  { name: 'Dry woodland', min: 0.62 },
  { name: 'Rainforest', min: 0.85 },
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
  const type = selectedType(state);
  if (state.water < type.cost) {
    pushFx(state, plot.col, plot.row, 'need', `${type.cost}💧`);
    return false;
  }

  state.water -= type.cost;
  plot.planted = true;
  plot.plant = { status: 'settling', age: 0, growth: 0, typeId: type.id };
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
      const type = TYPE_BY_ID[p.typeId] || PLANT_TYPES[0];
      p.growth = Math.min(1, p.growth + dt / type.growTime);
      // Young plants contribute a little, mature plants the full amount; higher
      // tiers heal the land faster.
      const g = METER_GAIN * dt * (0.3 + 0.7 * p.growth) * type.meterMul;
      m.soil = Math.min(1, m.soil + g);
      m.shade = Math.min(1, m.shade + g);
      m.humidity = Math.min(1, m.humidity + g);
      // Grove water yield — grows with the plant, humidity, and tier.
      state.water += WATER_YIELD * dt * p.growth * m.humidity * type.yieldMul;
    }
  }
}
