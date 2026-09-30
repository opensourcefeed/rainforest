// Procedural audio via Web Audio — no asset files. A soft rain ambience whose
// volume tracks rain intensity, plus short synthesized SFX. Muted state persists.
let ctx = null, master = null, rainGain = null;
let enabled = true;
let volume = 0.55;
const MUTE_KEY = 'rainforest.muted.v1';
const VOL_KEY = 'rainforest.volume.v1';

try {
  enabled = localStorage.getItem(MUTE_KEY) !== '1';
  const v = parseFloat(localStorage.getItem(VOL_KEY));
  if (!Number.isNaN(v)) volume = Math.max(0, Math.min(1, v));
} catch { /* defaults */ }
const level = () => (enabled ? volume : 0);

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
  master.gain.value = level();
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

// Pitch slide (e.g. a falling "wither").
function slide(f0, f1, dur, type = 'sine', vol = 0.3) {
  if (!ctx || !enabled) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.connect(g); g.connect(master);
  const t = ctx.currentTime;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t); o.stop(t + dur + 0.02);
}

// Short filtered noise burst — the "dig" of a trowel in soil.
function thump(vol = 0.5) {
  if (!ctx || !enabled) return;
  const len = Math.floor(ctx.sampleRate * 0.12);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 900;
  const g = ctx.createGain(); g.gain.value = vol;
  src.connect(lp); lp.connect(g); g.connect(master);
  src.start();
}

// High-passed noise swish — water pouring.
function splash(vol = 0.35) {
  if (!ctx || !enabled) return;
  const len = Math.floor(ctx.sampleRate * 0.3);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const hp = ctx.createBiquadFilter();
  hp.type = 'bandpass'; hp.frequency.value = 2200; hp.Q.value = 0.8;
  const g = ctx.createGain(); g.gain.value = vol;
  src.connect(hp); hp.connect(g); g.connect(master);
  src.start();
}

export const sfx = {
  // Planting: a soft dig + a small pop.
  plant() { thump(0.55); setTimeout(() => blip(420, 0.12, 'triangle', 0.3), 40); },
  collect() { blip(340, 0.1, 'sine', 0.26); setTimeout(() => blip(460, 0.1, 'sine', 0.2), 50); },
  unlock() { thump(0.4); blip(440, 0.08, 'square', 0.16); setTimeout(() => blip(660, 0.14, 'square', 0.14), 60); },
  upgrade() { arp([523, 659, 784], 0.16, 'triangle', 0.26); },
  fanfare() { arp([523, 659, 784, 1047], 0.32, 'triangle', 0.3); },
  // A seedling takes root — bright rising chime.
  survive() { arp([660, 880, 1175], 0.16, 'sine', 0.26); },
  // A seedling withers — a sad falling slide.
  wither() { slide(360, 150, 0.45, 'triangle', 0.24); },
  // A plant reaches full size — a light sparkle.
  mature() { arp([1047, 1319, 1568], 0.12, 'triangle', 0.18); },
  // Harvesting a fruit — a juicy pluck.
  harvest() { blip(880, 0.08, 'triangle', 0.26); setTimeout(() => blip(1320, 0.14, 'sine', 0.2), 45); },
  // Watering a thirsty plant — a soft splash.
  water() { splash(); setTimeout(() => blip(620, 0.14, 'sine', 0.16), 80); },
  // Advancing from the stage popup.
  advance() { blip(540, 0.1, 'triangle', 0.26); setTimeout(() => blip(810, 0.22, 'triangle', 0.26), 90); },
};

// Browsers can leave audio suspended (tab switch, autoplay); nudge it awake.
export function resumeAudio() {
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

export function toggleMuted() {
  enabled = !enabled;
  try { localStorage.setItem(MUTE_KEY, enabled ? '0' : '1'); } catch { /* ignore */ }
  if (master && ctx) master.gain.setTargetAtTime(level(), ctx.currentTime, 0.1);
  return enabled;
}
export function isEnabled() { return enabled; }
export function getVolume() { return volume; }
export function setVolume(v) {
  volume = Math.max(0, Math.min(1, v));
  try { localStorage.setItem(VOL_KEY, String(volume)); } catch { /* ignore */ }
  if (master && ctx) master.gain.setTargetAtTime(level(), ctx.currentTime, 0.05);
}
