// Game state + world geometry. Geometry helpers live here so rendering and
// input hit-testing share one source of truth.
import { DESIGN, HORIZON, GRID, ISO, CONTROL_BAND, STARTER_PLOTS } from './config.js';
import { START_WATER } from './game.js';

// Bottom space (design units) reserved for the HUD controls. Set dynamically
// from the measured DOM control height (main.layout) so the grid never sits
// under the selector/buttons on any screen. Starts at the static fallback.
let bottomReserve = CONTROL_BAND;
export function setBottomReserve(units) {
  // Clamp so the grid always keeps a usable height.
  const gridTop = HORIZON + GRID.padTop;
  const maxReserve = DESIGN.h - gridTop - 140;
  bottomReserve = Math.max(CONTROL_BAND, Math.min(units, maxReserve));
}
export function getBottomReserve() { return bottomReserve; }

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
    // Rain: unlocks once humidity is high enough, then cycles on/off. Transient
    // (not persisted) — derived from humidity on load.
    rain: { unlocked: false, active: false, timer: 0 },
    // Transient visual effects (floating text, survive/die pops). Aged and
    // cleared in updateWorld; drawn by render. Not persisted.
    fx: [],
    plots,
  };
}

// Isometric grid origin (design units), centering the diamond grid in the ground
// band between the horizon and the control reserve.
export function isoOrigin() {
  const { th, tw } = ISO;
  const gridTop = HORIZON + 18;
  const bandBottom = DESIGN.h - bottomReserve;
  const bandCenter = (gridTop + bandBottom) / 2;
  const oy = bandCenter - ((GRID.cols + GRID.rows - 2) / 2) * th;
  const ox = DESIGN.w / 2 - ((GRID.cols - GRID.rows) / 2) * tw;
  return { ox, oy };
}

// Screen (design-unit) center of a tile.
export function tileCenter(col, row) {
  const { ox, oy } = isoOrigin();
  return { x: ox + (col - row) * ISO.tw, y: oy + (col + row) * ISO.th };
}

// Which plot (if any) sits under a point in design units. Inverse iso transform
// + rounding to the nearest tile; returns index or -1.
export function plotAt(state, x, y) {
  const { ox, oy } = isoOrigin();
  const px = x - ox, py = y - oy;
  const col = Math.round((px / ISO.tw + py / ISO.th) / 2);
  const row = Math.round((py / ISO.th - px / ISO.tw) / 2);
  if (col < 0 || row < 0 || col >= GRID.cols || row >= GRID.rows) return -1;
  return row * GRID.cols + col;
}
