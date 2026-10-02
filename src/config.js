// Shared constants. All rendering and hit-testing use these "design" units;
// the canvas is scaled to fit the real screen (see main.js layout()).
export const DESIGN = { w: 450, h: 975 }; // ~9:19.5 portrait
export const MAX_DPR = 3; // cap so cheap high-DPI phones don't over-render

export const HORIZON = DESIGN.h * 0.46; // sky/sand boundary (more ground for the grid)

// How many plots start unlocked; the rest are bought with water.
export const STARTER_PLOTS = 4;

// Reserved band (design units) at the bottom of the play field for the HUD
// controls, so DOM buttons never overlap the grid. Sized generously because the
// buttons are a fixed CSS-pixel height that maps to more design units on small
// screens (see main.js scale).
export const CONTROL_BAND = 120;

// Isometric tile half-width / half-height (2:1 diamond). Screen position of a
// tile is (ox + (col-row)*tw, oy + (col+row)*th).
export const ISO = { tw: 42, th: 21 };

// Planting grid, laid out in the sand region below the horizon and above the
// control band.
export const GRID = {
  cols: 4,
  rows: 5,
  padTop: 28, // gap below horizon before the first row
  padBottom: CONTROL_BAND, // keep plots clear of the bottom control band
  gutter: 14, // space between plots
  sideMargin: 24, // left/right margin of the whole grid
};

// Real Grove data (real trees planted by the developer). Published next to the
// game, so it can be updated without an app release. For the Android build,
// switch to the absolute URL of the published file.
export const GROVE_URL = 'grove.json';
