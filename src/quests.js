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

  // Build the rows once (structure persists so button clicks work on desktop).
  function render() {
    list.innerHTML = (state.quests || []).map((_, i) => `
      <div class="quest-row">
        <div class="quest-info">
          <div class="quest-text"></div>
          <div class="quest-bar"><i></i></div>
          <div class="quest-prog"></div>
        </div>
        <button type="button" class="quest-claim" data-i="${i}"></button>
      </div>`).join('');
    update();
  }

  // Update values in place each frame — never replaces the buttons.
  function update() {
    (state.quests || []).forEach((q, i) => {
      const row = list.children[i];
      if (!row) return;
      const info = questInfo(state, q);
      row.querySelector('.quest-text').textContent = info.text;
      row.querySelector('.quest-bar > i').style.width = `${Math.round((info.cur / info.goal) * 100)}%`;
      row.querySelector('.quest-prog').textContent = `${info.cur} / ${info.goal}`;
      const btn = row.querySelector('.quest-claim');
      btn.textContent = `+${info.reward} 💧`;
      btn.disabled = !info.done;
      btn.classList.toggle('off', !info.done);
    });
  }

  list.addEventListener('click', (e) => {
    const b = e.target.closest('[data-i]');
    if (!b) return;
    const reward = claimQuest(state, +b.dataset.i);
    if (reward) { if (onClaim) onClaim(reward); update(); }
  });

  return {
    open() { overlay.hidden = false; render(); },
    refresh() { if (!overlay.hidden) update(); },
  };
}
