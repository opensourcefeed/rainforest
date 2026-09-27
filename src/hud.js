// DOM HUD, anchored to the safe area (see #hud in index.html / style.css).
// Built in DOM rather than canvas so tap targets stay crisp and physically
// sized on every screen. Elements opt back into pointer events individually.

import { currentStage } from './game.js';

export function createHud({ onCollectWater }) {
  const root = document.getElementById('hud');

  const stage = document.createElement('div');
  stage.className = 'hud-stage';
  stage.id = 'hud-stage';

  const water = document.createElement('div');
  water.className = 'hud-stat';
  water.innerHTML = `<span class="hud-icon">💧</span><span class="hud-value" id="hud-water">0</span>`;

  const actions = document.createElement('div');
  actions.className = 'hud-actions';

  const collect = document.createElement('button');
  collect.className = 'hud-btn';
  collect.type = 'button';
  collect.textContent = 'Collect water';
  collect.addEventListener('click', onCollectWater);
  actions.appendChild(collect);

  root.append(stage, water, actions);

  const waterValue = root.querySelector('#hud-water');
  const stageEl = root.querySelector('#hud-stage');
  let lastWater = null;
  let lastStage = -1;

  return {
    update(state) {
      if (state.water !== lastWater) {
        waterValue.textContent = Math.floor(state.water);
        lastWater = state.water;
      }
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
