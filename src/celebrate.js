// Stage-up celebration modal. Fires once per stage (milestones are guarded by
// stageReached), so it's a memorable payoff, not a nag. The caller pauses the
// game while it's shown and resumes on Continue.
import { sfx } from './sound.js';
import { STAGES, PLANT_TYPES, plantCosmetic } from './game.js';

const FLAVOR = {
  Scrubland: { emoji: '🌵', line: 'Cacti take hold and shade begins to cool the ground.' },
  Grassland: { emoji: '🌾', line: 'Soil deepens; insects and birds return to the land.' },
  'Dry woodland': { emoji: '🌳', line: 'Trees make their own weather — the rains grow steady.' },
  Rainforest: { emoji: '🌴', line: 'A living canopy, rivers and wildlife. The desert is gone.' },
};

// One gameplay tip per stage, teaching the adjacency bonuses as they matter.
const TIPS = {
  Scrubland: 'Seedlings next to established plants survive more often — look for the green dots.',
  Grassland: 'Mix species: a plant with 3+ kinds around it earns extra water (gold dot).',
  'Dry woodland': 'Trees shade their neighbours, so plants beside them grow faster.',
  Rainforest: 'To change a plant, pick 🪏 Remove to dig it out, then plant a better one.',
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

// Per-world "why it matters" lines for the world-complete modal — a different
// real-world reason each world so it never repeats across the four. Kept general
// and verifiable (no invented statistics), per the real-tree framing in CLAUDE.md.
const REAL_WORLD_LINES = {
  thar: 'Real trees push back deserts — their roots bind the soil and their shade cools the ground, exactly as here.',
  sahel: 'In dryland regions, trees bring back water and shelter — a real grove can change a whole community.',
  loess: 'Tree roots hold hillsides together; a planted slope keeps healing for generations.',
  atlantic: 'Forests shelter most life on land — each real tree you plant restores a little of that.',
};
const REAL_WORLD_FALLBACK = 'You restored a whole land here. A real tree you plant will outlive this entire game.';

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
      // Which plant type this stage unlocks (minStage === stage index).
      const stageIdx = STAGES.findIndex((s) => s.name === milestone.name);
      const unlocked = PLANT_TYPES.find((t) => t.minStage === stageIdx);
      const skin = unlocked ? plantCosmetic(unlocked.id) : null;
      const unlockHtml = (unlocked && stageIdx > 0)
        ? `<div class="celebrate-unlock">${skin.emoji} New plant unlocked: <b>${skin.name}</b> · ${unlocked.cost}💧</div>`
        : '';
      overlay.innerHTML = `
        <div class="confetti">${confetti()}</div>
        <div class="celebrate-card">
          <div class="celebrate-emoji">${f.emoji}</div>
          <div class="celebrate-kicker">New stage reached</div>
          <h2 class="celebrate-title">${milestone.name}</h2>
          <p class="celebrate-line">${f.line}</p>
          ${TIPS[milestone.name] ? `<p class="celebrate-tip">💡 ${TIPS[milestone.name]}</p>` : ''}
          ${unlockHtml}
          <div class="celebrate-reward">Reward: +${milestone.bonus} 💧</div>
          <div class="celebrate-real"><span>🌱 In the real world</span>${real}</div>
          <button type="button" class="celebrate-btn">Continue</button>
        </div>`;
      overlay.hidden = false;
      sfx.fanfare();
      const btn = overlay.querySelector('.celebrate-btn');
      btn.addEventListener('click', () => {
        sfx.advance();
        overlay.hidden = true;
        overlay.innerHTML = '';
        onContinue();
      }, { once: true });
    },

    // World complete — the climax of a world, reached automatically when it hits
    // Rainforest. This single modal BOTH celebrates the restored land AND offers
    // the next step (no separate confirm-then-celebrate pair): the primary button
    // performs the restoration and carries on; "Stay a while" dismisses so the
    // player can keep growing this land (more legacy / income when they do commit).
    //
    // `info` is built by main.js (projected, since nothing has happened yet):
    //   { worldId, restoredPlace, income, gain, bonusNow, bonusAfter,
    //     nextPlace, nextRegion, nextBlurb }   (next* null on the final world).
    // `handlers` = { onConfirm, onStay, onGrove }. onGrove opens the Real Grove
    // on top of (not dismissing) this modal, so the carry-on choice remains.
    showComplete(info, { onConfirm, onStay, onGrove }) {
      const hasNext = !!info.nextPlace;
      const realLine = REAL_WORLD_LINES[info.worldId] || REAL_WORLD_FALLBACK;
      const nextHtml = hasNext
        ? `<div class="celebrate-unlock">🌏 Next land: <b>${info.nextPlace}</b>, ${info.nextRegion}
             <br><small>${info.nextBlurb}</small></div>`
        : `<div class="celebrate-unlock">🌏 <b>The last land.</b> Restore it and the planet is green again.</div>`;
      overlay.innerHTML = `
        <div class="confetti">${confetti()}</div>
        <div class="celebrate-card">
          <div class="celebrate-emoji">🌍</div>
          <div class="celebrate-kicker">This land is whole</div>
          <h2 class="celebrate-title">${info.restoredPlace}</h2>
          <p class="celebrate-line">You brought a whole land back to life.</p>
          <p class="celebrate-tip">🌱 Restore it and it keeps growing water on its own · +${info.income.toFixed(1)}/s 💧</p>
          ${nextHtml}
          <div class="celebrate-reward">+${info.gain} 🌿 legacy · growth &amp; yield +${info.bonusNow}% → +${info.bonusAfter}%</div>
          <div class="celebrate-real">
            <span>🌱 In the real world</span>${realLine}
            <button type="button" class="celebrate-grove">See the Real Grove 🌍</button>
          </div>
          <div class="celebrate-btns">
            <button type="button" class="celebrate-stay">Stay a while</button>
            <button type="button" class="celebrate-btn celebrate-go">${hasNext ? `Carry on to ${info.nextPlace}` : 'Restore the final forest'}</button>
          </div>
        </div>`;
      overlay.hidden = false;
      sfx.fanfare();
      const dismiss = () => { overlay.hidden = true; overlay.innerHTML = ''; };
      overlay.querySelector('.celebrate-go').addEventListener('click', () => {
        sfx.advance();
        dismiss();
        onConfirm();
      }, { once: true });
      overlay.querySelector('.celebrate-stay').addEventListener('click', () => {
        dismiss();
        onStay();
      }, { once: true });
      // Opens the grove over this modal (grove sheet z-index is above it); the
      // completion modal stays so the player still chooses carry-on / stay after.
      overlay.querySelector('.celebrate-grove').addEventListener('click', () => {
        if (onGrove) onGrove();
      });
    },
  };
}
