// Daily gift popup — reuses the celebration card styling.
import { sfx } from './sound.js';

export function showDaily({ streak, gift }, onClose) {
  const overlay = document.createElement('div');
  overlay.className = 'celebrate';
  const days = Array.from({ length: 7 }, (_, i) =>
    `<i class="${i < Math.min(streak, 7) ? 'on' : ''}"></i>`).join('');
  overlay.innerHTML = `
    <div class="celebrate-card">
      <div class="celebrate-emoji">🎁</div>
      <div class="celebrate-kicker">Daily gift</div>
      <h2 class="celebrate-title">Day ${streak}</h2>
      <div class="daily-dots">${days}</div>
      <div class="celebrate-reward">+${gift} 💧</div>
      <p class="celebrate-line">Come back tomorrow to grow your streak — the gift grows with it.</p>
      <button type="button" class="celebrate-btn">Collect</button>
    </div>`;
  document.body.appendChild(overlay);
  sfx.upgrade();
  overlay.querySelector('.celebrate-btn').addEventListener('click', () => {
    sfx.harvest();
    overlay.remove();
    if (onClose) onClose();
  }, { once: true });
}
