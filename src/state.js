// Game state + world geometry. Geometry helpers live here so rendering and
// input hit-testing share one source of truth.
import { DESIGN, HORIZON, GRID, STARTER_PLOTS } from './config.js';
import { START_WATER } from './game.js';

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
    // Transient visual effects (floating text, survive/die pops). Aged and
    // cleared in updateWorld; drawn by render. Not persisted.
    fx: [],
    plots,
  };
}

// Rectangle (in design units) for a plot at a given column/row.
export function plotRect(col, row) {
  const usableW = DESIGN.w - GRID.sideMargin * 2;
  const gridTop = HORIZON + GRID.padTop;
  const usableH = DESIGN.h - gridTop - GRID.padBottom;

  const cellW = (usableW - GRID.gutter * (GRID.cols - 1)) / GRID.cols;
  const cellH = (usableH - GRID.gutter * (GRID.rows - 1)) / GRID.rows;

  return {
    x: GRID.sideMargin + col * (cellW + GRID.gutter),
    y: gridTop + row * (cellH + GRID.gutter),
    w: cellW,
    h: cellH,
  };
}

// Which plot (if any) contains a point in design units. Returns index or -1.
export function plotAt(state, x, y) {
  for (let i = 0; i < state.plots.length; i++) {
    const p = state.plots[i];
    const r = plotRect(p.col, p.row);
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}
