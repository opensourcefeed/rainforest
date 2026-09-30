// Draws the world in design-unit coordinates. The caller sets the canvas
// transform so (0,0)..(DESIGN.w,DESIGN.h) maps to the fitted play field.
import { DESIGN, HORIZON, CONTROL_BAND } from './config.js';
import { plotRect } from './state.js';
import { avgMeter, unlockCost, STAGES, TYPE_BY_ID, PLANT_TYPES } from './game.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

const lerpArr = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const rgb = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;

// Scene palette per stage (aligned to STAGES): sky and ground gradients that
// carry the world from bare desert to lush rainforest.
const PALETTES = [
  { skyTop: [143, 183, 214], skyBot: [231, 214, 168], grTop: [217, 181, 121], grBot: [184, 137, 77] }, // desert
  { skyTop: [150, 190, 205], skyBot: [214, 210, 175], grTop: [178, 176, 112], grBot: [140, 140, 80] }, // scrubland
  { skyTop: [140, 190, 210], skyBot: [200, 216, 182], grTop: [122, 165, 82], grBot: [86, 120, 56] },   // grassland
  { skyTop: [128, 186, 206], skyBot: [186, 210, 182], grTop: [92, 142, 68], grBot: [60, 100, 48] },     // dry woodland
  { skyTop: [120, 180, 200], skyBot: [172, 206, 186], grTop: [58, 120, 58], grBot: [36, 86, 42] },      // rainforest
];

// Interpolated scene colors for the current environment average.
function sceneColors(avg) {
  let i = 0;
  while (i < STAGES.length - 1 && avg >= STAGES[i + 1].min) i++;
  const hi = Math.min(i + 1, STAGES.length - 1);
  const span = STAGES[hi].min - STAGES[i].min || 1;
  const t = Math.max(0, Math.min(1, (avg - STAGES[i].min) / span));
  const A = PALETTES[i], B = PALETTES[hi];
  return {
    skyTop: lerpArr(A.skyTop, B.skyTop, t),
    skyBot: lerpArr(A.skyBot, B.skyBot, t),
    grTop: lerpArr(A.grTop, B.grTop, t),
    grBot: lerpArr(A.grBot, B.grBot, t),
  };
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
  const avg = avgMeter(state); // 0 desert .. 1 rainforest
  const col = sceneColors(avg);

  // Sky
  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
  sky.addColorStop(0, rgb(col.skyTop));
  sky.addColorStop(1, rgb(col.skyBot));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, HORIZON);

  // Sun — bright over the desert, dimming as the canopy/humidity build.
  ctx.globalAlpha = 1 - 0.6 * avg;
  ctx.fillStyle = '#fff4d6';
  ctx.beginPath();
  ctx.arc(w * 0.74, h * 0.16, 42, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Ground
  const sand = ctx.createLinearGradient(0, HORIZON, 0, h);
  sand.addColorStop(0, rgb(col.grTop));
  sand.addColorStop(1, rgb(col.grBot));
  ctx.fillStyle = sand;
  ctx.fillRect(0, HORIZON, w, h - HORIZON);

  // Vegetation creeping across the ground as the land heals.
  drawTufts(ctx, avg);

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

  // settling (slightly translucent) or alive. Alive plants scale with growth
  // and their type: a hardy sprout vs a big canopy tree.
  const type = TYPE_BY_ID[plant.typeId] || PLANT_TYPES[0];
  const growth = plant.growth || 0;
  const scale = plant.status === 'settling' ? 0.5 : 0.45 + 0.55 * growth;
  const h = Math.min(r.h * 0.55 * scale * type.size, r.h * 1.6); // may overflow upward
  const leafR = (4 + 5 * (plant.status === 'settling' ? 0 : growth)) * (0.7 + 0.3 * type.size);

  ctx.globalAlpha = plant.status === 'settling' ? 0.6 : 1;
  ctx.strokeStyle = type.color;
  ctx.lineWidth = 2 + type.size;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, baseY);
  ctx.lineTo(cx, baseY - h);
  ctx.stroke();

  ctx.fillStyle = type.color;
  // Base pair of leaves.
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + dir * leafR * 0.8, baseY - h * 0.7, leafR, leafR * 0.6, dir * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // A canopy blob appears as the plant matures (bigger for higher tiers).
  if (growth > 0.4 && plant.status === 'alive') {
    ctx.beginPath();
    ctx.arc(cx, baseY - h, leafR * 1.4 * growth * type.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
