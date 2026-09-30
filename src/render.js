// Draws the world in design-unit coordinates. The caller sets the canvas
// Draws the world in screen pixels using the adaptive layout (see layout.js).
import { GRID } from './config.js';
import { tileCenter, plantHeight } from './state.js';
import { L } from './layout.js';
import { avgMeter, unlockCost, STAGES, TYPE_BY_ID, PLANT_TYPES } from './game.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// Isometric diamond path centered at (cx,cy) with half-width tw, half-height th.
function diamond(ctx, cx, cy, tw, th) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - th);
  ctx.lineTo(cx + tw, cy);
  ctx.lineTo(cx, cy + th);
  ctx.lineTo(cx - tw, cy);
  ctx.closePath();
}

// A raised isometric soil block: two side faces + a top diamond.
function tileBlock(ctx, cx, cy, tw, th, depth, topC, leftC, rightC) {
  // Left face
  ctx.beginPath();
  ctx.moveTo(cx - tw, cy); ctx.lineTo(cx, cy + th);
  ctx.lineTo(cx, cy + th + depth); ctx.lineTo(cx - tw, cy + depth); ctx.closePath();
  ctx.fillStyle = leftC; ctx.fill();
  // Right face
  ctx.beginPath();
  ctx.moveTo(cx + tw, cy); ctx.lineTo(cx, cy + th);
  ctx.lineTo(cx, cy + th + depth); ctx.lineTo(cx + tw, cy + depth); ctx.closePath();
  ctx.fillStyle = rightC; ctx.fill();
  // Top
  diamond(ctx, cx, cy, tw, th);
  ctx.fillStyle = topC; ctx.fill();
  ctx.strokeStyle = 'rgba(40, 30, 16, 0.45)'; ctx.lineWidth = 1; ctx.stroke();
}

const lerpArr = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

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

