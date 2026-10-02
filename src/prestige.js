// "Restore the next land" confirmation — complete this world for permanent
// legacy and move the forest on to the next real place. Water and upgrades are
// kept; the restored world stays behind, growing water for you (idle income).
import { prestigeGain, legacyBonus } from './game.js';
import { nextWorldId, worldById } from './world.js';

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
      const here = worldById(state.worldId);
      const nextId = nextWorldId(state.worldId);
      const next = nextId ? worldById(nextId) : null;
      const title = next ? 'Restore the Next Land' : 'Complete the Final Forest';
      const lead = next
        ? `<b>${here.place}</b> is whole again. Carry your seeds on to <b>${next.place}</b>, ${next.region} — and begin anew, <b>stronger</b>.`
        : `<b>${here.place}</b> is whole again — the last of your lands restored. Legacy endures.`;
      const nextBlurb = next ? `<p class="prestige-next">🌏 ${next.place}: ${next.blurb}</p>` : '';
      const goLabel = next ? `Restore ${next.place}` : 'Complete';
      overlay.innerHTML = `
        <div class="prestige-card">
          <div class="prestige-emoji">🌍</div>
          <h2>${title}</h2>
          <p>${lead}</p>
          <div class="prestige-gain">+${gain} 🌿 legacy</div>
          <p class="prestige-detail">Growth &amp; yield bonus <b>+${bonusNow}%</b> → <b>+${bonusAfter}%</b></p>
          ${nextBlurb}
          <p class="prestige-warn">Your water, upgrades and legacy are kept. This forest stays behind, growing water for you.</p>
          <p class="prestige-real">🌱 And somewhere real, plant a tree too — every forest begins with one.</p>
          <div class="prestige-btns">
            <button type="button" class="prestige-cancel">Not yet</button>
            <button type="button" class="prestige-go">${goLabel}</button>
          </div>
        </div>`;
      overlay.hidden = false;
      overlay.querySelector('.prestige-cancel').addEventListener('click', close);
      overlay.querySelector('.prestige-go').addEventListener('click', () => { onConfirm(); close(); });
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    },
  };
}
