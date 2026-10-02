// Draws the world in design-unit coordinates. The caller sets the canvas
// Draws the world in screen pixels using the adaptive layout (see layout.js).
import { tileCenter, plantHeight } from './state.js';
import { L, applyCamera } from './layout.js';
import { avgMeter, unlockCost, STAGES, TYPE_BY_ID, PLANT_TYPES, tileBonus, plantCosmetic } from './game.js';
import { activeDims, activeWorld } from './world.js';

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

// Scene palette per stage comes from the ACTIVE world (see world.js): sky and
// ground gradients that carry each place from its barren start to lush.

// Interpolated scene colors for the current environment average.
function sceneColors(avg) {
  const PALETTES = activeWorld().palettes;
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
// The water source, evolving with the environment: a carried jug in the barren
// desert, then a puddle → pond → stream → a full river as the land greens.
// Drawn in the backdrop (behind the platform) and animated (shimmer + current).
function drawJug(ctx, x, y, u) {
  const s = 11 * u;
  ctx.fillStyle = '#8b9aa4';
  roundRect(ctx, x - s * 0.5, y - s * 0.9, s, s * 1.25, s * 0.32); ctx.fill();
  ctx.fillStyle = '#4aa3e0'; // water inside
  roundRect(ctx, x - s * 0.36, y - s * 0.3, s * 0.72, s * 0.55, s * 0.18); ctx.fill();
  ctx.fillStyle = '#6b7c86'; // neck + cap
  ctx.fillRect(x - s * 0.17, y - s * 1.28, s * 0.34, s * 0.42);
}

function drawWater(ctx, w, horizonY, h, avg, time, rainI = 0) {
  const u = L.unit;
  const gb = h - horizonY;
  const hash = (i) => { const q = Math.sin(i * 127.1) * 43758.5; return q - Math.floor(q); };

  // Barren desert: a carried jug on the ground.
  if (avg < 0.12) { drawJug(ctx, w * 0.18, horizonY + gb * 0.5, u); return; }

  // A distant water line at the horizon, BEHIND the grove: the platform (drawn
  // on top) occludes its near edge, so it reads as "river behind the forest"
  // with no floating. Thin (perspective), and its width runs past the screen
  // edges as it grows so the ends slide off and a flowing river band remains —
  // never a widening oval lake.
  const t = Math.min(1, (avg - 0.12) / 0.73);   // pond (0) → river (1)
  const hgt = (5 + 10 * t) * u;                  // thin distant band
  const cy = horizonY + hgt;                     // top edge sits at the horizon
  const width = (0.26 + 1.55 * t) * w;           // > w as it becomes a river (ends off-screen)
  const cx = (0.34 + 0.16 * t) * w;              // off to one side → centred
  const rad = width / 2;

  // Damp grassy bank.
  ctx.fillStyle = 'rgba(52, 76, 38, 0.55)';
  ctx.beginPath();
  ctx.ellipse(cx, cy, rad + 6 * u, hgt + 5 * u, 0, 0, Math.PI * 2);
  ctx.fill();

  // Water body.
  const grad = ctx.createLinearGradient(0, cy - hgt, 0, cy + hgt);
  grad.addColorStop(0, '#7cc2ee');
  grad.addColorStop(1, '#2f72b2');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rad, hgt, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1.4 * u;
  ctx.strokeStyle = 'rgba(210, 240, 255, 0.5)';
  ctx.stroke();

  // Current / shimmer, clipped to the water; faster as it flows.
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rad, hgt, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = 'rgba(214, 241, 255, 0.5)';
  const n = 4 + ((t * 8) | 0);
  for (let i = 0; i < n; i++) {
    const sx = (cx - rad) + ((i * 131 + time * (20 + 55 * t)) % width);
    const sy = cy + Math.sin(i * 1.7 + time * 1.3) * hgt * 0.5;
    ctx.beginPath();
    ctx.ellipse(sx, sy, width * 0.04, hgt * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Rain dimples: expanding ripple rings pock the surface while it rains. Count
  // and opacity scale with intensity; each drop relocates when its ring resets,
  // so the whole band twinkles. Rings are iso-flattened to lie on the water.
  if (rainI > 0.05) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rad, hgt, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.lineWidth = 1 * u;
    const drops = Math.round((6 + t * 12) * rainI);
    for (let i = 0; i < drops; i++) {
      const cycle = time * 1.3 + hash(i * 3.1);
      const phase = cycle % 1;                       // 0 (drop) → 1 (faded ring)
      const seed = Math.floor(cycle);                // new spot each cycle
      const px = cx + (hash(i + seed * 0.37) * 2 - 1) * rad * 0.9;
      const py = cy + (hash(i * 7.7 + seed * 0.91) * 2 - 1) * hgt * 0.65;
      const rr = phase * 6 * u;                       // ring grows
      ctx.strokeStyle = `rgba(226, 244, 255, ${(1 - phase) * 0.5 * rainI})`;
      ctx.beginPath();
      ctx.ellipse(px, py, rr, rr * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Reeds along the near edge, across the visible span, gently swaying.
  ctx.strokeStyle = '#3d7a2c';
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.3 * u;
  const reeds = 10 + ((t * 20) | 0);
  for (let i = 0; i < reeds; i++) {
    const rx = (i + 0.5) / reeds * w;
    const dxn = (rx - cx) / rad;
    if (Math.abs(dxn) >= 0.999) continue;
    const edgeY = cy + hgt * Math.sqrt(1 - dxn * dxn);
    const rh = (4 + hash(i) * 6) * u;
    const sway = Math.sin(time * 1.5 + i) * 1.6 * u;
    ctx.beginPath();
    ctx.moveTo(rx, edgeY + 1);
    ctx.quadraticCurveTo(rx + sway * 0.5, edgeY - rh * 0.6, rx + sway, edgeY - rh);
    ctx.stroke();
  }
}

// Offscreen cache of the backdrop's static layer (sky, ground, grass). It only
// changes as the land greens, so it's rebuilt when the environment average moves
// by a visible step (or on resize) — not every frame. Big win on cheap phones.
let bgCache = null;
let bgCacheKey = '';
function staticBackdrop(avg) {
  const { w, h, horizonY, dpr } = L;
  const key = `${w}x${h}@${dpr}|${horizonY}|${Math.round(avg * 300)}`;
  if (bgCache && key === bgCacheKey) return bgCache;
  if (!bgCache) bgCache = document.createElement('canvas');
  bgCache.width = Math.max(1, Math.round(w * dpr));
  bgCache.height = Math.max(1, Math.round(h * dpr));
  const c = bgCache.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);

  const col = sceneColors(avg);
  const cs = (v) => `rgb(${v[0] | 0},${v[1] | 0},${v[2] | 0})`;
  const hy = Math.max(0, Math.min(h, horizonY));
  if (hy > 0) {
    const sky = c.createLinearGradient(0, 0, 0, hy);
    sky.addColorStop(0, cs(col.skyTop));
    sky.addColorStop(1, cs(col.skyBot));
    c.fillStyle = sky;
    c.fillRect(0, 0, w, hy);
  }
  const gnd = c.createLinearGradient(0, hy, 0, h);
  gnd.addColorStop(0, cs(col.grTop));
  gnd.addColorStop(1, cs(col.grBot));
  c.fillStyle = gnd;
  c.fillRect(0, hy, w, h - hy);
  drawTufts(c, w, hy, h, avg);

  bgCacheKey = key;
  return bgCache;
}

export function renderBackdrop(ctx, state, now = 0) {
  const { w, h, horizonY } = L;
  const hy = Math.max(0, Math.min(h, horizonY));
  const avg = avgMeter(state);
  const time = now / 1000;

  // Clear the real canvas in screen space, then draw the whole backdrop through
  // the world camera so it zooms and pans in lock-step with the grid. The base
  // image is window-sized and the camera clamp keeps it covering the screen.
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  applyCamera(ctx);
  ctx.drawImage(staticBackdrop(avg), 0, 0, w, h);
  const rainI = (state.rain && state.rain.intensity) || 0;
  drawWater(ctx, w, hy, h, avg, time, rainI);

  drawSun(ctx, w * 0.74, hy * 0.42, avg, time, 1 - 0.72 * rainI);
  drawCritters(ctx, w, hy, h, avg, time);

  // Clouds roll in and the light dims as the shower builds; both ease with
  // intensity so nothing pops on/off.
  if (rainI > 0.01) {
    drawClouds(ctx, w, hy, time, rainI);
    ctx.fillStyle = `rgba(44, 58, 72, ${0.15 * rainI})`;
    ctx.fillRect(0, 0, w, h);
    drawRain(ctx, w, h, time, 0, rainI);
  }
  ctx.restore();
}

export function renderScene(ctx, state, now = 0, man = null) {
  const { w, h, tw, th, unit, horizonY } = L;
  const time = now / 1000;
  const avg = avgMeter(state); // 0 desert .. 1 rainforest

  // Transparent play field — the full-window backdrop shows through. Only the
  // interactive isometric grid, its plants, the man and feedback live here, and
  // they are drawn through the SAME world camera as the backdrop so the whole
  // scene zooms/pans as one.
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  applyCamera(ctx);

  // Visible region in base space (for culling), since tiles are drawn pre-camera.
  const vx0 = -L.camX / L.zoom, vx1 = (w - L.camX) / L.zoom;
  const vy0 = -L.camY / L.zoom, vy1 = (h - L.camY) / L.zoom;

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
    // Cull tiles well outside the visible base region (zoomed-in grids draw far
    // fewer). Generous vertical margin so tall plants above a tile still draw.
    if (c.x < vx0 - 2 * tw || c.x > vx1 + 2 * tw || c.y < vy0 - 6 * th || c.y > vy1 + 4 * th) continue;

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
    const bonus = tileBonus(state, p);
    if (p.plant) {
      drawPlant(ctx, c.x, c.y, p.plant);
      // Tap target above the plant: a 💧 when it's thirsty, else a gold coin
      // when it's ready to harvest (a collectible token, not a fruit).
      if (p.plant.status === 'alive' && (p.plant.thirsty || p.plant.ripe)) {
        const bob = Math.sin(time * 3 + p.col + p.row) * 2.5 * unit;
        const iy = c.y - plantHeight(p.plant) - 8 * unit + bob;
        if (p.plant.thirsty) {
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = `${Math.round(16 * unit)}px system-ui, sans-serif`;
          ctx.fillText('💧', c.x, iy);
        } else {
          drawDrop(ctx, c.x, iy, (4 + 0.4 * Math.sin(time * 4 + p.col)) * unit);
        }
      }
      // Mixed grove (3+ species around it): a small gold marker on the tile.
      if (bonus.mixed && p.plant.status === 'alive') {
        ctx.fillStyle = '#f6d365';
        ctx.beginPath();
        ctx.arc(c.x + tw * 0.55, c.y + th * 0.1, Math.max(2, th * 0.14), 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Empty, plantable. Green when established neighbours will shelter a
      // seedling here (a better spot), white otherwise.
      ctx.fillStyle = bonus.nurse > 0 ? 'rgba(140, 240, 120, 0.75)' : 'rgba(255, 255, 255, 0.22)';
      ctx.beginPath();
      ctx.arc(c.x, c.y, Math.max(2, th * (bonus.nurse > 0 ? 0.22 : 0.18)), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // The lone man in the foreground — at his live position, with a walk bob.
  if (man) {
    const bob = man.moving ? Math.abs(Math.sin(time * 14)) * 2 * unit : 0;
    drawFigure(ctx, man.x, man.y - bob, 1.3 * unit, man.facing);
  } else {
    const fl = tileCenter(0, activeDims().rows - 1);
    drawFigure(ctx, fl.x - tw * 0.5, fl.y + th * 0.6, 1.3 * unit);
  }

  // Transient feedback effects, on top of the plants.
  drawFx(ctx, state);

  // Rain streaks over the platform (the backdrop rains on the wider scene).
  const rainI = (state.rain && state.rain.intensity) || 0;
  if (rainI > 0.01) drawRain(ctx, w, h, time, 0, rainI);

  ctx.restore(); // back to screen space for the HUD footing band

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
    out.push({ phase: rnd(), fy: 0.56 + rnd() * 0.3, s: 26 + rnd() * 20, sp: 4 + rnd() * 7 });
  }
  return out;
})();

// Pre-rendered cloud sprites — each cloud drawn once in a fair and a storm
// colouring (rebuilt only when scale/dpr change), then crossfaded by intensity.
// Two image draws per cloud instead of nine radial gradients every frame.
const CLOUD_W = 4.2, CLOUD_H = 2.4; // sprite size in units of the cloud's s
let cloudSprites = [];
let cloudSpriteKey = '';
function cloudSpriteSet() {
  const key = `${L.unit.toFixed(3)}@${L.dpr}`;
  if (key === cloudSpriteKey) return cloudSprites;
  const paint = (s, top, bot) => {
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(s * CLOUD_W * L.dpr));
    cv.height = Math.max(1, Math.round(s * CLOUD_H * L.dpr));
    const c = cv.getContext('2d');
    c.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    puffCloud(c, s * CLOUD_W / 2, s * CLOUD_H / 2, s, top, bot, 1);
    return cv;
  };
  cloudSprites = CLOUDS.map((c) => {
    const s = c.s * L.unit;
    return {
      s,
      fair: paint(s, [240, 243, 247], [204, 210, 218]),  // sunlit
      storm: paint(s, [186, 193, 203], [140, 149, 163]), // overcast (lighter)
    };
  });
  cloudSpriteKey = key;
  return cloudSprites;
}

// Clouds fade in with intensity, darken as the storm builds, and slide across.
function drawClouds(ctx, w, horizonY, time, intensity) {
  const alpha = Math.min(0.82, 0.32 + intensity * 0.5);
  const sprites = cloudSpriteSet();
  CLOUDS.forEach((c, i) => {
    const { s, fair, storm } = sprites[i];
    const span = w + s * 6;
    const x = ((c.phase * span + time * c.sp) % span) - s * 3;
    const dx = x - s * CLOUD_W / 2, dy = horizonY * c.fy - s * CLOUD_H / 2;
    const dw = s * CLOUD_W, dh = s * CLOUD_H;
    ctx.globalAlpha = alpha * (1 - intensity);
    ctx.drawImage(fair, dx, dy, dw, dh);
    ctx.globalAlpha = alpha * intensity;
    ctx.drawImage(storm, dx, dy, dw, dh);
  });
  ctx.globalAlpha = 1;
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

// The "ready to harvest" token above a grown plant — a water droplet, since what
// you collect is water (not coins). A soft glow + highlight make it read as a
// bright, collectible reward, distinct from the plain 💧 "thirsty" bubble.
function drawDrop(ctx, x, y, r) {
  // Soft blue glow so it pops as a reward.
  const glow = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 2.2);
  glow.addColorStop(0, 'rgba(120, 200, 245, 0.38)');
  glow.addColorStop(1, 'rgba(120, 200, 245, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(x, y, r * 2.2, 0, Math.PI * 2); ctx.fill();

  // Teardrop: pointed top, round bottom.
  const top = y - r * 1.5;
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.bezierCurveTo(x + r * 1.1, y - r * 0.15, x + r * 0.95, y + r * 0.85, x, y + r);
  ctx.bezierCurveTo(x - r * 0.95, y + r * 0.85, x - r * 1.1, y - r * 0.15, x, top);
  ctx.closePath();
  const g = ctx.createLinearGradient(x, top, x, y + r);
  g.addColorStop(0, '#a8ddf6');
  g.addColorStop(1, '#3f93d6');
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(32, 96, 150, 0.7)'; ctx.stroke();

  // Glossy highlight.
  ctx.beginPath(); ctx.ellipse(x - r * 0.32, y + r * 0.08, r * 0.2, r * 0.32, -0.2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.78)'; ctx.fill();
}

// Darken a #rrggbb color by factor f -> css string (for rims/trunks).
function darken(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(((n >> 16) & 255) * f) | 0},${(((n >> 8) & 255) * f) | 0},${((n & 255) * f) | 0})`;
}
// Blend a #rrggbb colour toward dry straw (a wilting plant).
function wilt(hex) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (v, w) => (v + (w - v) * 0.6) | 0;
  return `rgb(${mix((n >> 16) & 255, 176)},${mix((n >> 8) & 255, 150)},${mix(n & 255, 92)})`;
}
// Filled disc with a dark rim so overlapping plants keep visible edges.
function blob(ctx, x, y, r, fill, rim) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = 1.1; ctx.strokeStyle = rim; ctx.stroke();
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
    const r = s * 0.4; // compact bush, no trunk
    blob(ctx, cx - r * 0.72, baseY - r * 0.4, r * 0.6, color, rim);
    blob(ctx, cx + r * 0.72, baseY - r * 0.4, r * 0.6, color, rim);
    blob(ctx, cx, baseY - r * 0.9, r * 0.66, color, rim);
    blob(ctx, cx, baseY - r * 0.48, r * 0.8, color, rim);
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

  // --- Per-world signature silhouettes (selected via world.js plant.shape) ---

  // Palm: curved trunk crowned by a radiating fan of fronds (Thar date palm,
  // Atlantic brazilwood).
  palm(ctx, cx, baseY, s, color, rim) {
    const trunkH = s * 0.62;
    ctx.strokeStyle = '#8a6038'; ctx.lineWidth = Math.max(2.5, s * 0.12); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, baseY);
    ctx.quadraticCurveTo(cx - s * 0.1, baseY - trunkH * 0.55, cx + s * 0.03, baseY - trunkH); ctx.stroke();
    const tx = cx + s * 0.03, ty = baseY - trunkH, fl = s * 0.5;
    for (const [dx, dy] of [[-1, -0.1], [-0.7, -0.7], [-0.25, -1], [0.25, -1], [0.7, -0.7], [1, -0.1]]) {
      const mx = tx + dx * fl * 0.5, my = ty + dy * fl * 0.45 - s * 0.05;
      const ex = tx + dx * fl, ey = ty + dy * fl * 0.1;
      ctx.strokeStyle = rim; ctx.lineWidth = Math.max(3, s * 0.14);
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(mx, my, ex, ey); ctx.stroke();
      ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.5, s * 0.08);
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(mx, my, ex, ey); ctx.stroke();
    }
  },

  // Acacia: thin trunk, splayed branches, a wide flat umbrella canopy (Sahel).
  acacia(ctx, cx, baseY, s, color, rim) {
    const trunkH = s * 0.55, tw = Math.max(2.5, s * 0.1);
    ctx.fillStyle = '#7a5230';
    roundRect(ctx, cx - tw / 2, baseY - trunkH, tw, trunkH, tw * 0.3); ctx.fill();
    ctx.strokeStyle = '#7a5230'; ctx.lineWidth = tw * 0.8; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, baseY - trunkH * 0.72); ctx.lineTo(cx - s * 0.28, baseY - trunkH);
    ctx.moveTo(cx, baseY - trunkH * 0.72); ctx.lineTo(cx + s * 0.28, baseY - trunkH); ctx.stroke();
    const cw = s * 0.98, ch = s * 0.3, cyy = baseY - trunkH - ch * 0.4;
    ctx.fillStyle = color; ctx.strokeStyle = rim; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.ellipse(cx, cyy, cw / 2, ch / 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    blob(ctx, cx - cw * 0.22, cyy - ch * 0.35, ch * 0.5, color, rim);
    blob(ctx, cx + cw * 0.2, cyy - ch * 0.28, ch * 0.44, color, rim);
  },

  // Baobab: fat bottle trunk, short splayed branches, sparse foliage tufts (Sahel).
  baobab(ctx, cx, baseY, s, color, rim) {
    const trunkH = s * 0.58, tw = Math.max(6, s * 0.42);
    ctx.fillStyle = '#9a7850'; ctx.strokeStyle = darken('#9a7850', 0.78); ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(cx - tw / 2, baseY); ctx.lineTo(cx - tw * 0.26, baseY - trunkH);
    ctx.lineTo(cx + tw * 0.26, baseY - trunkH); ctx.lineTo(cx + tw / 2, baseY);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    const ty = baseY - trunkH;
    ctx.strokeStyle = '#9a7850'; ctx.lineWidth = Math.max(2, s * 0.1); ctx.lineCap = 'round';
    for (const dx of [-1, -0.4, 0.4, 1]) {
      ctx.beginPath(); ctx.moveTo(cx, ty); ctx.lineTo(cx + dx * s * 0.3, ty - s * 0.18); ctx.stroke();
    }
    for (const dx of [-1, -0.4, 0.4, 1]) blob(ctx, cx + dx * s * 0.3, ty - s * 0.2, s * 0.14, color, rim);
    blob(ctx, cx, ty - s * 0.12, s * 0.16, color, rim);
  },

  // Pine: short trunk under three stacked conifer tiers (Loess highland).
  pine(ctx, cx, baseY, s, color, rim) {
    const trunkH = s * 0.16, tw = Math.max(2, s * 0.09);
    ctx.fillStyle = '#6a4a2c'; roundRect(ctx, cx - tw / 2, baseY - trunkH, tw, trunkH, 1); ctx.fill();
    ctx.fillStyle = color; ctx.strokeStyle = rim; ctx.lineWidth = 1.1;
    const topY = baseY - s, botY = baseY - trunkH, span = botY - topY;
    const layers = [
      { y0: botY, y1: botY - span * 0.46, w: s * 0.5 },
      { y0: botY - span * 0.34, y1: botY - span * 0.76, w: s * 0.38 },
      { y0: botY - span * 0.64, y1: topY, w: s * 0.26 },
    ];
    for (const ly of layers) {
      ctx.beginPath(); ctx.moveTo(cx - ly.w, ly.y0); ctx.lineTo(cx + ly.w, ly.y0);
      ctx.lineTo(cx, ly.y1); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  },

  // Fern: a low cluster of arching fronds springing from the ground (Atlantic).
  fern(ctx, cx, baseY, s, color, rim) {
    const h = s * 0.82;
    ctx.lineCap = 'round';
    for (const dx of [-1, -0.5, 0, 0.5, 1]) {
      const ex = cx + dx * s * 0.42, ey = baseY - h * (1 - Math.abs(dx) * 0.32);
      const mx = cx + dx * s * 0.1, my = baseY - h * 0.6;
      ctx.strokeStyle = rim; ctx.lineWidth = Math.max(2.5, s * 0.1);
      ctx.beginPath(); ctx.moveTo(cx, baseY); ctx.quadraticCurveTo(mx, my, ex, ey); ctx.stroke();
      ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.3, s * 0.055);
      ctx.beginPath(); ctx.moveTo(cx, baseY); ctx.quadraticCurveTo(mx, my, ex, ey); ctx.stroke();
    }
  },
};

// Shift a #rrggbb colour lighter (f>0) or darker (f<0), for per-plant variety.
function tint(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const adj = (c) => ((f >= 0 ? c + (255 - c) * f : c * (1 + f)) | 0);
  return `rgb(${adj((n >> 16) & 255)},${adj((n >> 8) & 255)},${adj(n & 255)})`;
}
// Draw a plant standing on its iso tile, with a ground shadow to anchor it.
// Each plant is jittered in size/tint/position (from plant.v) so a cluster
// reads as distinct plants, not one green blob.
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
  const cos = plantCosmetic(plant.typeId); // per-world reskin (color + shape)
  const skinColor = cos.color;
  const s = plantHeight(plant); // already size-varied by plant.v
  const v = plant.v ?? 0.5;
  const v2 = (v * 7.3) % 1;
  const jx = cx + (v - 0.5) * L.tw * 0.24;   // nudge off dead-centre
  const jy = baseY + (v2 - 0.5) * L.th * 0.18;
  ctx.globalAlpha = plant.status === 'settling' ? 0.6 : 1;

  // Ground shadow — separates the plant from the tile and its neighbours.
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(jx, jy + 1, Math.max(6, s * 0.3), Math.max(2, s * 0.12), 0, 0, Math.PI * 2);
  ctx.fill();

  // Thirsty plants wilt; otherwise each plant gets a slight brightness shift.
  const color = plant.thirsty ? wilt(skinColor) : tint(skinColor, (v2 - 0.5) * 0.3);
  (SHAPES[cos.shape] || SHAPES[type.id] || SHAPES.seed)(ctx, jx, jy, s, color, darken(color, 0.62));
  ctx.globalAlpha = 1;
}