// A soft filled clump of grass blades at (x,y).
function grassClump(ctx, x, y, s, hue, alpha) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = `hsl(${hue},45%,38%)`;
  for (const dx of [-3, 0, 3]) {
    const h = s * (dx === 0 ? 1 : 0.8);
    ctx.beginPath();
    ctx.moveTo(x + dx - 1.4, y);
    ctx.quadraticCurveTo(x + dx + dx * 0.5, y - h * 0.7, x + dx * 1.5, y - h);
    ctx.quadraticCurveTo(x + dx + dx * 0.5, y - h * 0.7, x + dx + 1.4, y);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Deterministic scatter of ground vegetation as window-relative fractions, so it
// fills the whole backdrop at any size. Sorted far-first so nearer clumps overlap.
const TUFTS = (() => {
  let seed = 1337;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const out = [];
  for (let i = 0; i < 170; i++) {
    out.push({
      fx: rnd(),                 // 0..1 across the window width
      fy: rnd(),                 // 0..1 down the ground band (horizon..bottom)
      s: 5 + rnd() * 6,
      hue: 96 + rnd() * 24,
      threshold: rnd() * 0.8,    // appears once the land greens past here
    });
  }
  return out.sort((a, b) => a.fy - b.fy);
})();

// Draw the grass across the full window (ground band = horizonY..h).
function drawTufts(ctx, w, horizonY, h, g) {
  const gb = h - horizonY;
  for (const t of TUFTS) {
    if (g <= t.threshold) continue;
    const a = Math.min(1, (g - t.threshold) / 0.15);
    grassClump(ctx, t.fx * w, horizonY + t.fy * gb, t.s * (0.6 + 0.4 * a), t.hue, a * 0.85);
  }
}

// The sun, with halo and gentle pulse, at (sx,sy). `dim` fades it (e.g. rain).
function drawSun(ctx, sx, sy, avg, time, dim = 1) {
  const sunA = (1 - 0.6 * avg) * dim;
  if (sunA <= 0.02) return;
  const rCore = 42 * (1 + 0.05 * Math.sin(time * 1.4));
  const halo = ctx.createRadialGradient(sx, sy, rCore * 0.5, sx, sy, rCore * 2.1);
  halo.addColorStop(0, `rgba(255,244,214,${0.5 * sunA})`);
  halo.addColorStop(1, 'rgba(255,244,214,0)');
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(sx, sy, rCore * 2.1, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = sunA;
  ctx.fillStyle = '#fff4d6';
  ctx.beginPath(); ctx.arc(sx, sy, rCore, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
}

// The lone man — a simple recognizable figure. `facing` -1 mirrors him.
function drawFigure(ctx, x, feetY, s = 1, facing = 1) {
  const hipY = feetY - 13 * s;
  const shoulderY = feetY - 26 * s;
  const headY = feetY - 31 * s;

  ctx.save();
  if (facing < 0) { ctx.translate(2 * x, 0); ctx.scale(-1, 1); }
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
  ctx.restore();
}

// Full-window backdrop: all decorative scenery — sky, sun, ground, grass,
// wildlife, clouds, rain — across the whole viewport (screen px, from L).
export function renderBackdrop(ctx, state, now = 0) {
  const { w, h, horizonY } = L;
  const col = sceneColors(avgMeter(state));
  const cs = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
  const hy = Math.max(0, Math.min(h, horizonY));
  const avg = avgMeter(state);
  const time = now / 1000;

  ctx.clearRect(0, 0, w, h);
  if (hy > 0) {
    const sky = ctx.createLinearGradient(0, 0, 0, hy);
    sky.addColorStop(0, cs(col.skyTop));
    sky.addColorStop(1, cs(col.skyBot));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, hy);
  }
  const gnd = ctx.createLinearGradient(0, hy, 0, h);
  gnd.addColorStop(0, cs(col.grTop));
  gnd.addColorStop(1, cs(col.grBot));
  ctx.fillStyle = gnd;
  ctx.fillRect(0, hy, w, h - hy);

  const rainI = (state.rain && state.rain.intensity) || 0;
  drawSun(ctx, w * 0.74, hy * 0.42, avg, time, 1 - 0.72 * rainI);
  drawTufts(ctx, w, hy, h, avg);
  drawCritters(ctx, w, hy, h, avg, time);

  // Clouds roll in and the light dims as the shower builds; both ease with
  // intensity so nothing pops on/off.
  if (rainI > 0.01) {
    drawClouds(ctx, w, hy, time, rainI);
    ctx.fillStyle = `rgba(38, 52, 66, ${0.24 * rainI})`;
    ctx.fillRect(0, 0, w, h);
    drawRain(ctx, w, h, time, 0, rainI);
  }
}

export function renderScene(ctx, state, now = 0, man = null) {
  const { w, h, tw, th, unit } = L;
  const time = now / 1000;
  const avg = avgMeter(state); // 0 desert .. 1 rainforest

  // Transparent play field — the full-window backdrop shows through. Only the
  // interactive isometric grid, its plants, the man and feedback live here.
  ctx.clearRect(0, 0, w, h);

  // Planting plots — isometric soil blocks, drawn back-to-front so nearer tiles
  // and taller plants overlap farther ones correctly. Tops green with progress.
  const depth = 6 * unit; // shallow raise; scales with tile size

  // Tile top derives from the SAME scene ground palette as the backdrop, lifted
  // slightly, so the platform reads as cultivated soil of the same land at every
  // stage instead of a differently-coloured slab.
  const top = sceneColors(avg).grTop.map((v) => Math.min(255, v + 16));
  const shade = (c, k) => `rgb(${(c[0] * k) | 0},${(c[1] * k) | 0},${(c[2] * k) | 0})`;
  const nextUnlock = unlockCost(state);
  const ordered = [...state.plots].sort((a, b) => (a.col + a.row) - (b.col + b.row));
  for (const p of ordered) {
    const c = tileCenter(p.col, p.row);

    if (!p.unlocked) {
      // Locked desert: a flat dim diamond with its buy price.
      diamond(ctx, c.x, c.y, tw, th);
      ctx.fillStyle = 'rgba(28, 20, 8, 0.34)';
      ctx.fill();
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.lineWidth = 1.3;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = `bold ${Math.round(12 * unit)}px system-ui, sans-serif`;
      ctx.fillText(`+${nextUnlock}💧`, c.x, c.y);
      continue;
    }

    const tc = p.planted ? shade(top, 0.9) : shade(top, 1.06);
    tileBlock(ctx, c.x, c.y, tw, th, depth, tc, shade(top, 0.55), shade(top, 0.72));
    if (p.plant) {
      drawPlant(ctx, c.x, c.y, p.plant);
    } else {
      // Empty, plantable: a subtle marker so open tiles stand out among plants.
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.beginPath();
      ctx.arc(c.x, c.y, Math.max(2, th * 0.18), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // The lone man in the foreground — at his live position, with a walk bob.
  if (man) {
    const bob = man.moving ? Math.abs(Math.sin(time * 14)) * 2 * unit : 0;
    drawFigure(ctx, man.x, man.y - bob, 1.3 * unit, man.facing);
  } else {
    const fl = tileCenter(0, GRID.rows - 1);
    drawFigure(ctx, fl.x - tw * 0.5, fl.y + th * 0.6, 1.3 * unit);
  }

  // Transient feedback effects, on top of the plants.
  drawFx(ctx, state);

  // Rain streaks over the platform (the backdrop rains on the wider scene).
  const rainI = (state.rain && state.rain.intensity) || 0;
  if (rainI > 0.01) drawRain(ctx, w, h, time, 0, rainI);

  // Bottom control band — a subtle darkening so the HUD buttons have a footing.
  const bandH = L.reserve;
  const bandTop = h - bandH;
  const band = ctx.createLinearGradient(0, bandTop, 0, h);
  band.addColorStop(0, 'rgba(0,0,0,0)');
  band.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = band;
  ctx.fillRect(0, bandTop, w, bandH);
}

// Animated rain streaks. Density + opacity scale with intensity (0..1) so the
// rain builds from a light drizzle to a downpour and back.
function drawRain(ctx, w, h, time, topY = 0, intensity = 1) {
  const full = Math.max(40, Math.min(560, Math.round((w * (h - topY)) / 4600)));
  const N = Math.round(full * intensity);
  if (N <= 0) return;
  ctx.strokeStyle = `rgba(190, 212, 232, ${0.5 * Math.min(1, 0.4 + intensity)})`;
  ctx.lineWidth = 1.4;
  const speed = 700 + 260 * intensity, span = h - topY + 30;
  const len = 9 + 6 * intensity;
  for (let i = 0; i < N; i++) {
    const x = (i * 89.3) % w;
    const y = topY + ((i * 57 + time * speed) % span);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - len * 0.35, y + len);
    ctx.stroke();
  }
}

// Cloud lobes (dx, dy, r). Bottom row wider/flatter, top rounded — a real
// cumulus silhouette.
const CLOUD_LOBES = [
  [-1.25, 0.28, 0.6], [-0.65, 0.3, 0.72], [0.0, 0.32, 0.78], [0.7, 0.3, 0.72], [1.3, 0.28, 0.58],
  [-0.8, -0.18, 0.72], [-0.1, -0.32, 0.9], [0.6, -0.22, 0.78], [0.15, -0.55, 0.6],
];

// A soft, volumetric cloud: each lobe is a radial gradient (feathered edge),
// upper lobes lit lighter, lower lobes shadowed, so it reads as a real cloud.
function puffCloud(ctx, cx, cy, s, top, bot, alpha) {
  for (const [dx, dy, r] of CLOUD_LOBES) {
    const lx = cx + dx * s, ly = cy + dy * s, lr = r * s;
    const lit = Math.max(0, Math.min(1, 0.55 - dy)); // top lobes -> lighter
    const col = lerpArr(bot, top, lit).map((v) => v | 0);
    const g = ctx.createRadialGradient(lx, ly - lr * 0.25, lr * 0.15, lx, ly, lr);
    g.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${alpha})`);
    g.addColorStop(0.65, `rgba(${col[0]},${col[1]},${col[2]},${alpha * 0.92})`);
    g.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(lx, ly, lr, lr * 0.82, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Persistent clouds that drift across and off the edges (never pop in place).
const CLOUDS = (() => {
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const out = [];
  for (let i = 0; i < 8; i++) {
    out.push({ phase: rnd(), fy: 0.14 + rnd() * 0.3, s: 30 + rnd() * 26, sp: 4 + rnd() * 7 });
  }
  return out;
})();

// Clouds fade in with intensity, darken as the storm builds, and slide across.
function drawClouds(ctx, w, horizonY, time, intensity) {
  const top = lerpArr([236, 239, 243], [150, 158, 170], intensity); // sunlit -> storm top
  const bot = lerpArr([196, 201, 210], [96, 105, 120], intensity);  // shaded underside
  const alpha = Math.min(1, 0.35 + intensity * 0.65);
  for (const c of CLOUDS) {
    const s = c.s * L.unit;
    const span = w + s * 6;
    const x = ((c.phase * span + time * c.sp) % span) - s * 3;
    puffCloud(ctx, x, horizonY * c.fy, s, top, bot, alpha);
  }
}

// Wildlife that returns as milestones are passed — a living, animated reward,
// spread across the whole window. `sky` (fraction of the sky band) marks flyers;
// `ground` (fraction of the ground band) marks walkers.
const CRITTERS = [
  { e: '🦋', at: 0.42, fx: 0.12, sky: 0.58, m: 'flutter', ph: 0.0 },
  { e: '🦋', at: 0.44, fx: 0.5, sky: 0.42, m: 'flutter', ph: 1.5 },
  { e: '🦋', at: 0.55, fx: 0.86, sky: 0.5, m: 'flutter', ph: 2.3 },
  { e: '🦋', at: 0.62, fx: 0.32, sky: 0.66, m: 'flutter', ph: 3.1 },
  { e: '🐦', at: 0.5, fx: 0.3, sky: 0.3, m: 'fly', ph: 1.1, sp: 24 },
  { e: '🐦', at: 0.6, fx: 0.7, sky: 0.2, m: 'fly', ph: 0.4, sp: 34 },
  { e: '🦌', at: 0.72, fx: 0.14, ground: 0.5, m: 'bob', ph: 0.7 },
  { e: '🐇', at: 0.76, fx: 0.82, ground: 0.66, m: 'bob', ph: 1.2 },
  { e: '🦊', at: 0.88, fx: 0.55, ground: 0.38, m: 'bob', ph: 1.8 },
  { e: '🦌', at: 0.9, fx: 0.9, ground: 0.5, m: 'bob', ph: 2.6 },
];
function drawCritters(ctx, w, horizonY, h, avg, time) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '18px system-ui, sans-serif';
  const gb = h - horizonY;
  for (const c of CRITTERS) {
    if (avg <= c.at) continue;
    let x = c.fx * w;
    let y = c.sky != null ? c.sky * horizonY : horizonY + c.ground * gb;
    if (c.m === 'flutter') {
      x += Math.sin(time * 0.5 + c.ph) * 30 + Math.sin(time * 0.23 + c.ph * 2) * 14;
      y += Math.sin(time * 0.7 + c.ph) * 16 + Math.sin(time * 7 + c.ph) * 4;
    } else if (c.m === 'fly') {
      x = ((c.fx * w + time * c.sp) % (w + 40)) - 20; // drift + wrap
      y += Math.sin(time * 2 + c.ph) * 6;
    } else {
      // Slow roaming wander + a gentle bob, so they walk the land.
      x += Math.sin(time * 0.22 + c.ph) * 42 + Math.sin(time * 0.1 + c.ph * 1.7) * 18;
      y += Math.sin(time * 1.6 + c.ph) * 2.5;
    }
    ctx.globalAlpha = Math.min(1, (avg - c.at) / 0.08);
    if (c.m === 'fly') {
      // The bird glyph faces left but birds drift right — mirror it so it faces
      // its direction of travel (not flying backward).
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(-1, 1);
      ctx.fillText(c.e, 0, 0);
      ctx.restore();
    } else {
      ctx.fillText(c.e, x, y);
    }
  }
  ctx.globalAlpha = 1;
}

// Draw transient feedback effects (survival %, survive/die pops).
function drawFx(ctx, state) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const fx of state.fx) {
    const c = tileCenter(fx.col, fx.row);
    const cx = c.x;
    const topY = c.y - L.th; // top vertex of the tile
    const t = fx.age / fx.ttl; // 0..1
    const alpha = 1 - t;

    if (fx.kind === 'chance') {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.fillText(fx.text, cx, topY - 6 - t * 16);
    } else if (fx.kind === 'survive') {
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#5fd15a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, c.y, 6 + t * L.tw, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#5fd15a';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillText('✓', cx, topY - 4 - t * 14);
    } else if (fx.kind === 'die') {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#c65a3a';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillText('✕', cx, topY - 4 - t * 14);
    } else if (fx.kind === 'unlock') {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#7fe07a';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.fillText(fx.text, cx, c.y - t * 18);
    } else if (fx.kind === 'need') {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ef7a5a';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.fillText(fx.text, cx, c.y - t * 8);
    }
  }
  ctx.globalAlpha = 1;
}

// Darken a #rrggbb color by factor f -> css string (for rims/trunks).
function darken(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(((n >> 16) & 255) * f) | 0},${(((n >> 8) & 255) * f) | 0},${((n & 255) * f) | 0})`;
}
// Filled disc with a dark rim so overlapping plants keep visible edges.
function blob(ctx, x, y, r, fill, rim) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = 1.4; ctx.strokeStyle = rim; ctx.stroke();
}
function roundFillStroke(ctx, x, y, w, h, rad) {
  roundRect(ctx, x, y, w, h, rad); ctx.fill(); ctx.stroke();
}

// Per-type silhouettes — distinct shape + colour + a rim, so they read apart
// even when overlapping. (ctx, cx, baseY, size px, color, rim).
const SHAPES = {
  seed(ctx, cx, baseY, s, color, rim) {
    const h = s * 0.7; // small seedling, not a tall stick
    ctx.strokeStyle = darken(color, 0.7); ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, baseY); ctx.quadraticCurveTo(cx - 1.5, baseY - h * 0.6, cx, baseY - h); ctx.stroke();
    ctx.fillStyle = color; ctx.strokeStyle = rim; ctx.lineWidth = 1;
    for (const d of [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(cx + d * 4, baseY - h * 0.78, 5, 3, d * 0.7, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }
  },
  cactus(ctx, cx, baseY, s, color, rim) {
    const w = Math.max(6, s * 0.3);
    ctx.fillStyle = color; ctx.strokeStyle = rim; ctx.lineWidth = 1.4;
    roundFillStroke(ctx, cx - w / 2, baseY - s, w, s, w / 2); // column
    const armY = baseY - s * 0.55, aw = w * 0.66;
    roundFillStroke(ctx, cx - w * 1.25, armY - s * 0.16, aw, s * 0.42, aw / 2); // left arm
    roundFillStroke(ctx, cx + w * 0.6, armY - s * 0.28, aw, s * 0.46, aw / 2); // right arm
    ctx.strokeStyle = darken(color, 0.78); ctx.lineWidth = 1; // ribs
    for (const rx of [cx - w * 0.18, cx + w * 0.18]) {
      ctx.beginPath(); ctx.moveTo(rx, baseY - s + 3); ctx.lineTo(rx, baseY - 3); ctx.stroke();
    }
  },
  shrub(ctx, cx, baseY, s, color, rim) {
    const r = s * 0.5; // squat, wide, no trunk
    blob(ctx, cx - r * 0.85, baseY - r * 0.4, r * 0.66, color, rim);
    blob(ctx, cx + r * 0.85, baseY - r * 0.4, r * 0.66, color, rim);
    blob(ctx, cx, baseY - r * 0.95, r * 0.72, color, rim);
    blob(ctx, cx, baseY - r * 0.5, r * 0.9, color, rim);
  },
  tree(ctx, cx, baseY, s, color, rim) {
    const trunkH = s * 0.5, tw = Math.max(2.5, s * 0.13);
    ctx.fillStyle = '#7a5230';
    roundRect(ctx, cx - tw / 2, baseY - trunkH, tw, trunkH, tw * 0.3); ctx.fill();
    const cr = (s - trunkH) * 0.68;
    blob(ctx, cx, baseY - trunkH - cr * 0.6, cr, color, rim); // single round canopy
  },
  canopy(ctx, cx, baseY, s, color, rim) {
    const trunkH = s * 0.5, tw = Math.max(3, s * 0.17);
    ctx.fillStyle = '#5f3d20';
    roundRect(ctx, cx - tw / 2, baseY - trunkH, tw, trunkH, tw * 0.3); ctx.fill();
    const cr = (s - trunkH) * 0.5;
    blob(ctx, cx - cr * 0.72, baseY - trunkH - cr * 0.55, cr * 0.92, color, rim);
    blob(ctx, cx + cr * 0.72, baseY - trunkH - cr * 0.55, cr * 0.92, color, rim);
    blob(ctx, cx, baseY - trunkH - cr * 1.25, cr * 1.1, color, rim); // tall layered crown
  },
};

// Draw a plant standing on its iso tile, with a ground shadow to anchor it.
function drawPlant(ctx, cx, baseY, plant) {
  if (plant.status === 'dead') {
    ctx.strokeStyle = '#7a5a34'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, baseY);
    ctx.quadraticCurveTo(cx + 3, baseY - L.th * 0.6, cx + 9, baseY - L.th * 0.5);
    ctx.stroke();
    return;
  }

  const type = TYPE_BY_ID[plant.typeId] || PLANT_TYPES[0];
  const s = plantHeight(plant);
  ctx.globalAlpha = plant.status === 'settling' ? 0.6 : 1;

  // Ground shadow — separates the plant from the tile and its neighbours.
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.beginPath();
  ctx.ellipse(cx, baseY + 1, Math.max(6, s * 0.32), Math.max(2, s * 0.13), 0, 0, Math.PI * 2);
  ctx.fill();

  (SHAPES[type.id] || SHAPES.seed)(ctx, cx, baseY, s, type.color, darken(type.color, 0.55));
  ctx.globalAlpha = 1;
}
