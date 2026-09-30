// Stage-up celebration modal. Fires once per stage (milestones are guarded by
// stageReached), so it's a memorable payoff, not a nag. The caller pauses the
// game while it's shown and resumes on Continue.

const FLAVOR = {
  Scrubland: { emoji: '🌵', line: 'Cacti take hold and shade begins to cool the ground.' },
  Grassland: { emoji: '🌾', line: 'Soil deepens; insects and birds return to the land.' },
  'Dry woodland': { emoji: '🌳', line: 'Trees make their own weather — the rains grow steady.' },
  Rainforest: { emoji: '🌴', line: 'A living canopy, rivers and wildlife. The desert is gone.' },
};

const CONFETTI_COLORS = ['#f9c74f', '#90be6d', '#43aa8b', '#4d96ff', '#f94144', '#f3722c'];

// A gentle real-world nudge shown on each stage — this forest is a game, but a
// real one grows the same way. Keyed to the stage so it's consistent, not preachy.
const REAL_LINES = {
  Scrubland: 'A real forest grows the same way — one tree at a time. Plant one this week.',
  Grassland: 'Somewhere near you, real ground is waiting for a tree. Will you plant it?',
  'Dry woodland': 'Every tree you plant in real life will outlive this whole game. 🌍',
  Rainforest: 'You brought this forest back. Now go plant a real tree — even one matters.',
};

function confetti() {
  let html = '';
  for (let i = 0; i < 16; i++) {
    const left = Math.round(Math.random() * 100);
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    const delay = (Math.random() * 0.5).toFixed(2);
    const dur = (1.6 + Math.random() * 1.2).toFixed(2);
    const rot = Math.round(Math.random() * 360);
    html += `<span class="confetti-piece" style="left:${left}%;background:${color};`
      + `animation-delay:${delay}s;animation-duration:${dur}s;transform:rotate(${rot}deg)"></span>`;
  }
  return html;
}

export function createCelebration({ onContinue }) {
  const overlay = document.createElement('div');
  overlay.className = 'celebrate';
  overlay.hidden = true;
  document.body.appendChild(overlay);

  return {
    show(milestone) {
      const f = FLAVOR[milestone.name] || { emoji: '🌱', line: 'The land grows greener.' };
      const real = REAL_LINES[milestone.name] || 'Plant a real tree today — it outlives every game.';
      overlay.innerHTML = `
        <div class="confetti">${confetti()}</div>
        <div class="celebrate-card">
          <div class="celebrate-emoji">${f.emoji}</div>
          <div class="celebrate-kicker">New stage reached</div>
          <h2 class="celebrate-title">${milestone.name}</h2>
          <p class="celebrate-line">${f.line}</p>
          <div class="celebrate-reward">Reward: +${milestone.bonus} 💧</div>
          <div class="celebrate-real"><span>🌱 In the real world</span>${real}</div>
          <button type="button" class="celebrate-btn">Continue</button>
        </div>`;
      overlay.hidden = false;
      const btn = overlay.querySelector('.celebrate-btn');
      btn.addEventListener('click', () => {
        overlay.hidden = true;
        overlay.innerHTML = '';
        onContinue();
      }, { once: true });
    },
  };
}
