// Draws the world in design-unit coordinates. The caller sets the canvas
// transform so (0,0)..(DESIGN.w,DESIGN.h) maps to the fitted play field.
import { DESIGN, HORIZON, CONTROL_BAND } from './config.js';
import { plotRect } from './state.js';
import { greening, unlockCost } from './game.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// Linear interpolation between two [r,g,b] colors -> css string.
function mix(a, b, t) {
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

// Deterministic scatter of ground vegetation that fades in as the land greens,
// so the world visibly changes (not just a color tint). Computed once with a
// tiny seeded RNG so tufts never flicker or move between frames.
const TUFTS = (() => {
  let seed = 1337;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const bandTop = DESIGN.h - CONTROL_BAND;
  const out = [];
  for (let i = 0; i < 44; i++) {
    out.push({
      x: rnd() * DESIGN.w,
      y: HORIZON + 6 + rnd() * (bandTop - HORIZON - 6),
      s: 4 + rnd() * 5,
      threshold: rnd(), // this tuft appears once greening passes here
    });
  }
  return out;
})();

function drawTufts(ctx, g) {
  for (const t of TUFTS) {
    if (g <= t.threshold) continue;
    // Fade each tuft in over the 0.2 of greening after its threshold.
    const a = Math.min(1, (g - t.threshold) / 0.2);
    ctx.globalAlpha = a * 0.9;
    ctx.strokeStyle = '#3f7a2e';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    for (const dx of [-2.5, 0, 2.5]) {
      ctx.beginPath();
      ctx.moveTo(t.x + dx, t.y);
      ctx.quadraticCurveTo(t.x + dx + dx * 0.4, t.y - t.s * 0.7, t.x + dx * 1.6, t.y - t.s);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

export function renderScene(ctx, state) {
  const { w, h } = DESIGN;
  const g = greening(state); // 0 desert .. 1 scrubland

  // Sky — hazy desert warms into a cooler, fresher scrubland sky.
  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
  sky.addColorStop(0, mix([143, 183, 214], [120, 175, 210], g));
  sky.addColorStop(1, mix([231, 214, 168], [200, 214, 178], g));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, HORIZON);

  // Sun
  ctx.fillStyle = '#fff4d6';
  ctx.beginPath();
  ctx.arc(w * 0.74, h * 0.16, 42, 0, Math.PI * 2);
  ctx.fill();

  // Ground — bare sand greens toward scrub soil as the environment recovers.
  const sand = ctx.createLinearGradient(0, HORIZON, 0, h);
  sand.addColorStop(0, mix([217, 181, 121], [122, 156, 74], g));
  sand.addColorStop(1, mix([184, 137, 77], [92, 116, 56], g));
  ctx.fillStyle = sand;
  ctx.fillRect(0, HORIZON, w, h - HORIZON);

  // Vegetation creeping across the ground as the land heals.
  drawTufts(ctx, g);

  // Lone figure (placeholder)
  ctx.fillStyle = '#4a3a24';
  ctx.fillRect(w * 0.5 - 4, HORIZON - 26, 8, 26);
  ctx.beginPath();
  ctx.arc(w * 0.5, HORIZON - 32, 7, 0, Math.PI * 2);
  ctx.fill();

  // Planting plots
  const nextUnlock = unlockCost(state);
  for (const p of state.plots) {
    const r = plotRect(p.col, p.row);

    if (!p.unlocked) {
      // Locked desert: dim, dashed, with a buy price.
      ctx.fillStyle = 'rgba(28, 20, 8, 0.32)';
      roundRect(ctx, r.x, r.y, r.w, r.h, 6);
      ctx.fill();
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.lineWidth = 1.3;
      roundRect(ctx, r.x, r.y, r.w, r.h, 6);
      ctx.stroke();
      ctx.setLineDash([]);
      const cx = r.x + r.w / 2;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillText('+', cx, r.y + r.h * 0.38);
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillText(`${nextUnlock}💧`, cx, r.y + r.h * 0.68);
      continue;
    }

    ctx.fillStyle = p.planted ? 'rgba(60, 45, 22, 0.30)' : 'rgba(90, 62, 30, 0.18)';
    ctx.strokeStyle = 'rgba(74, 58, 36, 0.55)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, r.x, r.y, r.w, r.h, 6);
    ctx.fill();
    ctx.stroke();
    if (p.plant) drawPlant(ctx, r, p.plant);
  }

  // Transient feedback effects, on top of the plants.
  drawFx(ctx, state);

  // Bottom control band — a subtle darkening so the HUD buttons have a footing
  // and read as chrome rather than floating over the grid.
  const bandTop = h - CONTROL_BAND;
  const band = ctx.createLinearGradient(0, bandTop, 0, h);
  band.addColorStop(0, 'rgba(0,0,0,0)');
  band.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = band;
  ctx.fillRect(0, bandTop, w, CONTROL_BAND);
}

// Draw transient feedback effects (survival %, survive/die pops).
function drawFx(ctx, state) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const fx of state.fx) {
    const r = plotRect(fx.col, fx.row);
    const cx = r.x + r.w / 2;
    const t = fx.age / fx.ttl; // 0..1
    const alpha = 1 - t;

    if (fx.kind === 'chance') {
      // Odds float up from the plot and fade.
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.fillText(fx.text, cx, r.y - 6 - t * 16);
    } else if (fx.kind === 'survive') {
      // Expanding green ring + check.
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#5fd15a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, r.y + r.h / 2, 6 + t * (r.w * 0.5), 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#5fd15a';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillText('✓', cx, r.y - 4 - t * 14);
    } else if (fx.kind === 'die') {
      // Red-brown cross drifting up and fading.
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#c65a3a';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillText('✕', cx, r.y - 4 - t * 14);
    } else if (fx.kind === 'unlock') {
      // Spent-water amount floats up in green.
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#7fe07a';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.fillText(fx.text, cx, r.y + r.h / 2 - t * 18);
    } else if (fx.kind === 'need') {
      // Can't afford — cost shown in red, held roughly in place.
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ef7a5a';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.fillText(fx.text, cx, r.y + r.h / 2 - t * 8);
    }
  }
  ctx.globalAlpha = 1;
}

// A small sprout centered in the plot, drawn per lifecycle state.
function drawPlant(ctx, r, plant) {
  const cx = r.x + r.w / 2;
  const baseY = r.y + r.h * 0.72;
  const stemH = r.h * 0.28;

  if (plant.status === 'dead') {
    // Withered: drooped brown stem, no leaves.
    ctx.strokeStyle = '#7a5a34';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, baseY);
    ctx.quadraticCurveTo(cx + 3, baseY - stemH * 0.6, cx + 8, baseY - stemH * 0.5);
    ctx.stroke();
    return;
  }

  // settling (slightly translucent) or alive (full green). Alive plants scale
  // with growth: a seedling grows into a fuller plant.
  const growth = plant.growth || 0;
  const scale = plant.status === 'settling' ? 0.5 : 0.45 + 0.55 * growth;
  const h = (r.h * 0.55) * scale;
  const leafR = 4 + 5 * (plant.status === 'settling' ? 0 : growth);

  ctx.globalAlpha = plant.status === 'settling' ? 0.6 : 1;
  ctx.strokeStyle = '#3f8f3a';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, baseY);
  ctx.lineTo(cx, baseY - h);
  ctx.stroke();

  ctx.fillStyle = '#4faf47';
  // Base pair of leaves.
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + dir * leafR * 0.8, baseY - h * 0.7, leafR, leafR * 0.6, dir * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // A canopy blob appears as the plant matures.
  if (growth > 0.5 && plant.status === 'alive') {
    ctx.beginPath();
    ctx.arc(cx, baseY - h, leafR * 1.4 * growth, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
