// Adaptive layout + a single world camera. The whole scene — backdrop AND the
// iso grid — is authored in one "base" coordinate space (the zoom-1 layout, in
// screen px) and drawn through one camera transform, so EVERYTHING zooms and
// pans together, not just the play field.
//
// Base layout fits the whole grid into the ground band at zoom 1 (so the
// window-sized backdrop always covers the screen when the camera scales up).
// The player zooms IN from there to tap comfortably on big grids, and pans.
// Grids that already fit comfortably lock at zoom 1 (camera = identity), which
// reproduces the original behaviour exactly.
import { CONTROL_BAND } from './config.js';
import { activeDims } from './world.js';

export const L = {
  w: 0, h: 0,           // viewport CSS px
  dpr: 1,               // device pixel ratio (for crisp offscreen caches)
  unit: 1,              // UI scale relative to a phone baseline (fonts, strokes)
  horizonY: 0,          // sky/ground boundary, screen px (base space)
  groundBottom: 0,      // bottom of the ground (= h)
  reserve: CONTROL_BAND, // px reserved at the bottom for the HUD controls
  tw: 40, th: 20,       // iso tile half-width / half-height (BASE, zoom-independent)
  ox: 0, oy: 0,         // iso grid origin (grid-centred in the ground band, base space)
  // --- Camera --- One affine transform maps base space to the screen:
  //   screen = base * zoom + (camX, camY)        (see applyCamera()).
  // zoom === 1 and cam === 0 is the identity (grids that fit never leave it).
  camX: 0, camY: 0,     // translation, screen px
  canPan: false,        // true only when zoomed in enough to overflow the screen
  zoom: 1,              // camera scale (>= 1; 1 shows the whole grid)
  minZoom: 1, maxZoom: 1,
};

// Tile size (px) at which tapping is comfortable; big grids can be zoomed in
// until their tiles reach roughly this, small grids are already at/above it.
const COMFORT_TW = 46;

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// Recompute the base layout for the current viewport and measured control
// reserve (px): tile size that fits the WHOLE grid, grid origin, and the zoom
// range. Then re-centre and clamp the camera.
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

  // Fit the whole iso footprint (width (cols+rows)*tw, height (cols+rows)*th,
  // th = tw/2) into the available ground area at zoom 1 — even if that makes
  // tiles small on big grids; the player zooms in to tap. Capped so small grids
  // don't get comically large tiles.
  const fitTw = Math.min(availW / (cols + rows), availH / ((cols + rows) * 0.5));
  L.tw = Math.min(fitTw, 58);
  L.th = L.tw * 0.5;
  L.unit = L.tw / 42; // 42 ~ the original phone tile size

  // Grid origin: centre the footprint in the ground band (base space).
  const bandCenter = (bandTop + bandBottom) / 2;
  L.oy = bandCenter - ((cols + rows - 2) / 2) * L.th;
  L.ox = winW / 2 - ((cols - rows) / 2) * L.tw;

  // Zoom range: zoom IN only (never below the full-fit view). Allow enough to
  // bring small tiles up to a comfortable tap size; grids already comfortable
  // lock at zoom 1.
  L.minZoom = 1;
  L.maxZoom = clamp(COMFORT_TW / L.tw, 1, 3);
  L.zoom = clamp(L.zoom || 1, L.minZoom, L.maxZoom);

  // Re-centre the camera for the current zoom, then clamp (resets pan on resize).
  L.camX = -(L.zoom - 1) * L.w / 2;
  L.camY = -(L.zoom - 1) * L.h / 2;
  clampCam();
}

// Apply the camera to a 2D context (call inside save()/restore()). The context
// already carries the DPR base transform; this layers the world camera on top.
export function applyCamera(ctx) {
  ctx.translate(L.camX, L.camY);
  ctx.scale(L.zoom, L.zoom);
}

// Set the zoom while keeping a focal screen point fixed under the finger / tap,
// then clamp. Used by pinch and double-tap.
export function setZoom(z, focalX = L.w / 2, focalY = L.h / 2) {
  z = clamp(z, L.minZoom, L.maxZoom);
  // Base point currently under the focal, kept fixed across the zoom change.
  const bx = (focalX - L.camX) / L.zoom;
  const by = (focalY - L.camY) / L.zoom;
  L.zoom = z;
  L.camX = focalX - z * bx;
  L.camY = focalY - z * by;
  clampCam();
}

// Clamp the camera so the window-sized backdrop always covers the screen (and,
// because the grid is centred within and no larger than that backdrop, every
// tile stays reachable). canPan is true only when there's slack to move.
export function clampCam() {
  const overX = (L.zoom - 1) * L.w;
  const overY = (L.zoom - 1) * L.h;
  L.camX = clamp(L.camX, -overX, 0);
  L.camY = clamp(L.camY, -overY, 0);
  L.canPan = overX > 1 || overY > 1;
}
