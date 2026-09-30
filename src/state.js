// Game state + world geometry. Geometry helpers live here so rendering and
// input hit-testing share one source of truth.
import { GRID, STARTER_PLOTS } from './config.js';
import { START_WATER, TYPE_BY_ID, PLANT_TYPES } from './game.js';
import { L } from './layout.js';


export function createState() {
  const plots = [];
  for (let row = 0; row < GRID.rows; row++) {
    for (let col = 0; col < GRID.cols; col++) {
      // Start with a small unlocked patch (the first STARTER_PLOTS); the rest
      // are locked desert bought with water.
      plots.push({ col, row, planted: false, unlocked: plots.length < STARTER_PLOTS });
    }
  }
  return {
    water: START_WATER, // main early currency (jugs). Renewable via rain later.
    // Hidden environment meters, 0..1. Living plants raise them; survival
    // chance reads from them, so the desert bootstraps itself.
    meters: { soil: 0, shade: 0, humidity: 0 },
    selectedType: 'seed', // which plant type the next tap plants
    stageReached: 0, // highest stage index rewarded (so bonuses fire once)
    milestone: null, // transient {name, bonus, age} for the reward banner
    // Rain: unlocks once humidity is high enough, then cycles. `intensity` eases
    // 0..1 so showers build and wean off gradually. Transient (not persisted).
    rain: { unlocked: false, active: false, timer: 0, intensity: 0 },
    // Transient visual effects (floating text, survive/die pops). Aged and
    // cleared in updateWorld; drawn by render. Not persisted.
    fx: [],
    plots,
  };
}

// Screen (CSS px) center of a tile, from the adaptive layout.
export function tileCenter(col, row) {
  return { x: L.ox + (col - row) * L.tw, y: L.oy + (col + row) * L.th };
}

// Drawn height (px) of a plant, capped so tall tiers don't tower over — and hide
// — the tiles behind them. Render and hit-testing share this.
export function plantHeight(plant) {
  const type = TYPE_BY_ID[plant.typeId] || PLANT_TYPES[0];
  const growth = plant.status === 'settling' ? 0.25 : 0.4 + 0.6 * (plant.growth || 0);
  return Math.min(L.th * 2.1 * growth * type.size, L.th * 3.1);
}

// Which plot (if any) is under a point in screen px. Plants are picked
// front-to-back first (so tapping a plant selects ITS tile, never a hidden tile
// behind it), then the ground tile via the inverse iso transform.
export function plotAt(state, x, y) {
  const planted = state.plots
    .filter((p) => p.plant)
    .sort((a, b) => (b.col + b.row) - (a.col + a.row)); // nearest first
  for (const p of planted) {
    const c = tileCenter(p.col, p.row);
    const hgt = plantHeight(p.plant);
    if (x >= c.x - L.tw * 0.8 && x <= c.x + L.tw * 0.8 &&
        y <= c.y + L.th * 0.6 && y >= c.y - hgt) {
      return p.row * GRID.cols + p.col;
    }
  }
  const px = x - L.ox, py = y - L.oy;
  const col = Math.round((px / L.tw + py / L.th) / 2);
  const row = Math.round((py / L.th - px / L.tw) / 2);
  if (col < 0 || row < 0 || col >= GRID.cols || row >= GRID.rows) return -1;
  return row * GRID.cols + col;
}
