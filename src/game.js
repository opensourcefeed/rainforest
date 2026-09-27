// Gameplay rules and actions. state.js holds data + geometry; this holds the
// verbs and the per-frame world update.

export const SEED_COST = 1; // cheap on purpose — early failure must not punish

// Plant lifecycle timing (seconds). Failure is quick so the player learns fast.
const SETTLE_TIME = 1.2;     // seedling settles, then survival is rolled
const DEAD_CLEAR_TIME = 1.0; // a dead plant lingers (visible), then the plot frees

// Base survival chance before the three meters exist (S6 raises it as the
// environment improves). Low so most early plants die — the intended struggle.
export const BASE_SURVIVAL = 0.25;

export function survivalChance(state) {
  void state; // meters factored in from S6
  return BASE_SURVIVAL;
}

// Attempt to plant a seed in plot `index`. Returns true if it happened.
export function plantSeed(state, index) {
  const plot = state.plots[index];
  if (!plot || plot.planted) return false;
  if (state.water < SEED_COST) return false;

  state.water -= SEED_COST;
  plot.planted = true;
  plot.plant = { status: 'settling', age: 0 };
  return true;
}

// Advance every plant. Called each fixed step.
export function updateWorld(state, dt) {
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
    }
  }
}
