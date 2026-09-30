// "Plant a New Forest" confirmation — the prestige reset for permanent legacy.
import { prestigeGain, legacyBonus } from './game.js';

export function createPrestige(state, onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'prestige';
  overlay.hidden = true;
  document.body.appendChild(overlay);
  const close = () => { overlay.hidden = true; overlay.innerHTML = ''; };

  return {
    show() {
      const gain = prestigeGain(state);
      const cur = state.legacy || 0;
      const bonusNow = Math.round((legacyBonus(state) - 1) * 100);
      const bonusAfter = Math.round(((1 + (cur + gain) * 0.03) - 1) * 100);
      overlay.innerHTML = `
        <div class="prestige-card">
          <div class="prestige-emoji">🌳</div>
          <h2>Plant a New Forest</h2>
          <p>This forest is thriving. Carry its seeds to fresh ground and begin again — <b>stronger</b>.</p>
          <div class="prestige-gain">+${gain} 🌿 legacy</div>
          <p class="prestige-detail">Growth &amp; yield bonus <b>+${bonusNow}%</b> → <b>+${bonusAfter}%</b></p>
          <p class="prestige-warn">Your plants, land, upgrades and stage reset. Legacy is kept forever.</p>
          <p class="prestige-real">🌍 And somewhere real, plant a tree too — every forest begins with one.</p>
          <div class="prestige-btns">
            <button type="button" class="prestige-cancel">Not yet</button>
            <button type="button" class="prestige-go">Plant new forest</button>
          </div>
        </div>`;
      overlay.hidden = false;
      overlay.querySelector('.prestige-cancel').addEventListener('click', close);
      overlay.querySelector('.prestige-go').addEventListener('click', () => { onConfirm(); close(); });
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    },
  };
}
