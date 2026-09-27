// Gameplay rules and actions. state.js holds data + geometry; this holds the
// verbs that change the world. Update dynamics (survival, growth) arrive in
// later slices.

export const SEED_COST = 1; // cheap on purpose — early failure must not punish

// Attempt to plant a seed in plot `index`. Returns true if it happened.
export function plantSeed(state, index) {
  const plot = state.plots[index];
  if (!plot || plot.planted) return false;
  if (state.water < SEED_COST) return false;

  state.water -= SEED_COST;
  plot.planted = true;
  plot.plant = { alive: true, growth: 0 }; // growth/survival handled in S5–S7
  return true;
}
