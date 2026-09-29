// First-run explainer. The mechanics are opaque without a word of framing:
// what water is for, that early death is expected, and that living plants are
// what drives progress. Shown once (localStorage-guarded, try/catch per the
// storage rules — it must never break the game).
const SEEN_KEY = 'rainforest.seenIntro.v1';

function alreadySeen() {
  try { return localStorage.getItem(SEEN_KEY) === '1'; } catch { return false; }
}
function markSeen() {
  try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ }
}

export function initOnboarding() {
  if (alreadySeen()) return;

  const overlay = document.createElement('div');
  overlay.className = 'intro';
  overlay.innerHTML = `
    <div class="intro-card">
      <h1>Grow a rainforest</h1>
      <p>You're alone in a barren desert with a little water and a few hardy seeds.</p>
      <ul>
        <li><b>Tap the soil plots</b> to plant a seed (costs 💧 water).</li>
        <li><b>Most seeds die at first</b> — that's expected, not failure.</li>
        <li>Every plant that <b>lives</b> heals the land: soil, shade, humidity.</li>
        <li>Greener land keeps <b>more</b> seeds alive. Tap <b>Collect water</b> for more 💧.</li>
      </ul>
      <p class="intro-goal">Bring the desert back to life.</p>
      <button type="button" class="intro-btn">Start planting</button>
    </div>`;

  const dismiss = () => { markSeen(); overlay.remove(); };
  overlay.querySelector('.intro-btn').addEventListener('click', dismiss);
  document.body.appendChild(overlay);
}
