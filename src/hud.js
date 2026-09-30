// DOM HUD, anchored to the safe area (see #hud in index.html / style.css).
// Built in DOM rather than canvas so tap targets stay crisp and physically
// sized on every screen. Elements opt back into pointer events individually.

import { currentStage, stageProgress, livingCount, waterRate, availableTypes } from './game.js';

export function createHud({ onCollectWater, onSelectType }) {
  const root = document.getElementById('hud');

  const stage = document.createElement('div');
  stage.className = 'hud-stage';
  stage.id = 'hud-stage';

  // Always-on ecosystem panel: the three meters + progress to the next stage.
  // This is what makes the player see that living plants are healing the land.
  const eco = document.createElement('div');
  eco.className = 'hud-eco';
  eco.innerHTML = `
    <div class="eco-row"><span class="eco-label">Soil</span><div class="eco-bar"><i data-m="soil"></i></div></div>
    <div class="eco-row"><span class="eco-label">Shade</span><div class="eco-bar"><i data-m="shade"></i></div></div>
    <div class="eco-row"><span class="eco-label">Humidity</span><div class="eco-bar"><i data-m="humidity"></i></div></div>
    <div class="eco-goal"><span id="eco-goal-label">Progress</span><span class="eco-goal-pct" id="eco-goal-pct">0%</span></div>`;

  const water = document.createElement('div');
  water.className = 'hud-stat';
  water.innerHTML = `<span class="hud-icon">💧</span><span class="hud-value" id="hud-water">0</span>`
    + `<span class="hud-rate" id="hud-rate"></span>`;

  const living = document.createElement('div');
  living.className = 'hud-stat hud-stat-living';
  living.innerHTML = `<span class="hud-icon">🌱</span><span class="hud-value" id="hud-living">0</span>`;

  // Plant-type selector — the chosen type is what a soil tap plants. New tiers
  // appear here as stages unlock. Click delegation set once.
  const types = document.createElement('div');
  types.className = 'hud-types';
  types.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-type]');
    if (btn) onSelectType(btn.dataset.type);
  });

  // Persistent one-line reminder of the core action.
  const hint = document.createElement('div');
  hint.className = 'hud-hint';
  hint.textContent = 'Tap empty soil to plant · tap locked desert to expand';

  const actions = document.createElement('div');
  actions.className = 'hud-actions';

  const collect = document.createElement('button');
  collect.className = 'hud-btn';
  collect.type = 'button';
  collect.textContent = 'Collect water';
  collect.addEventListener('click', onCollectWater);
  actions.appendChild(collect);

  root.append(stage, eco, water, living, types, hint, actions);

  const waterValue = root.querySelector('#hud-water');
  const rateValue = root.querySelector('#hud-rate');
  const livingValue = root.querySelector('#hud-living');
  const stageEl = root.querySelector('#hud-stage');
  const bars = {
    soil: eco.querySelector('[data-m="soil"]'),
    shade: eco.querySelector('[data-m="shade"]'),
    humidity: eco.querySelector('[data-m="humidity"]'),
  };
  const goalLabel = eco.querySelector('#eco-goal-label');
  const goalPct = eco.querySelector('#eco-goal-pct');
  let lastWater = null;
  let lastRate = null;
  let lastLiving = null;
  let lastStage = -1;
  let lastTypeCount = 0;

  function rebuildTypes(avail) {
    types.innerHTML = avail.map((t) => `
      <button type="button" data-type="${t.id}">
        <span class="t-name">${t.name}</span><span class="t-cost">${t.cost}💧</span>
      </button>`).join('');
    lastTypeCount = avail.length;
  }

  return {
    update(state) {
      const shownWater = Math.floor(state.water);
      if (shownWater !== lastWater) {
        waterValue.textContent = shownWater;
        lastWater = shownWater;
      }

      // Income rate (only worth showing once the grove produces).
      const rate = waterRate(state);
      const shownRate = rate >= 0.1 ? `+${rate.toFixed(1)}/s` : '';
      if (shownRate !== lastRate) {
        rateValue.textContent = shownRate;
        lastRate = shownRate;
      }

      const living = livingCount(state);
      if (living !== lastLiving) {
        livingValue.textContent = living;
        lastLiving = living;
      }

      // Meter bars.
      bars.soil.style.width = (state.meters.soil * 100).toFixed(1) + '%';
      bars.shade.style.width = (state.meters.shade * 100).toFixed(1) + '%';
      bars.humidity.style.width = (state.meters.humidity * 100).toFixed(1) + '%';

      // Plant-type selector: rebuild when a new tier unlocks, then reflect the
      // current selection and affordability.
      const avail = availableTypes(state);
      if (avail.length !== lastTypeCount) rebuildTypes(avail);
      for (const btn of types.children) {
        const t = avail.find((x) => x.id === btn.dataset.type);
        btn.classList.toggle('sel', btn.dataset.type === state.selectedType);
        btn.classList.toggle('poor', !!t && state.water < t.cost);
      }

      // Progress to next stage.
      const prog = stageProgress(state);
      goalLabel.textContent = prog.nextName ? `Next: ${prog.nextName}` : 'Fully grown';
      goalPct.textContent = Math.round(prog.pct * 100) + '%';

      const s = currentStage(state);
      if (s.index !== lastStage) {
        stageEl.textContent = s.name;
        // Briefly flash on change to mark the transition.
        stageEl.classList.remove('flash');
        void stageEl.offsetWidth; // restart the animation
        stageEl.classList.add('flash');
        lastStage = s.index;
      }
    },
  };
}
