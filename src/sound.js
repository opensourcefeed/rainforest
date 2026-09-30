// Procedural audio via Web Audio — no asset files. A soft rain ambience whose
// volume tracks rain intensity, plus short synthesized SFX. Muted state persists.
let ctx = null, master = null, rainGain = null;
let enabled = true;
const MUTE_KEY = 'rainforest.muted.v1';

try { enabled = localStorage.getItem(MUTE_KEY) !== '1'; } catch { /* default on */ }

function noiseSource() {
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf; src.loop = true;
  return src;
}

// Must be called from a user gesture (autoplay policy).
export function initAudio() {
  if (ctx) return;
  try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
  master = ctx.createGain();
  master.gain.value = enabled ? 0.55 : 0;
  master.connect(ctx.destination);

  const noise = noiseSource();
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 1500;
  rainGain = ctx.createGain(); rainGain.gain.value = 0;
  noise.connect(lp); lp.connect(rainGain); rainGain.connect(master);
  noise.start();
}

export function setRain(intensity) {
  if (rainGain && ctx) rainGain.gain.setTargetAtTime(0.2 * intensity, ctx.currentTime, 0.6);
}

function blip(freq, dur, type = 'sine', vol = 0.3) {
  if (!ctx || !enabled) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  o.connect(g); g.connect(master);
  const t = ctx.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t); o.stop(t + dur + 0.02);
}
const arp = (notes, dur, type, vol) =>
  notes.forEach((f, i) => setTimeout(() => blip(f, dur, type, vol), i * 90));

export const sfx = {
  plant() { blip(520, 0.12, 'triangle', 0.22); },
  collect() { blip(340, 0.1, 'sine', 0.18); },
  unlock() { blip(440, 0.08, 'square', 0.14); setTimeout(() => blip(660, 0.12, 'square', 0.12), 60); },
  upgrade() { arp([523, 659, 784], 0.16, 'triangle', 0.2); },
  fanfare() { arp([523, 659, 784, 1047], 0.32, 'triangle', 0.24); },
  // A plant takes root — bright two-note lift.
  survive() { blip(700, 0.11, 'sine', 0.15); setTimeout(() => blip(950, 0.13, 'sine', 0.13), 55); },
  // A seedling withers — soft low fall.
  wither() { blip(250, 0.16, 'sine', 0.14); setTimeout(() => blip(175, 0.22, 'sine', 0.11), 70); },
  // Advancing from the stage popup.
  advance() { blip(540, 0.1, 'triangle', 0.2); setTimeout(() => blip(810, 0.2, 'triangle', 0.2), 90); },
};

export function toggleMuted() {
  enabled = !enabled;
  try { localStorage.setItem(MUTE_KEY, enabled ? '0' : '1'); } catch { /* ignore */ }
  if (master && ctx) master.gain.setTargetAtTime(enabled ? 0.55 : 0, ctx.currentTime, 0.1);
  return enabled;
}
export function isEnabled() { return enabled; }
