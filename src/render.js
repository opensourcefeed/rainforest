// Draws the world in design-unit coordinates. The caller sets the canvas
// transform so (0,0)..(DESIGN.w,DESIGN.h) maps to the fitted play field.
import { DESIGN, HORIZON, CONTROL_BAND } from './config.js';
import { plotRect, getBottomReserve } from './state.js';
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
  for (let i = 0; i < 90; i++) {
    out.push({
      x: rnd() * DESIGN.w,
      y: HORIZON + 6 + rnd() * (bandTop - HORIZON - 6),
      s: 5 + rnd() * 5,
      hue: 96 + rnd() * 24,
      threshold: rnd() * 0.8, // this tuft appears once the land greens past here
    });
  }
  // Draw far tufts (higher on screen) first so nearer ones overlap them.
  return out.sort((a, b) => a.y - b.y);
})();

function drawTufts(ctx, g) {
  for (const t of TUFTS) {
    if (g <= t.threshold) continue;
    // Fade each tuft in over the next slice of greening after its threshold.
    const a = Math.min(1, (g - t.threshold) / 0.15);
    ctx.globalAlpha = a * 0.85;
    // A soft filled clump of blades reads as grass rather than a stray speck.
    ctx.fillStyle = `hsl(${t.hue},45%,38%)`;
    const scale = 0.6 + 0.4 * a;
    for (const dx of [-3, 0, 3]) {
      const h = t.s * scale * (dx === 0 ? 1 : 0.8);
      ctx.beginPath();
      ctx.moveTo(t.x + dx - 1.4, t.y);
      ctx.quadraticCurveTo(t.x + dx + dx * 0.5, t.y - h * 0.7, t.x + dx * 1.5, t.y - h);
      ctx.quadraticCurveTo(t.x + dx + dx * 0.5, t.y - h * 0.7, t.x + dx + 1.4, t.y);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// The lone man — a simple recognizable figure planting in the desert.
function drawFigure(ctx, x, feetY, s = 1) {
  const hipY = feetY - 13 * s;
  const shoulderY = feetY - 26 * s;
  const headY = feetY - 31 * s;

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Legs
  ctx.strokeStyle = '#3f3320';
  ctx.lineWidth = 2.6 * s;
  ctx.beginPath();
  ctx.moveTo(x, hipY); ctx.lineTo(x - 3.2 * s, feetY);
  ctx.moveTo(x, hipY); ctx.lineTo(x + 3.2 * s, feetY);
  ctx.stroke();

  // Torso
  ctx.strokeStyle = '#7a5230';
  ctx.lineWidth = 3.4 * s;
  ctx.beginPath();
  ctx.moveTo(x, hipY); ctx.lineTo(x, shoulderY);
  ctx.stroke();

  // Arms — one down toward the ground (planting), one holding a watering can.
  ctx.strokeStyle = '#7a5230';
  ctx.lineWidth = 2.2 * s;
  ctx.beginPath();
  ctx.moveTo(x, shoulderY + 2 * s); ctx.lineTo(x - 6 * s, shoulderY + 9 * s); // reaching down
  ctx.moveTo(x, shoulderY + 2 * s); ctx.lineTo(x + 6 * s, shoulderY + 6 * s); // out to the can
  ctx.stroke();

  // Watering can in the raised hand
  ctx.fillStyle = '#6f7d86';
  ctx.fillRect(x + 5 * s, shoulderY + 4 * s, 6 * s, 5 * s);
  ctx.strokeStyle = '#6f7d86';
  ctx.lineWidth = 1.4 * s;
  ctx.beginPath();
  ctx.moveTo(x + 11 * s, shoulderY + 5 * s); ctx.lineTo(x + 14 * s, shoulderY + 3 * s); // spout
  ctx.stroke();

  // Head
  ctx.fillStyle = '#caa06a';
  ctx.beginPath();
  ctx.arc(x, headY, 3.6 * s, 0, Math.PI * 2);
  ctx.fill();
}

// Full-window backdrop: the current stage's sky/ground gradients, slightly
// darkened so they recede behind the play field, with the horizon aligned to the
// play field's horizon (horizonY is in the backdrop's CSS-pixel space).
export function renderBackdrop(ctx, state, w, h, horizonY, fieldBottom = h, now = 0) {
  const col = sceneColors(avgMeter(state));
  const cs = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
  const hy = Math.max(0, Math.min(h, horizonY));
  // Match the play field's gradients exactly (same colors, same vertical extent
  // as the field's sky/ground) so there is no seam — the world reads as one.
  const groundBottom = Math.max(hy + 1, fieldBottom);

  ctx.clearRect(0, 0, w, h);
  if (hy > 0) {
    const sky = ctx.createLinearGradient(0, 0, 0, hy);
    sky.addColorStop(0, cs(col.skyTop));
    sky.addColorStop(1, cs(col.skyBot));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, hy);
  }
  // Ground gradient spans horizon..fieldBottom to line up with the play field;
  // fill any remaining space below with the bottom colour.
  const gnd = ctx.createLinearGradient(0, hy, 0, groundBottom);
  gnd.addColorStop(0, cs(col.grTop));
  gnd.addColorStop(1, cs(col.grBot));
  ctx.fillStyle = gnd;
  ctx.fillRect(0, hy, w, h - hy);

  // Rain across the extended scene too, so the storm is continuous.
  if (state.rain && state.rain.active) {
    ctx.fillStyle = 'rgba(40, 55, 70, 0.14)';
    ctx.fillRect(0, 0, w, h);
    drawRain(ctx, w, h, now / 1000);
  }
}

export function renderScene(ctx, state, now = 0) {
  const { w, h } = DESIGN;
  const time = now / 1000;
  const avg = avgMeter(state); // 0 desert .. 1 rainforest
  const col = sceneColors(avg);

  // Sky
  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
  sky.addColorStop(0, rgb(col.skyTop));
  sky.addColorStop(1, rgb(col.skyBot));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, HORIZON);

  // Sun — bright over the desert, dimming as the canopy/humidity build, with a
  // gentle breathing pulse and a soft halo.
  const sunX = w * 0.74, sunY = h * 0.16;
  const sunA = 1 - 0.6 * avg;
  const pulse = 1 + 0.05 * Math.sin(time * 1.4);
  const rCore = 42 * pulse;
  const halo = ctx.createRadialGradient(sunX, sunY, rCore * 0.5, sunX, sunY, rCore * 2.1);
  halo.addColorStop(0, `rgba(255,244,214,${0.5 * sunA})`);
  halo.addColorStop(1, 'rgba(255,244,214,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(sunX, sunY, rCore * 2.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = sunA;
  ctx.fillStyle = '#fff4d6';
  ctx.beginPath();
  ctx.arc(sunX, sunY, rCore, 0, Math.PI * 2);
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

  // Wildlife returns as the land recovers (fades in past each threshold).
  drawCritters(ctx, avg, time);

  // The lone man, standing on the horizon just left of centre.
  drawFigure(ctx, w * 0.42, HORIZON, 1.15);

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
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillText(`+${nextUnlock}💧`, cx, r.y + r.h / 2);
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

  // Rain event — clouds, streaks and a mood darken over the whole scene.
  if (state.rain && state.rain.active) {
    ctx.fillStyle = 'rgba(40, 55, 70, 0.14)';
    ctx.fillRect(0, 0, w, h);
    drawClouds(ctx, w, time);
    drawRain(ctx, w, h, time);
  }

  // Bottom control band — a subtle darkening so the HUD buttons have a footing
  // and read as chrome rather than floating over the grid. Height matches the
  // dynamically-measured control reserve.
  const bandH = getBottomReserve();
  const bandTop = h - bandH;
  const band = ctx.createLinearGradient(0, bandTop, 0, h);
  band.addColorStop(0, 'rgba(0,0,0,0)');
  band.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = band;
  ctx.fillRect(0, bandTop, w, bandH);
}

// Animated rain streaks falling across a region.
function drawRain(ctx, w, h, time, topY = 0) {
  ctx.strokeStyle = 'rgba(185, 208, 228, 0.5)';
  ctx.lineWidth = 1.3;
  const N = 70, speed = 720, span = h - topY + 30;
  for (let i = 0; i < N; i++) {
    const x = (i * 89.3) % w;
    const y = topY + ((i * 57 + time * speed) % span);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 4, y + 11);
    ctx.stroke();
  }
}

// Soft grey rain clouds drifting across the upper sky.
function drawClouds(ctx, w, time) {
  ctx.fillStyle = 'rgba(96, 106, 116, 0.55)';
  for (const [fx, cw, cy] of [[0.2, 58, 58], [0.55, 84, 44], [0.82, 48, 74]]) {
    const x = ((fx * w + time * 11) % (w + 140)) - 70;
    ctx.beginPath(); ctx.ellipse(x, cy, cw, cw * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + cw * 0.6, cy + 6, cw * 0.7, cw * 0.4, 0, 0, Math.PI * 2); ctx.fill();
  }
}

// Wildlife that returns as milestones are passed — a living, animated reward.
const CRITTERS = [
  { emoji: '🦋', at: 0.42, x: 0.24, y: 0.42, motion: 'flutter', phase: 0.0, speed: 0 },
  { emoji: '🐦', at: 0.5, x: 0.68, y: 0.30, motion: 'fly', phase: 1.1, speed: 26 },
  { emoji: '🦋', at: 0.6, x: 0.8, y: 0.5, motion: 'flutter', phase: 2.3, speed: 0 },
  { emoji: '🦌', at: 0.72, x: 0.34, y: 0.59, motion: 'bob', phase: 0.7, speed: 0 },
  { emoji: '🐒', at: 0.88, x: 0.6, y: 0.5, motion: 'bob', phase: 1.8, speed: 0 },
];
function drawCritters(ctx, avg, time) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '18px system-ui, sans-serif';
  for (const c of CRITTERS) {
    if (avg <= c.at) continue;
    let x = DESIGN.w * c.x;
    let y = DESIGN.h * c.y;
    if (c.motion === 'flutter') {
      x += Math.sin(time * 3 + c.phase) * 11;
      y += Math.sin(time * 5 + c.phase) * 7;
    } else if (c.motion === 'fly') {
      x = ((DESIGN.w * c.x + time * c.speed) % (DESIGN.w + 40)) - 20; // drift + wrap
      y += Math.sin(time * 2 + c.phase) * 6;
    } else {
      y += Math.sin(time * 1.6 + c.phase) * 3; // gentle bob
    }
    ctx.globalAlpha = Math.min(1, (avg - c.at) / 0.08);
    ctx.fillText(c.emoji, x, y);
  }
  ctx.globalAlpha = 1;
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

function fillRound(ctx, x, y, w, h, rad) {
  roundRect(ctx, x, y, w, h, rad);
  ctx.fill();
}
function disc(ctx, x, y, rad) {
  ctx.beginPath();
  ctx.arc(x, y, rad, 0, Math.PI * 2);
  ctx.fill();
}

// Per-type silhouettes. Each gets (ctx, cx, baseY, size, color) where `size`
// is the drawn height in px (already scaled by growth), and draws upward from
// baseY (the soil). Kept simple but distinct.
const SHAPES = {
  seed(ctx, cx, baseY, s, color) {
    ctx.strokeStyle = color; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, baseY); ctx.lineTo(cx, baseY - s); ctx.stroke();
    ctx.fillStyle = color;
    for (const d of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + d * 5, baseY - s * 0.7, 5, 3, d * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  cactus(ctx, cx, baseY, s, color) {
    const w = Math.max(6, s * 0.26);
    ctx.fillStyle = color;
    fillRound(ctx, cx - w / 2, baseY - s, w, s, w / 2); // trunk
    // two arms
    const armW = w * 0.7, armY = baseY - s * 0.55;
    fillRound(ctx, cx - w * 1.3, armY - s * 0.18, armW, s * 0.4, armW / 2);
    fillRound(ctx, cx - w * 1.3, armY, w * 1.1, armW, armW / 2);
    fillRound(ctx, cx + w * 0.6, armY - s * 0.3, armW, s * 0.42, armW / 2);
    fillRound(ctx, cx + w * 0.2, armY, w * 1.1, armW, armW / 2);
  },
  shrub(ctx, cx, baseY, s, color) {
    const rad = s * 0.5;
    ctx.fillStyle = color;
    disc(ctx, cx - rad * 0.75, baseY - rad * 0.7, rad * 0.72);
    disc(ctx, cx + rad * 0.75, baseY - rad * 0.7, rad * 0.72);
    disc(ctx, cx, baseY - rad * 1.1, rad * 0.85);
    disc(ctx, cx, baseY - rad * 0.6, rad * 0.8);
  },
  tree(ctx, cx, baseY, s, color) {
    const trunkH = s * 0.42;
    ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = Math.max(2.5, s * 0.12); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, baseY); ctx.lineTo(cx, baseY - trunkH); ctx.stroke();
    const cr = (s - trunkH) * 0.62;
    ctx.fillStyle = color;
    disc(ctx, cx, baseY - trunkH - cr * 0.7, cr);
  },
  canopy(ctx, cx, baseY, s, color) {
    const trunkH = s * 0.45;
    ctx.strokeStyle = '#5a3b22'; ctx.lineWidth = Math.max(3, s * 0.14); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, baseY); ctx.lineTo(cx, baseY - trunkH); ctx.stroke();
    const cr = (s - trunkH) * 0.5;
    ctx.fillStyle = color;
    disc(ctx, cx - cr * 0.7, baseY - trunkH - cr * 0.6, cr * 0.9);
    disc(ctx, cx + cr * 0.7, baseY - trunkH - cr * 0.6, cr * 0.9);
    disc(ctx, cx, baseY - trunkH - cr * 1.25, cr * 1.05);
  },
};

// Draw a plant in its plot, by type and lifecycle state.
function drawPlant(ctx, r, plant) {
  const cx = r.x + r.w / 2;
  const baseY = r.y + r.h * 0.9;

  if (plant.status === 'dead') {
    // Withered: drooped brown stem, no leaves.
    ctx.strokeStyle = '#7a5a34';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, baseY);
    ctx.quadraticCurveTo(cx + 3, baseY - r.h * 0.2, cx + 9, baseY - r.h * 0.16);
    ctx.stroke();
    return;
  }

  const type = TYPE_BY_ID[plant.typeId] || PLANT_TYPES[0];
  const growth = plant.status === 'settling' ? 0.25 : 0.4 + 0.6 * (plant.growth || 0);
  // Height in px, scaled by growth and tier size; may overflow the cell upward.
  const s = Math.min(r.h * 0.6 * growth * type.size, r.h * 1.7);

  ctx.globalAlpha = plant.status === 'settling' ? 0.6 : 1;
  (SHAPES[type.id] || SHAPES.seed)(ctx, cx, baseY, s, type.color);
  ctx.globalAlpha = 1;
}
