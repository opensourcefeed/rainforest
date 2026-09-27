// Shared constants. All rendering and hit-testing use these "design" units;
// the canvas is scaled to fit the real screen (see main.js layout()).
export const DESIGN = { w: 450, h: 975 }; // ~9:19.5 portrait
export const MAX_DPR = 3; // cap so cheap high-DPI phones don't over-render

export const HORIZON = DESIGN.h * 0.62; // sky/sand boundary

// Planting grid, laid out in the sand region below the horizon.
export const GRID = {
  cols: 4,
  rows: 5,
  padTop: 40, // gap below horizon before the first row
  padBottom: 28, // gap above the bottom edge
  gutter: 14, // space between plots
  sideMargin: 24, // left/right margin of the whole grid
};
