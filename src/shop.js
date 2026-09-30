// Upgrades shop overlay — spend water on permanent boosts, and (once eligible)
// "plant a new forest" for permanent legacy.
import { UPGRADES, upgradeLevel, upgradeCost, buyUpgrade, canPrestige, prestigeGain, legacyBonus } from './game.js';

export function createShop(state, onBuy, onPrestige) {
  const overlay = document.createElement('div');
  overlay.className = 'shop';
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="shop-card">
      <div class="shop-head">
        <h2>Upgrades</h2>
        <div class="shop-water">💧 <span id="shop-water">0</span></div>
        <div class="shop-legacy" title="Legacy: permanent growth &amp; yield boost">🌿 <span id="shop-legacy">0</span></div>
        <button type="button" class="shop-close" aria-label="Close">✕</button>
      </div>
      <div class="shop-list"></div>
    </div>`;
  document.body.appendChild(overlay);

  const list = overlay.querySelector('.shop-list');
  const waterEl = overlay.querySelector('#shop-water');
  const legacyEl = overlay.querySelector('#shop-legacy');
  const close = () => { overlay.hidden = true; };
  overlay.querySelector('.shop-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  let lastEligible = null;

  // Build the structure once (persists so buttons stay clickable on desktop).
  function render() {
    lastEligible = canPrestige(state);
    const prestigeCard = lastEligible ? `
      <button type="button" class="prestige-card-btn" id="shop-prestige">
        <span class="pc-ic">🌳</span>
        <span class="pc-info"><b>Plant a New Forest</b><small id="shop-pc-sub"></small></span>
        <span class="pc-go">→</span>
      </button>` : '';
    list.innerHTML = prestigeCard + UPGRADES.map((u) => {
      const pips = Array.from({ length: u.max }, () => '<i></i>').join('');
      return `
        <div class="shop-row" data-uid="${u.id}">
          <div class="shop-ic">${u.icon}</div>
          <div class="shop-info">
            <div class="shop-name">${u.name}</div>
            <div class="shop-desc">${u.desc}</div>
            <div class="shop-pips">${pips}</div>
          </div>
          <button type="button" class="shop-buy" data-id="${u.id}"></button>
        </div>`;
    }).join('');
    update();
  }

  // Update values in place each frame — never replaces the buttons.
  function update() {
    waterEl.textContent = Math.floor(state.water);
    legacyEl.textContent = state.legacy || 0;
    if (canPrestige(state) !== lastEligible) { render(); return; } // eligibility flipped
    const sub = list.querySelector('#shop-pc-sub');
    if (sub) sub.textContent = `Reset for +${prestigeGain(state)} 🌿 legacy (permanent boost)`;
    for (const u of UPGRADES) {
      const row = list.querySelector(`[data-uid="${u.id}"]`);
      if (!row) continue;
      const lvl = upgradeLevel(state, u.id);
      const maxed = lvl >= u.max;
      const cost = upgradeCost(state, u.id);
      const afford = !maxed && state.water >= cost;
      row.querySelectorAll('.shop-pips i').forEach((p, k) => p.classList.toggle('on', k < lvl));
      const btn = row.querySelector('.shop-buy');
      btn.textContent = maxed ? 'MAX' : `${cost} 💧`;
      btn.disabled = maxed || !afford;
      btn.classList.toggle('off', !afford);
    }
  }

  list.addEventListener('click', (e) => {
    if (e.target.closest('#shop-prestige')) { close(); if (onPrestige) onPrestige(); return; }
    const b = e.target.closest('[data-id]');
    if (b && buyUpgrade(state, b.dataset.id)) { if (onBuy) onBuy(); update(); }
  });

  return {
    open() { overlay.hidden = false; render(); },
    isOpen() { return !overlay.hidden; },
    refresh() { if (!overlay.hidden) update(); }, // reflect rising water/affordability
  };
}
