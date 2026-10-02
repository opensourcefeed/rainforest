// The Real Grove — real trees planted by the developer, loaded from a JSON file
// published next to the game (update it without shipping a new version).
//
// grove.json format:
// { "updated": "YYYY-MM-DD", "trees": [
//   { "species": "...", "planted": "YYYY-MM-DD", "location": "approx. place",
//     "photo": "grove/xyz.jpg", "note": "optional survival update" } ] }
import { GROVE_URL } from './config.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g,
  (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

export function createGrove() {
  const overlay = document.createElement('div');
  overlay.className = 'shop grove';
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="shop-card">
      <div class="shop-head">
        <h2>The Real Grove 🌍</h2>
        <button type="button" class="shop-close" aria-label="Close">✕</button>
      </div>
      <p class="grove-intro">Real trees, planted in real ground by the developer as this game grows.</p>
      <div class="grove-list"></div>
    </div>`;
  document.body.appendChild(overlay);
  const list = overlay.querySelector('.grove-list');
  const close = () => { overlay.hidden = true; };
  overlay.querySelector('.shop-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  function render(data) {
    const trees = (data && Array.isArray(data.trees)) ? data.trees : [];
    if (!trees.length) {
      list.innerHTML = `<div class="grove-empty">🌱<p>The real grove is being documented.<br>Check back soon to see each tree.</p></div>`;
      return;
    }
    // Impact header — the grove's at-a-glance story: how many real trees, how
    // many species, when last updated, with a small growing-grove visual.
    const count = trees.length;
    const species = new Set(trees.map((t) => (t.species || '').trim()).filter(Boolean)).size;
    const updated = data.updated ? `updated ${esc(data.updated)}` : '';
    const glyphs = Array.from({ length: Math.min(count, 14) }, () => '🌳').join('');
    const more = count > 14 ? `<span class="grove-hero-more">+${count - 14}</span>` : '';
    const metaBits = [species ? `${species} species` : '', updated].filter(Boolean).join(' · ');
    const hero = `
      <div class="grove-hero">
        <div class="grove-hero-visual">${glyphs}${more}</div>
        <div class="grove-hero-num">${count}</div>
        <div class="grove-hero-label">real tree${count > 1 ? 's' : ''} planted in real ground</div>
        ${metaBits ? `<div class="grove-hero-meta">${metaBits}</div>` : ''}
      </div>`;
    list.innerHTML = hero
      + trees.map((t) => `
        <div class="grove-card">
          ${t.photo ? `<img src="${esc(t.photo)}" alt="${esc(t.species)}" loading="lazy">` : '<div class="grove-ph">🌳</div>'}
          <div class="grove-info">
            <b>${esc(t.species || 'Tree')}</b>
            ${t.planted ? `<span>Planted ${esc(t.planted)}</span>` : ''}
            ${t.location ? `<span>📍 ${esc(t.location)}</span>` : ''}
            ${t.note ? `<small>${esc(t.note)}</small>` : ''}
          </div>
        </div>`).join('');
  }

  return {
    open() {
      overlay.hidden = false;
      list.innerHTML = '<div class="grove-empty"><p>Loading…</p></div>';
      fetch(GROVE_URL, { cache: 'no-cache' })
        .then((r) => (r.ok ? r.json() : null))
        .then(render)
        .catch(() => {
          list.innerHTML = '<div class="grove-empty"><p>Couldn’t load the grove right now.<br>Check your connection and try again.</p></div>';
        });
    },
  };
}
