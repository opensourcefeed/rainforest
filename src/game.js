// Gameplay rules and actions. state.js holds data + geometry; this holds the
// verbs and the per-frame world update.

export const SEED_COST = 1; // cheap on purpose — early failure must not punish

// Plant lifecycle timing (seconds). Failure is quick so the player learns fast.
const SETTLE_TIME = 1.2;     // seedling settles, then survival is rolled
const DEAD_CLEAR_TIME = 1.0; // a dead plant lingers (visible), then the plot frees

// Survival rises from BASE toward MAX as the environment (average of the three
// meters) improves. Low base so the barren start is a real struggle.
export const BASE_SURVIVAL = 0.25;
export const MAX_SURVIVAL = 0.9;

// How fast a single MATURE plant enriches each meter (per second). Small, so a
// grove builds the environment gradually. Tuned in the feel pass (S10).
const METER_GAIN = 0.01;

// Seconds for a survivor to grow from sprout to mature.
const GROW_TIME = 12;

export function avgMeter(state) {
  const m = state.meters;
  return (m.soil + m.shade + m.humidity) / 3;
}

export function survivalChance(state) {
  return BASE_SURVIVAL + avgMeter(state) * (MAX_SURVIVAL - BASE_SURVIVAL);
}

// Attempt to plant a seed in plot `index`. Returns true if it happened.
export function plantSeed(state, index) {
  const plot = state.plots[index];
  if (!plot || plot.planted) return false;
  if (state.water < SEED_COST) return false;

  state.water -= SEED_COST;
  plot.planted = true;
  plot.plant = { status: 'settling', age: 0, growth: 0 };
  return true;
}

// Advance every plant and let the living ones enrich the environment.
export function updateWorld(state, dt) {
  const m = state.meters;
  for (const plot of state.plots) {
    const p = plot.plant;
    if (!p) continue;
    p.age += dt;

    if (p.status === 'settling' && p.age >= SETTLE_TIME) {
      p.status = Math.random() < survivalChance(state) ? 'alive' : 'dead';
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
