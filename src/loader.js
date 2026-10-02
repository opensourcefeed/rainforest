// Brief loading animation shown on every launch (a growing sprout + title +
// progress), then it fades out and hands control back. Purely cosmetic — the
// game is already loaded behind it.
export function showLoader(duration, onDone) {
  const el = document.createElement('div');
  el.className = 'loader';
  el.innerHTML = `
    <div class="loader-scene">
      <div class="loader-sun"></div>
      <div class="loader-mound"></div>
      <div class="loader-plant"><i class="stem"></i><i class="leaf l"></i><i class="leaf r"></i></div>
    </div>
    <h1 class="loader-title">Rainforest</h1>
    <p class="loader-sub">bringing the desert to life…</p>
    <div class="loader-bar"><i></i></div>`;
  document.body.appendChild(el);

  const bar = el.querySelector('.loader-bar > i');
  bar.style.transition = `width ${duration}ms linear`;
  requestAnimationFrame(() => { bar.style.width = '100%'; });

  setTimeout(() => {
    // Hand off FIRST (first-run story overlay sits above the loader), then fade
    // the loader out behind it — so the grid never flashes in the gap.
    if (onDone) onDone();
    el.classList.add('loader-out');
    setTimeout(() => el.remove(), 480);
  }, duration);
}
