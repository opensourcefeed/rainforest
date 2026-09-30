// Goals overlay — rotating quests that reward water when completed.
import { questInfo, claimQuest } from './game.js';

export function createQuests(state, onClaim) {
  const overlay = document.createElement('div');
  overlay.className = 'quests';
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="quests-card">
      <div class="quests-head"><h2>Goals</h2><button type="button" class="quests-close" aria-label="Close">✕</button></div>
      <div class="quests-list"></div>
    </div>`;
  document.body.appendChild(overlay);

  const list = overlay.querySelector('.quests-list');
  const close = () => { overlay.hidden = true; };
  overlay.querySelector('.quests-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  function render() {
    list.innerHTML = (state.quests || []).map((q, i) => {
      const info = questInfo(state, q);
      const pct = Math.round((info.cur / info.goal) * 100);
      return `
        <div class="quest-row">
          <div class="quest-info">
            <div class="quest-text">${info.text}</div>
            <div class="quest-bar"><i style="width:${pct}%"></i></div>
            <div class="quest-prog">${info.cur} / ${info.goal}</div>
          </div>
          <button type="button" class="quest-claim${info.done ? '' : ' off'}" data-i="${i}"
            ${info.done ? '' : 'disabled'}>+${info.reward} 💧</button>
        </div>`;
    }).join('');
  }

  list.addEventListener('click', (e) => {
    const b = e.target.closest('[data-i]');
    if (!b) return;
    const reward = claimQuest(state, +b.dataset.i);
    if (reward) { if (onClaim) onClaim(reward); render(); }
  });

  return {
    open() { overlay.hidden = false; render(); },
    refresh() { if (!overlay.hidden) render(); },
  };
}
