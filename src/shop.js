// Upgrades shop overlay — spend water on permanent boosts.
import { UPGRADES, upgradeLevel, upgradeCost, buyUpgrade } from './game.js';

export function createShop(state) {
  const overlay = document.createElement('div');
  overlay.className = 'shop';
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="shop-card">
      <div class="shop-head">
        <h2>Upgrades</h2>
        <div class="shop-water">💧 <span id="shop-water">0</span></div>
        <button type="button" class="shop-close" aria-label="Close">✕</button>
      </div>
      <div class="shop-list"></div>
    </div>`;
  document.body.appendChild(overlay);

  const list = overlay.querySelector('.shop-list');
  const waterEl = overlay.querySelector('#shop-water');
  const close = () => { overlay.hidden = true; };
  overlay.querySelector('.shop-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  function render() {
    waterEl.textContent = Math.floor(state.water);
    list.innerHTML = UPGRADES.map((u) => {
      const lvl = upgradeLevel(state, u.id);
      const maxed = lvl >= u.max;
      const cost = upgradeCost(state, u.id);
      const afford = !maxed && state.water >= cost;
      const pips = Array.from({ length: u.max }, (_, k) =>
        `<i class="${k < lvl ? 'on' : ''}"></i>`).join('');
      return `
        <div class="shop-row">
          <div class="shop-ic">${u.icon}</div>
          <div class="shop-info">
            <div class="shop-name">${u.name}</div>
            <div class="shop-desc">${u.desc}</div>
            <div class="shop-pips">${pips}</div>
          </div>
          <button type="button" class="shop-buy${afford ? '' : ' off'}" data-id="${u.id}"
            ${maxed || !afford ? 'disabled' : ''}>${maxed ? 'MAX' : `${cost} 💧`}</button>
        </div>`;
    }).join('');
  }

  list.addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]');
    if (b && buyUpgrade(state, b.dataset.id)) render();
  });

  return {
    open() { overlay.hidden = false; render(); },
    isOpen() { return !overlay.hidden; },
    refresh() { if (!overlay.hidden) render(); }, // reflect rising water/affordability
  };
}
