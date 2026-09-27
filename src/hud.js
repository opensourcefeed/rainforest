// DOM HUD, anchored to the safe area (see #hud in index.html / style.css).
// Built in DOM rather than canvas so tap targets stay crisp and physically
// sized on every screen. Elements opt back into pointer events individually.

export function createHud({ onCollectWater }) {
  const root = document.getElementById('hud');

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

  root.append(water, actions);

  const waterValue = root.querySelector('#hud-water');
  let lastWater = null;

  return {
    update(state) {
      if (state.water !== lastWater) {
        waterValue.textContent = Math.floor(state.water);
        lastWater = state.water;
      }
    },
  };
}
