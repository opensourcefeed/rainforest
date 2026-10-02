// The World Map — a hub listing every real-world place in the restoration
// chain. Restored worlds keep producing water (idle income); you can tap any
// world you've reached to switch to it and tend it. Locked worlds show what
// unlocks them. Ties the progression to the real-tree mission.
import { WORLDS } from './world.js';
import { STAGES, legacyBonus, worldIncome } from './game.js';

const BIOME_ICON = { desert: '🏜️', savanna: '🌾', highland: '⛰️', tropical: '🌴' };

function avgOf(meters) {
  const m = meters || {};
  return ((m.soil || 0) + (m.shade || 0) + (m.humidity || 0)) / 3;
}
function stageName(avg) {
  let i = 0;
  for (let k = 0; k < STAGES.length; k++) if (avg >= STAGES[k].min) i = k;
  return STAGES[i].name;
}

export function createWorldMap(state, { onSwitch, onOpenGrove } = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'shop worldmap';
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="shop-card">
      <div class="shop-head">
        <h2>Worlds 🗺️</h2>
        <button type="button" class="shop-close" aria-label="Close">✕</button>
      </div>
      <p class="wm-intro">Each world is a real place you bring back to life. A land you've
        restored keeps growing water for you — just as every real tree keeps growing once
        it's in the ground.</p>
      <div class="wm-list"></div>
      <button type="button" class="wm-grove">🌱 The Real Grove</button>
    </div>`;
  document.body.appendChild(overlay);

  const list = overlay.querySelector('.wm-list');
  const close = () => { overlay.hidden = true; };
  overlay.querySelector('.shop-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('.wm-grove').addEventListener('click', () => { close(); if (onOpenGrove) onOpenGrove(); });

  list.addEventListener('click', (e) => {
    const card = e.target.closest('[data-world]');
    if (!card || card.classList.contains('locked') || card.classList.contains('active')) return;
    const id = card.dataset.world;
    close();
    if (onSwitch) onSwitch(id);
  });

  function render() {
    const worlds = state.worlds || {};
    const lb = legacyBonus(state);
    let prevReached = true; // the first world is always reachable
    list.innerHTML = WORLDS.map((w) => {
      const active = w.id === state.worldId;
      const snap = worlds[w.id];
      const reached = active || !!snap;
      // A world is "restored" if its snapshot (or the live active world) is dated.
      const restoredDate = active ? state.restoredDate : (snap && snap.restoredDate);
      const icon = BIOME_ICON[w.biome] || '🌍';

      let cls = 'wm-card', status;
      if (!reached) {
        cls += ' locked';
        const prev = WORLDS[WORLDS.indexOf(w) - 1];
        status = prevReached && prev
          ? `🔒 Restore ${prev.place} to unlock`
          : '🔒 Locked';
      } else if (restoredDate) {
        const inc = worldIncome(active ? liveSnap(state) : snap, lb);
        status = `✓ Restored ${restoredDate} · +${inc.toFixed(1)}/s 💧`;
        cls += active ? ' active' : ' switch';
      } else {
        const avg = active ? avgOf(state.meters) : avgOf(snap && snap.meters);
        const pct = Math.round(avg * 100);
        status = active ? `Now tending · ${stageName(avg)} (${pct}%)`
                        : `In progress · ${stageName(avg)} (${pct}%)`;
        cls += active ? ' active' : ' switch';
      }
      prevReached = reached;

      const tag = active ? '<span class="wm-tag">Here</span>'
                : (reached ? '<span class="wm-go">Tend →</span>' : '');
      return `
        <div class="${cls}" data-world="${w.id}">
          <span class="wm-ic">${icon}</span>
          <span class="wm-info">
            <b>${w.place}</b> <small>${w.region}</small>
            <span class="wm-status">${status}</span>
          </span>
          ${tag}
        </div>`;
    }).join('');
  }

  return {
    open() { render(); overlay.hidden = false; },
    isOpen() { return !overlay.hidden; },
  };
}

// The active world's live fields as an income-shaped snapshot (plots + date),
// so a restored active world shows its live rate on the map.
function liveSnap(state) {
  return { restoredDate: state.restoredDate, plots: state.plots };
}
