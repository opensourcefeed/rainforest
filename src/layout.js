// Adaptive layout. Instead of a fixed portrait "design box" scaled to fit, the
// whole game lays out in real screen pixels that adapt to the viewport: the two
// canvases fill the window, the horizon shifts by aspect, and the iso grid sizes
// and centers itself to the available ground area. Tile COUNT stays fixed (so
// balance is unchanged) — only spacing/scale adapt.
import { CONTROL_BAND } from './config.js';
import { activeDims } from './world.js';

export const L = {
  w: 0, h: 0,           // viewport CSS px
  dpr: 1,               // device pixel ratio (for crisp offscreen caches)
  unit: 1,              // UI scale relative to a phone baseline (fonts, strokes)
  horizonY: 0,          // sky/ground boundary, screen px
  groundBottom: 0,      // bottom of the ground (= h)
  reserve: CONTROL_BAND, // px reserved at the bottom for the HUD controls
  tw: 40, th: 20,       // iso tile half-width / half-height (zoom-adjusted)
  ox: 0, oy: 0,         // iso grid origin (grid-centred in the ground band)
  // --- Camera (Phase B) --- A big grid can't fit on screen, so the player pans
  // (and zooms) over it. camX/camY offset the origin; zoom scales the tile size.
  // Small grids that fit are centred and locked (canPan false, cam 0, zoom 1).
  camX: 0, camY: 0,     // pan offset, screen px
  panX: 0, panY: 0,     // max |camX|/|camY| (clamp bounds)
  canPan: false,        // true only when the grid overflows the ground band
  zoom: 1,              // user zoom multiplier on the base fit tile size
  minZoom: 1, maxZoom: 1,
  baseTw: 40,           // fit tile size before zoom (tw = baseTw * zoom)
};

// Comfortable minimum tile half-width (≈ tap target). Below this a grid is too
// big to fit, so we stop shrinking and let the player pan instead.
const COMFORT_TW = 34;

// Recompute L for the current viewport and measured control reserve (px).
export function computeLayout(winW, winH, reserveCss) {
  L.w = winW;
  L.h = winH;
  L.groundBottom = winH;
  L.reserve = reserveCss;

  // Horizon a bit higher on wide/landscape screens so the ground has room.
  const aspect = winW / winH;
  const hFrac = aspect > 1.2 ? 0.40 : 0.46;
  L.horizonY = Math.round(winH * hFrac);

  const { cols, rows } = activeDims();
  const availW = winW - 40;
  const bandTop = L.horizonY + 20;
  const bandBottom = winH - reserveCss;
  const availH = Math.max(80, bandBottom - bandTop);

  // Fit the iso footprint (width (cols+rows)*tw, height (cols+rows)*th, th=tw/2)
  // into the available ground area. If it fits at a comfortable tile size, use
  // that (centred, locked — the small-grid behaviour). If it's too big to fit at
  // COMFORT_TW, stop shrinking there and let the player pan over it.
  const fitTw = Math.min(availW / (cols + rows), availH / ((cols + rows) * 0.5));
  L.baseTw = Math.max(COMFORT_TW, Math.min(fitTw, 58));

  // Zoom: panning grids can be zoomed out (to survey) and in (to tap). A grid
  // that already fits is locked at zoom 1.
  const overflows = fitTw < COMFORT_TW;
  L.minZoom = overflows ? 0.7 : 1;
  L.maxZoom = overflows ? 1.6 : 1;
  L.zoom = Math.max(L.minZoom, Math.min(L.maxZoom, L.zoom || 1));
  applyZoomPan(winW, bandTop, bandBottom, cols, rows);
}

// Recompute tile size (base × zoom), origin (grid centred in the band), and pan
// bounds, then clamp the current pan into them. Called on layout and whenever
// the zoom changes, so the view stays consistent and never scrolls fully away.
export function applyZoomPan(winW, bandTop, bandBottom, cols, rows) {
  const tw = L.baseTw * L.zoom;
  L.tw = tw;
  L.th = tw * 0.5;
  L.unit = tw / 42; // 42 ~ the old phone tile size

  const bandCenter = (bandTop + bandBottom) / 2;
  L.oy = bandCenter - ((cols + rows - 2) / 2) * L.th;
  L.ox = winW / 2 - ((cols - rows) / 2) * L.tw;

  // True grid bounding box ((cols+rows)*tw already includes a tile half-extent
  // each side). Pan range is half the overflow, plus a tile of breathing room so
  // edge tiles aren't jammed against the screen edge — but ONLY when it overflows.
  const gridW = (cols + rows) * L.tw;
  const gridH = (cols + rows) * L.th;
  const bandH = bandBottom - bandTop;
  L.panX = gridW > winW ? (gridW - winW) / 2 + L.tw : 0;
  L.panY = gridH > bandH ? (gridH - bandH) / 2 + L.th : 0;
  L.canPan = L.panX > 1 || L.panY > 1;

  if (!L.canPan) { L.camX = 0; L.camY = 0; }
  else { L.camX = clamp(L.camX, -L.panX, L.panX); L.camY = clamp(L.camY, -L.panY, L.panY); }
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// Re-clamp the current pan into bounds (after a drag nudges camX/camY).
export function clampCam() {
  L.camX = clamp(L.camX, -L.panX, L.panX);
  L.camY = clamp(L.camY, -L.panY, L.panY);
}
