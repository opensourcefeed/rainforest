// Title / start screen shown over the game on every launch. It gives the game
// a front door, a moment to "load", and (on later platforms) the first user tap
// needed to unlock audio. On resume it notes that idle progress was applied.

function awayText(seconds) {
  if (!seconds || seconds < 60) return '';
  const mins = Math.round(seconds / 60);
  const label = mins < 60 ? `${mins} min` : `${Math.round(mins / 60)} h`;
  return `<p class="boot-away">While you were away (${label}), your grove kept growing 🌱</p>`;
}

// Shows the title screen. Calls onStart() once the player taps Start.
export function initBoot(state, onStart) {
  const hasSave = (state.offlineSeconds || 0) > 0;
  const el = document.createElement('div');
  el.className = 'boot';
  el.innerHTML = `
    <div class="boot-inner">
      <div class="boot-logo">🌵 → 🌳</div>
      <h1 class="boot-title">Rainforest</h1>
      <p class="boot-sub">Bring a desert back to life</p>
      ${awayText(state.offlineSeconds)}
      <button type="button" class="boot-btn">${hasSave ? 'Continue' : 'Start'}</button>
    </div>`;

  const start = () => {
    el.classList.add('boot-hide');
    setTimeout(() => el.remove(), 350); // let the fade finish
    onStart();
  };
  el.querySelector('.boot-btn').addEventListener('click', start);
  document.body.appendChild(el);
}
