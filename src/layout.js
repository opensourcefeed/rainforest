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
  tw: 40, th: 20,       // iso tile half-width / half-height
  ox: 0, oy: 0,         // iso grid origin
};

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
  // into the available ground area, then clamp so it's neither tiny nor huge.
  let tw = Math.min(availW / (cols + rows), availH / ((cols + rows) * 0.5));
  tw = Math.max(22, Math.min(tw, 58));
  L.tw = tw;
  L.th = tw * 0.5;
  L.unit = tw / 42; // 42 ~ the old phone tile size

  const bandCenter = (bandTop + bandBottom) / 2;
  L.oy = bandCenter - ((cols + rows - 2) / 2) * L.th;
  L.ox = winW / 2 - ((cols - rows) / 2) * L.tw;
}
