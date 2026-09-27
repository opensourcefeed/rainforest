// Draws the world in design-unit coordinates. The caller sets the canvas
// transform so (0,0)..(DESIGN.w,DESIGN.h) maps to the fitted play field.
import { DESIGN, HORIZON } from './config.js';
import { plotRect } from './state.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function renderScene(ctx, state) {
  const { w, h } = DESIGN;

  // Sky
  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
  sky.addColorStop(0, '#8fb7d6');
  sky.addColorStop(1, '#e7d6a8');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, HORIZON);

  // Sun
  ctx.fillStyle = '#fff4d6';
  ctx.beginPath();
  ctx.arc(w * 0.74, h * 0.16, 42, 0, Math.PI * 2);
  ctx.fill();

  // Sand
  const sand = ctx.createLinearGradient(0, HORIZON, 0, h);
  sand.addColorStop(0, '#d9b579');
  sand.addColorStop(1, '#b8894d');
  ctx.fillStyle = sand;
  ctx.fillRect(0, HORIZON, w, h - HORIZON);

  // Lone figure (placeholder)
  ctx.fillStyle = '#4a3a24';
  ctx.fillRect(w * 0.5 - 4, HORIZON - 26, 8, 26);
  ctx.beginPath();
  ctx.arc(w * 0.5, HORIZON - 32, 7, 0, Math.PI * 2);
  ctx.fill();

  // Planting plots
  for (const p of state.plots) {
    const r = plotRect(p.col, p.row);
    ctx.fillStyle = 'rgba(90, 62, 30, 0.18)';
    ctx.strokeStyle = 'rgba(74, 58, 36, 0.55)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, r.x, r.y, r.w, r.h, 6);
    ctx.fill();
    ctx.stroke();
  }
}
