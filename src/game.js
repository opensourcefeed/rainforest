// Gameplay rules and actions. state.js holds data + geometry; this holds the
// verbs and the per-frame world update.
import { STARTER_PLOTS, GRID } from './config.js';

export const SEED_COST = 2; // starting seed cost (also PLANT_TYPES[0].cost)

// Plant types, unlocked as the environment reaches each stage. Higher tiers cost
// more water but heal the land faster (meterMul) and yield more water (yieldMul)
// — the core strategy and the deeper water sink. `size`/`color` drive rendering.
export const PLANT_TYPES = [
  { id: 'seed',   name: 'Hardy seed', emoji: '🌱', cost: 2,  minStage: 0, meterMul: 1.0, yieldMul: 0.0, growTime: 20, color: '#9ad152', size: 1.0 },
  { id: 'cactus', name: 'Cactus',     emoji: '🌵', cost: 6,  minStage: 1, meterMul: 1.5, yieldMul: 0.4, growTime: 22, color: '#3fa47e', size: 1.15 },
  { id: 'shrub',  name: 'Shrub',      emoji: '🌿', cost: 16, minStage: 2, meterMul: 2.1, yieldMul: 0.8, growTime: 26, color: '#6bb63f', size: 1.35 },
  { id: 'tree',   name: 'Tree',       emoji: '🌳', cost: 40, minStage: 3, meterMul: 2.8, yieldMul: 1.3, growTime: 32, color: '#3f8f37', size: 1.7 },
  { id: 'canopy', name: 'Canopy',     emoji: '🌴', cost: 95, minStage: 4, meterMul: 3.6, yieldMul: 1.9, growTime: 40, color: '#2a6f2e', size: 2.1 },
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

// --- Prestige: "plant a new forest" for a permanent legacy boost -----------
// Legacy persists across forests and speeds every future one, so completing a
// forest is worth starting over — the long-term loop (and the real-tree theme).
export function legacyBonus(state) {
  return 1 + (state.legacy || 0) * 0.03; // +3% growth/yield per legacy
}
export function canPrestige(state) {
  return state.stageReached >= 4; // reached Rainforest
}
export function prestigeGain(state) {
  return Math.max(1, Math.round(state.stageReached * 2 + livingCount(state) * 0.3 + avgMeter(state) * 4));
}
export function doPrestige(state) {
  if (!canPrestige(state)) return 0;
  const gain = prestigeGain(state);
  state.legacy = (state.legacy || 0) + gain;
  state.forests = (state.forests || 0) + 1;
  // Reset the run (legacy, forests, lifetime stats are kept).
  state.water = START_WATER;
  state.meters = { soil: 0, shade: 0, humidity: 0 };
  state.selectedType = 'seed';
  state.stageReached = 0;
  state.milestone = null;
  state.rain = { unlocked: false, active: false, timer: 0, intensity: 0 };
  state.upgrades = {};
  state.fx = [];
  state.plots.forEach((p, i) => { p.unlocked = i < STARTER_PLOTS; p.planted = false; p.plant = null; });
  state.quests = [];
  initQuests(state);
  return gain;
}

// --- Daily gift: a reason to come back each day --------------------------
// Consecutive days grow a streak; the gift scales with current income so it
// stays meaningful late in the game. Dates are local 'YYYY-MM-DD' strings.
export function claimDaily(state, today, yesterday) {
  const d = state.daily || (state.daily = { last: null, streak: 0 });
  if (d.last === today) return null;
  d.streak = d.last === yesterday ? d.streak + 1 : 1;
  d.last = today;
  const base = Math.max(25, Math.round(waterRate(state) * 60));
  const gift = Math.round(base * (1 + 0.15 * Math.min(d.streak - 1, 6)));
  state.water += gift;
  return { streak: d.streak, gift };
}
// First run: start the streak today without a gift (the story is showing).
export function markDailyStart(state, today) {
  state.daily = { last: today, streak: 1 };
}

// --- Upgrades: permanent boosts bought with water (the main water sink) -----
export const UPGRADES = [
  { id: 'survival', name: 'Fertile Soil', icon: '🌱', desc: 'Seeds survive more often', base: 25, growth: 1.8, max: 8 },
  { id: 'growth', name: 'Warm Sun', icon: '☀️', desc: 'Plants grow faster', base: 30, growth: 1.85, max: 8 },
  { id: 'yield', name: 'Deep Roots', icon: '💧', desc: 'Plants yield more water', base: 40, growth: 1.9, max: 10 },
  { id: 'cost', name: 'Seed Bank', icon: '🌰', desc: 'Seeds cost less', base: 35, growth: 2.0, max: 6 },
  { id: 'rain', name: 'Rain Dance', icon: '🌧️', desc: 'Rain comes more often', base: 60, growth: 2.1, max: 6 },
  { id: 'collect', name: 'Bigger Jugs', icon: '🪣', desc: 'Collect more water', base: 20, growth: 1.7, max: 8 },
];

export function upgradeLevel(state, id) {
  return (state.upgrades && state.upgrades[id]) || 0;
}
export function upgradeCost(state, id) {
  const u = UPGRADES.find((x) => x.id === id);
  if (!u) return Infinity;
  const lvl = upgradeLevel(state, id);
  if (lvl >= u.max) return Infinity;
  return Math.ceil(u.base * Math.pow(u.growth, lvl));
}
export function buyUpgrade(state, id) {
  const u = UPGRADES.find((x) => x.id === id);
  if (!u) return false;
  const lvl = upgradeLevel(state, id);
  if (lvl >= u.max || state.water < upgradeCost(state, id)) return false;
  state.water -= upgradeCost(state, id);
  state.upgrades[id] = lvl + 1;
  if (state.stats) state.stats.upgraded++;
  return true;
}

// --- Quests: rotating goals that reward water (direction + activity) --------
export const QUEST_POOL = [
  { key: 'plant', metric: (s) => s.stats.planted, goals: [5, 12, 25], reward: (g) => g * 3, text: (g) => `Plant ${g} seeds` },
  { key: 'living', abs: true, metric: (s) => livingCount(s), goals: [4, 8, 15], reward: (g) => g * 5, text: (g) => `Have ${g} plants growing at once` },
  { key: 'unlock', abs: true, metric: (s) => unlockedCount(s), goals: [8, 14, 20], reward: (g) => g * 4, text: (g) => `Expand your land to ${g} plots` },
  { key: 'collect', metric: (s) => s.stats.collected, goals: [10, 25, 50], reward: (g) => g * 2, text: (g) => `Collect water ${g} times`, eligible: (s) => !(s.rain && s.rain.unlocked) },
  { key: 'upgrade', metric: (s) => s.stats.upgraded, goals: [1, 3, 6], reward: (g) => g * 25, text: (g) => `Buy ${g} upgrade${g > 1 ? 's' : ''}` },
  { key: 'mature', abs: true, metric: (s) => matureCount(s), goals: [5, 10, 18], reward: (g) => g * 6, text: (g) => `Grow ${g} plants to full size` },
  { key: 'bigtrees', abs: true, metric: (s) => countTier(s, 3), goals: [1, 3, 6], reward: (g) => g * 30, text: (g) => `Have ${g} tree${g > 1 ? 's' : ''} or canopies growing` },
  { key: 'harvest', metric: (s) => s.stats.harvested || 0, goals: [3, 8, 15], reward: (g) => g * 8, text: (g) => `Harvest ${g} fruits`, eligible: (s) => s.stageReached >= 1 },
  { key: 'water', metric: (s) => s.stats.watered || 0, goals: [2, 5, 10], reward: (g) => g * 6, text: (g) => `Water ${g} thirsty plants`, eligible: (s) => matureCount(s) >= 3 },
];

// Fully-grown living plants.
export function matureCount(state) {
  let n = 0;
  for (const p of state.plots) if (p.plant && p.plant.status === 'alive' && p.plant.growth >= 1) n++;
  return n;
}
// Living plants at or above a tier index (0 seed .. 4 canopy).
export function countTier(state, minTier) {
  let n = 0;
  for (const p of state.plots) {
    if (p.plant && p.plant.status === 'alive' && tierOf(p.plant.typeId) >= minTier) n++;
  }
  return n;
}

function makeQuest(tmpl, state) {
  let goals = tmpl.goals;
  // For "have N at once" goals, prefer one above the current count so it's never
  // already satisfied on assignment (free claim); fall back to the hardest.
  if (tmpl.abs) {
    const cur = tmpl.metric(state);
    const harder = goals.filter((g) => g > cur);
    goals = harder.length ? harder : [goals[goals.length - 1]];
  }
  const goal = goals[Math.floor(Math.random() * goals.length)];
  return { key: tmpl.key, goal, base: tmpl.abs ? 0 : tmpl.metric(state) };
}

// Replace any active quest whose eligibility no longer holds (e.g. a Collect
// quest once rain has retired the Collect button), so no slot dead-locks.
export function pruneQuests(state) {
  (state.quests || []).forEach((q, i) => {
    const t = QUEST_POOL.find((x) => x.key === q.key);
    if (!t || !t.eligible || t.eligible(state)) return;
    const others = new Set(state.quests.filter((_, j) => j !== i).map((x) => x.key));
    const cands = QUEST_POOL.filter((c) => !others.has(c.key) && (!c.eligible || c.eligible(state)));
    if (cands.length) state.quests[i] = makeQuest(cands[Math.floor(Math.random() * cands.length)], state);
  });
}
export function initQuests(state) {
  if (!state.quests) state.quests = [];
  // Drop any saved quest whose template no longer exists (e.g. old 'replace').
  state.quests = state.quests.filter((q) => QUEST_POOL.some((t) => t.key === q.key));
  const used = new Set(state.quests.map((q) => q.key));
  const pool = QUEST_POOL.filter((t) => !used.has(t.key) && (!t.eligible || t.eligible(state)));
  while (state.quests.length < 3 && pool.length) {
    state.quests.push(makeQuest(pool.splice(Math.floor(Math.random() * pool.length), 1)[0], state));
  }
}
export function questInfo(state, q) {
  const t = QUEST_POOL.find((x) => x.key === q.key);
  const cur = Math.max(0, t.metric(state) - q.base);
  return { text: t.text(q.goal), cur: Math.min(cur, q.goal), goal: q.goal, done: cur >= q.goal, reward: t.reward(q.goal) };
}
export function anyClaimable(state) {
  return (state.quests || []).some((q) => questInfo(state, q).done);
}
export function claimQuest(state, index) {
  const q = state.quests[index];
  if (!q) return 0;
  const info = questInfo(state, q);
  if (!info.done) return 0;
  state.water += info.reward;
  const others = new Set(state.quests.filter((_, i) => i !== index).map((x) => x.key));
  let cands = QUEST_POOL.filter((t) => !others.has(t.key) && (!t.eligible || t.eligible(state)));
  if (!cands.length) cands = QUEST_POOL.filter((t) => !others.has(t.key));
  state.quests[index] = makeQuest(cands[Math.floor(Math.random() * cands.length)], state);
  return info.reward;
}

// Effective values after upgrades.
export function collectAmount(state) {
  return WATER_PER_COLLECT + upgradeLevel(state, 'collect') * 2;
}
export function plantCost(state, type) {
  const d = upgradeLevel(state, 'cost') * 0.05;
  return Math.max(1, Math.round(type.cost * (1 - d)));
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
  if (state.stats) state.stats.unlocked++;
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
const METER_GAIN = 0.0006;

// Upgrade effect per level (Warm Sun / Deep Roots). Kept modest so maxed
// upgrades don't flood the economy (balance pass S55).
const UP_GROWTH = 0.08;
const UP_YIELD = 0.10;

// Slow passive water trickle so a player is never hard-stuck at 0 water, plus
// how much a manual collect grants. (Feel pass, S10.)
export const WATER_REGEN_PER_SEC = 0.08;
export const WATER_PER_COLLECT = 3;
export const START_WATER = 8;

// Established plants yield water as the land grows humid (dew/rain) — the idle
// economy: income scales with your grove, so water stops being useless and the
// expand/plant loop sustains itself. Scaled by growth and humidity.
export const WATER_YIELD = 0.16;

// Rain: once humidity crosses the threshold, rain events begin and water becomes
// truly renewable (the tycoon turning point). Rain cycles on/off and pours water
// while active.
export const RAIN_HUMIDITY = 0.5;
const RAIN_INTERVAL = 42;   // dry gap between showers (s)
const RAIN_DURATION = 20;   // wet window (s)
const RAIN_TAU = 3.4;       // easing time constant — gradual build / wean-off
export const RAIN_WATER = 4.5; // water per second at full intensity

// Advance the rain cycle. `intensity` eases toward 1 during a shower and 0
// otherwise, so rain builds up and tapers off gradually (and drives the light,
// clouds, and water yield smoothly).
function updateRain(state, dt) {
  const rain = state.rain;
  if (state.meters.humidity < RAIN_HUMIDITY) {
    rain.active = false; // fade out if humidity drops below the threshold
  } else {
    if (!rain.unlocked) { rain.unlocked = true; rain.active = false; rain.timer = 8; }
    rain.timer -= dt;
    if (rain.timer <= 0) {
      rain.active = !rain.active;
      const rl = upgradeLevel(state, 'rain');
      rain.timer = rain.active
        ? RAIN_DURATION * (1 + rl * 0.1)
        : RAIN_INTERVAL * Math.max(0.4, 1 - rl * 0.1);
    }
  }

  const target = rain.active ? 1 : 0;
  rain.intensity += (target - rain.intensity) * (1 - Math.exp(-dt / RAIN_TAU));
  if (rain.intensity < 0.001) rain.intensity = 0;

  if (rain.intensity > 0.02) {
    state.water += RAIN_WATER * dt * rain.intensity;
    state.meters.humidity = Math.min(1, state.meters.humidity + 0.004 * dt * rain.intensity);
  }
}

// Current total water income per second (trickle + grove yield), for the HUD.
export function waterRate(state) {
  let rate = WATER_REGEN_PER_SEC + upgradeLevel(state, 'collect') * 0.03;
  const humidity = state.meters.humidity;
  const yieldMulUp = (1 + upgradeLevel(state, 'yield') * UP_YIELD) * legacyBonus(state);
  for (const plot of state.plots) {
    const p = plot.plant;
    if (p && p.status === 'alive' && !p.thirsty) {
      const type = TYPE_BY_ID[p.typeId] || PLANT_TYPES[0];
      rate += WATER_YIELD * p.growth * humidity * type.yieldMul * yieldMulUp
        * (tileBonus(state, plot).mixed ? MIXED_MUL : 1);
    }
  }
  if (state.rain) rate += RAIN_WATER * (state.rain.intensity || 0);
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
  const bonus = upgradeLevel(state, 'survival') * 0.04;
  return Math.min(0.97, BASE_SURVIVAL + avgMeter(state) * (MAX_SURVIVAL - BASE_SURVIVAL) + bonus);
}

// Attempt to plant a seed in plot `index`. Returns true if it happened.
export function plantSeed(state, index) {
  const plot = state.plots[index];
  if (!plot || !plot.unlocked || plot.planted) return false;
  const type = selectedType(state);
  const cost = plantCost(state, type);
  if (state.water < cost) {
    pushFx(state, plot.col, plot.row, 'need', `${cost}💧`);
    return false;
  }

  state.water -= cost;
  plot.planted = true;
  plot.plant = { status: 'settling', age: 0, growth: 0, typeId: type.id, v: Math.random() };
  if (state.stats) state.stats.planted++;
  // Show the odds the player is up against, so failure reads as informative.
  const sheltered = tileBonus(state, plot).nurse > 0;
  pushFx(state, plot.col, plot.row, 'chance', Math.round(survivalAt(state, plot) * 100) + '%' + (sheltered ? ' 🌿' : ''));
  return true;
}

// --- Adjacency: plants help their neighbours (placement strategy) --------
// Nurse plants: established neighbours shelter a seedling (+survival).
// Shade: adjacent trees/canopies speed growth. Mixed grove: 3+ species around a
// plant (itself included) boost its water yield.
export const NURSE_BONUS = 0.06;  // survival per established neighbour
export const SHADE_BONUS = 0.15;  // growth per adjacent tree/canopy
export const MIXED_MUL = 1.3;     // yield multiplier for a mixed grove

function neighbourPlants(state, plot) {
  const out = [];
  for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const c = plot.col + dc, r = plot.row + dr;
    if (c < 0 || r < 0 || c >= GRID.cols || r >= GRID.rows) continue;
    const n = state.plots[r * GRID.cols + c];
    if (n && n.plant && n.plant.status === 'alive') out.push(n.plant);
  }
  return out;
}

// Bonuses a tile currently gets from its neighbours.
export function tileBonus(state, plot) {
  const nb = neighbourPlants(state, plot);
  const nurse = nb.filter((p) => p.growth >= 0.5).length;
  const shade = nb.filter((p) => tierOf(p.typeId) >= 3).length;
  const kinds = new Set(nb.map((p) => p.typeId));
  if (plot.plant) kinds.add(plot.plant.typeId);
  return { nurse, shade, mixed: kinds.size >= 3 };
}

// Survival for a seedling on this specific tile (environment + nurse plants).
export function survivalAt(state, plot) {
  return Math.min(0.97, survivalChance(state) + NURSE_BONUS * tileBonus(state, plot).nurse);
}

// --- Harvest & care --------------------------------------------------------
const FRUIT_TIME = 35;     // seconds for a grown fruiting plant to ripen a fruit
const THIRST_RATE = 0.004; // chance/s a grown plant gets thirsty (dry weather)

// Water a ripe fruit is worth: scales with the plant's tier, legacy, mixed grove.
export function harvestValue(state, plot) {
  const type = TYPE_BY_ID[plot.plant.typeId] || PLANT_TYPES[0];
  const mixed = tileBonus(state, plot).mixed ? MIXED_MUL : 1;
  return Math.max(1, Math.round(8 * type.yieldMul * legacyBonus(state) * mixed));
}
export function harvestFruit(state, index) {
  const plot = state.plots[index];
  const p = plot && plot.plant;
  if (!p || !p.ripe) return 0;
  const gain = harvestValue(state, plot);
  state.water += gain;
  p.ripe = false;
  p.fruit = 0;
  if (state.stats) state.stats.harvested = (state.stats.harvested || 0) + 1;
  pushFx(state, plot.col, plot.row, 'unlock', `+${gain}💧`);
  return gain;
}
// Harvest every ripe plant at once (one tap collects the whole grove).
export function harvestAll(state) {
  let total = 0;
  for (let i = 0; i < state.plots.length; i++) {
    if (state.plots[i].plant && state.plots[i].plant.ripe) total += harvestFruit(state, i);
  }
  return total;
}
export function waterPlant(state, index) {
  const plot = state.plots[index];
  const p = plot && plot.plant;
  if (!p || !p.thirsty) return false;
  p.thirsty = false;
  if (state.stats) state.stats.watered = (state.stats.watered || 0) + 1;
  pushFx(state, plot.col, plot.row, 'survive');
  return true;
}

// --- Tile actions: what a tap on a tile would do --------------------------
const tierOf = (id) => PLANT_TYPES.findIndex((t) => t.id === id);

export const SHOVEL = 'shovel'; // pseudo-selection: the uproot tool

// 'unlock' | 'plant' | 'uproot' | 'water' | 'harvest' | null.
export function tileAction(state, index) {
  const plot = state.plots[index];
  if (!plot) return null;
  if (!plot.unlocked) return 'unlock';
  const shovel = state.selectedType === SHOVEL;
  if (!plot.planted) return shovel ? null : 'plant';
  const p = plot.plant;
  if (p && p.status === 'alive') {
    if (p.thirsty) return 'water';   // care always comes first…
    if (p.ripe) return 'harvest';    // …so the shovel never eats a ripe/thirsty plant
    if (shovel) return 'uproot';
  }
  return null;
}

// Dig out an established plant (free, instant). The tile becomes empty so a new
// plant can go there. No refund — the plant already greened the land while alive.
export function uprootPlant(state, index) {
  const plot = state.plots[index];
  const p = plot && plot.plant;
  if (!p || p.status !== 'alive') return false;
  plot.planted = false;
  plot.plant = null;
  if (state.stats) state.stats.uprooted = (state.stats.uprooted || 0) + 1;
  pushFx(state, plot.col, plot.row, 'need', '🪏');
  return true;
}

// Perform whatever a tap on this tile means. Returns the action done, or null.
export function actOnTile(state, index) {
  const a = tileAction(state, index);
  if (a === 'unlock') return unlockPlot(state, index) ? a : null;
  if (a === 'plant') return plantSeed(state, index) ? a : null;
  if (a === 'uproot') return uprootPlant(state, index) ? a : null;
  if (a === 'water') return waterPlant(state, index) ? a : null;
  if (a === 'harvest') return harvestAll(state) ? a : null;
  return null;
}

// Advance every plant and let the living ones enrich the environment.
export function updateWorld(state, dt) {
  const m = state.meters;
  const lb = legacyBonus(state);
  const growthMul = 1 + upgradeLevel(state, 'growth') * UP_GROWTH;
  const yieldMulUp = (1 + upgradeLevel(state, 'yield') * UP_YIELD) * lb;
  const raining = !!(state.rain && state.rain.intensity > 0.3);
  state.water += (WATER_REGEN_PER_SEC + upgradeLevel(state, 'collect') * 0.03) * dt; // trickle

  // Age and expire transient effects.
  for (let i = state.fx.length - 1; i >= 0; i--) {
    state.fx[i].age += dt;
    if (state.fx[i].age >= state.fx[i].ttl) state.fx.splice(i, 1);
  }

  // Milestone: the first time each new stage is reached, advance one stage,
  // grant a scaling water bonus, and raise a milestone for the celebration
  // modal (which the caller shows while paused; cleared on Continue). One stage
  // at a time so no celebration is skipped on a fast jump.
  if (!state.milestone && currentStage(state).index > state.stageReached) {
    state.stageReached += 1;
    const bonus = Math.round(15 * Math.pow(3, state.stageReached));
    state.water += bonus;
    state.milestone = { name: STAGES[state.stageReached].name, bonus };
  }

  for (const plot of state.plots) {
    const p = plot.plant;
    if (!p) continue;
    p.age += dt;

    if (p.status === 'settling' && p.age >= SETTLE_TIME) {
      p.status = Math.random() < survivalAt(state, plot) ? 'alive' : 'dead';
      pushFx(state, plot.col, plot.row, p.status === 'alive' ? 'survive' : 'die');
      if (state.events && state.events.length < 40) state.events.push(p.status === 'alive' ? 'survive' : 'wither');
      p.age = 0; // reuse as time-in-status
    } else if (p.status === 'dead' && p.age >= DEAD_CLEAR_TIME) {
      plot.planted = false; // free the plot to replant cheaply
      plot.plant = null;
    } else if (p.status === 'alive') {
      const type = TYPE_BY_ID[p.typeId] || PLANT_TYPES[0];
      const bonus = tileBonus(state, plot);

      // Care: rain waters everything; in dry weather a mature plant can get
      // thirsty. A thirsty plant SLOWS (and stops yielding water/fruit) but still
      // greens the land a little, so neglect never hard-stalls progression.
      if (p.thirsty && raining) p.thirsty = false;
      if (!p.thirsty && !raining && p.growth >= 1
          && Math.random() < THIRST_RATE * (1 - m.humidity * 0.7) * dt) {
        p.thirsty = true;
      }
      const careMul = p.thirsty ? 0.35 : 1;

      const wasGrowing = p.growth < 1;
      p.growth = Math.min(1, p.growth + dt / type.growTime * growthMul * (1 + SHADE_BONUS * bonus.shade) * careMul);
      if (wasGrowing && p.growth >= 1 && state.events && state.events.length < 40) state.events.push('mature');
      // Diminishing returns: greening already-lush land is much harder, so
      // early recovery is fast (the hook) and late stages take real work.
      const g = METER_GAIN * dt * (0.3 + 0.7 * p.growth) * type.meterMul * lb * careMul;
      m.soil = Math.min(1, m.soil + g * (1 - m.soil) ** 3);
      m.shade = Math.min(1, m.shade + g * (1 - m.shade) ** 3);
      m.humidity = Math.min(1, m.humidity + g * (1 - m.humidity) ** 3);

      if (!p.thirsty) {
        // Grove water yield — grows with the plant, humidity, tier, and upgrades.
        state.water += WATER_YIELD * dt * p.growth * m.humidity * type.yieldMul * yieldMulUp
          * (bonus.mixed ? MIXED_MUL : 1);
        // Harvest: grown fruiting plants ripen a fruit to tap.
        if (type.yieldMul > 0 && p.growth >= 1 && !p.ripe) {
          p.fruit = (p.fruit || 0) + dt / FRUIT_TIME;
          if (p.fruit >= 1) { p.ripe = true; p.fruit = 0; }
        }
      }
    }
  }

  const wasRainUnlocked = state.rain.unlocked;
  updateRain(state, dt);
  // When rain unlocks, retire any now-impossible quests (e.g. Collect water).
  if (!wasRainUnlocked && state.rain.unlocked) pruneQuests(state);
}
