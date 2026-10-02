// Balance sim: a sensible bot plays the full loop; reports pacing + economy.
const root = new URL('../src/', import.meta.url).href;
const { createState, freshPlots } = await import(root + 'state.js');
const W = await import(root + 'world.js');
const G = await import(root + 'game.js');

export function run({ minutes = 40, tapRate = 1, seed = 1, actEvery = 1, smart = true, world = 'thar' } = {}) {
  let rs = seed; Math.random = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  W.setActiveWorld(world);
  const s = createState();
  if (world !== 'thar') { s.worldId = world; W.setActiveWorld(world); s.plots = freshPlots(world); }
  G.initQuests(s);
  const dt = 0.5; let t = 0, nextAct = 0;
  const reached = {}; const samples = []; let prestigeAt = null; let spent = 0;
  const tier = (id) => G.PLANT_TYPES.findIndex((p) => p.id === id);
  while (t < minutes * 60) {
    if (t >= nextAct) {
      nextAct += actEvery;
      if (!s.rain.unlocked) { for (let k = 0; k < tapRate; k++) { s.water += G.collectAmount(s); s.stats.collected++; } }
      for (let i = 0; i < 3; i++) G.claimQuest(s, i);
      s.plots.forEach((p, i) => { if (p.plant && (p.plant.thirsty || p.plant.ripe)) G.actOnTile(s, i); });
      const avail = G.availableTypes(s);
      const best = [...avail].reverse().find((ty) => s.water >= G.plantCost(s, ty));
      const empties = s.plots.map((p, i) => i).filter((i) => s.plots[i].unlocked && !s.plots[i].planted);
      if (smart) empties.sort((a, b) => G.tileBonus(s, s.plots[b]).nurse - G.tileBonus(s, s.plots[a]).nurse);
      if (empties.length && best) { s.selectedType = best.id; const w = s.water; G.actOnTile(s, empties[0]); spent += w - s.water; }
      else if (!empties.length) {
        const locked = s.plots.findIndex((p) => !p.unlocked);
        const top = avail[avail.length - 1];
        const weak = s.plots.findIndex((p) => p.plant && p.plant.status === 'alive' && tier(p.plant.typeId) < tier(top.id));
        if (locked !== -1 && s.water >= G.unlockCost(s)) { const w = s.water; G.unlockPlot(s, locked); spent += w - s.water; }
        else if (weak !== -1 && s.water >= G.plantCost(s, top) * 1.5) { s.selectedType = top.id; const w = s.water; G.actOnTile(s, weak); spent += w - s.water; }
        else {
          const cheapest = G.UPGRADES.map((u) => [u.id, G.upgradeCost(s, u.id)]).sort((a, b) => a[1] - b[1])[0];
          if (cheapest && isFinite(cheapest[1]) && s.water >= cheapest[1] * 2) { const w = s.water; G.buyUpgrade(s, cheapest[0]); spent += w - s.water; }
        }
      }
    }
    G.updateWorld(s, dt);
    if (s.milestone) s.milestone = null; // auto-continue celebrations
    const st = G.currentStage(s).index;
    if (reached[st] === undefined) reached[st] = t;
    if (prestigeAt === null && G.canPrestige(s)) prestigeAt = t;
    if (t % 120 === 0) samples.push(`${(t / 60) | 0}m:${Math.round(s.water)}💧@${G.waterRate(s).toFixed(1)}/s`);
    t += dt;
  }
  const up = G.UPGRADES.map((u) => G.upgradeLevel(s, u.id)).join('/');
  return { reached, prestigeAt, samples, water: Math.round(s.water), spent: Math.round(spent), upgrades: up, living: G.livingCount(s) };
}
const mm = (x) => (x === undefined || x === null ? '—' : (x / 60).toFixed(1) + 'm');
for (const seed of [1, 7, 42]) {
  const r = run({ seed });
  console.log(`seed ${seed}: stages ${[0,1,2,3,4].map((i) => mm(r.reached[i])).join(' → ')} | prestige-ready ${mm(r.prestigeAt)} | end water ${r.water}, spent ${r.spent}, upgrades ${r.upgrades}`);
  if (seed === 1) console.log('   water over time:', r.samples.join('  '));
}

// Per-world pacing (grid-size normalisation check): with the economy normalised
// to the 4×5 baseline, each world should reach Rainforest in a similar time
// despite larger grids. The later-world twists (mods) shift it a little.
console.log('\nper-world pacing (seed 1, 60m cap):');
for (const id of ['thar', 'sahel', 'loess', 'atlantic']) {
  const w = W.worldById(id);
  const r = run({ seed: 1, minutes: 60, world: id });
  console.log(`  ${id.padEnd(9)} ${w.cols}x${w.rows} (${w.cols * w.rows}t): ` +
    `stages ${[1,2,3,4].map((i) => mm(r.reached[i])).join(' → ')} | rainforest ${mm(r.reached[4])} | living ${r.living}`);
}
