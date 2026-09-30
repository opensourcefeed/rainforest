// First-run story. A quiet, evolving scene — the desert greens as the narration
// unfolds — that sets the heart of the game before the player begins. Shown once
// (localStorage-guarded, try/catch per the storage rules).
const SEEN_KEY = 'rainforest.seenIntro.v1';

function alreadySeen() {
  try { return localStorage.getItem(SEEN_KEY) === '1'; } catch { return false; }
}
function markSeen() {
  try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ }
}

const PANELS = [
  'Years after the world dried up, one man remained —\nalone beneath an endless sky.',
  'He had almost nothing. A little water,\na handful of stubborn seeds. Most would never grow.',
  'Still, each morning he knelt in the cracked earth,\nand planted. And waited.',
  'Slowly, the impossible began.\nA shoot. Then shade. Then — one day — rain.',
  'Grain by grain, he is bringing a forest back to life.\nNow the seeds are in your hands.',
];

export function initOnboarding() {
  if (alreadySeen()) return;

  const overlay = document.createElement('div');
  overlay.className = 'story';
  overlay.dataset.step = '0';
  overlay.innerHTML = `
    <div class="story-scene" aria-hidden="true">
      <div class="story-sun"></div>
      <div class="story-ground"></div>
      <div class="story-tree"><i class="trunk"></i><i class="crown"></i></div>
      <div class="story-man"></div>
    </div>
    <div class="story-panel">
      <p class="story-text"></p>
      <div class="story-nav">
        <button class="story-skip" type="button">Skip</button>
        <div class="story-dots">${PANELS.map(() => '<span></span>').join('')}</div>
        <button class="story-next" type="button">Next</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const textEl = overlay.querySelector('.story-text');
  const dots = [...overlay.querySelectorAll('.story-dots span')];
  const nextBtn = overlay.querySelector('.story-next');
  let i = -1;

  function finish() {
    markSeen();
    overlay.classList.add('story-out');
    setTimeout(() => overlay.remove(), 520);
  }
  function go(n) {
    if (n >= PANELS.length) { finish(); return; }
    i = n;
    overlay.dataset.step = String(i);
    textEl.classList.remove('in');
    void textEl.offsetWidth; // restart fade
    textEl.textContent = PANELS[i];
    textEl.classList.add('in');
    dots.forEach((d, k) => d.classList.toggle('on', k <= i));
    nextBtn.textContent = i === PANELS.length - 1 ? 'Begin your forest' : 'Next';
  }

  nextBtn.addEventListener('click', () => go(i + 1));
  overlay.querySelector('.story-skip').addEventListener('click', finish);
  go(0);
}
