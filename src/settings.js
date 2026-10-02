// Settings sheet — sound, volume, replay the story, reset the forest, about.
import { isEnabled, toggleMuted, getVolume, setVolume } from './sound.js';

export function createSettings({ onReplayStory, onReset }) {
  const overlay = document.createElement('div');
  overlay.className = 'shop settings';
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="shop-card">
      <div class="shop-head">
        <h2>Settings</h2>
        <button type="button" class="shop-close" aria-label="Close">✕</button>
      </div>
      <div class="set-list">
        <div class="set-row">
          <span>Sound</span>
          <button type="button" class="set-toggle" id="set-sound"></button>
        </div>
        <div class="set-row">
          <span>Volume</span>
          <input type="range" min="0" max="100" id="set-volume" aria-label="Volume">
        </div>
        <button type="button" class="set-btn" id="set-story">Replay the story</button>
        <button type="button" class="set-btn set-danger" id="set-reset">Reset forest</button>
        <p class="set-about">Rainforest · a Tahrik Studio game about bringing the desert back to life, one tree at a time.</p>
        <p class="set-version" id="set-version">Version —</p>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const soundBtn = overlay.querySelector('#set-sound');
  const vol = overlay.querySelector('#set-volume');
  const resetBtn = overlay.querySelector('#set-reset');
  const versionEl = overlay.querySelector('#set-version');
  let resetArmed = null;

  // Deploy stamps version.json (commit + date) into the published site; show it
  // so the deployed build is identifiable. Absent locally → "dev build".
  function loadVersion() {
    versionEl.textContent = 'Version · checking…';
    fetch('version.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((v) => {
        versionEl.textContent = (v && v.commit)
          ? `Version ${v.date || ''} · ${v.commit}`.replace('  ', ' ')
          : 'Dev build (unreleased)';
      })
      .catch(() => { versionEl.textContent = 'Dev build (unreleased)'; });
  }

  const close = () => { overlay.hidden = true; disarm(); };
  const sync = () => {
    soundBtn.textContent = isEnabled() ? 'On' : 'Off';
    soundBtn.classList.toggle('on', isEnabled());
    vol.value = Math.round(getVolume() * 100);
  };
  function disarm() {
    clearTimeout(resetArmed);
    resetArmed = null;
    resetBtn.textContent = 'Reset forest';
    resetBtn.classList.remove('armed');
  }

  overlay.querySelector('.shop-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  soundBtn.addEventListener('click', () => { toggleMuted(); sync(); });
  vol.addEventListener('input', () => setVolume(vol.value / 100));
  overlay.querySelector('#set-story').addEventListener('click', () => { close(); onReplayStory(); });
  // Two-step reset so it can't happen by accident.
  resetBtn.addEventListener('click', () => {
    if (!resetArmed) {
      resetBtn.textContent = 'Tap again to erase everything';
      resetBtn.classList.add('armed');
      resetArmed = setTimeout(disarm, 3500);
      return;
    }
    disarm();
    onReset();
  });

  return { open() { sync(); loadVersion(); overlay.hidden = false; } };
}
