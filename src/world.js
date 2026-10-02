// Worlds — the ongoing-progression layer. Each world is a real place on Earth
// with its own biome: a 5-stage scene palette ramp, a native-plant reskin over
// the five universal tiers, a grid size, and a starting "twist" (mods). You
// restore a world from degraded → lush (the existing 5-stage meter arc), then
// unlock the next. legacy + the global water pool carry across all worlds; a
// world's meters/plots/rain are per-world so you can switch back and resume.
//
// This file is DATA + accessors only. It deliberately imports nothing from
// game.js/state.js so it can be the shared source of truth without a cycle:
// costs / multipliers / growth times / tier gating stay in game.PLANT_TYPES;
// only the *cosmetic* name/emoji/color per tier is reskinned here.

// Universal plant tiers, in order (index === the tier). Worlds override the
// name/emoji/color per tier; game.PLANT_TYPES keeps cost/meterMul/yieldMul/size.
// World 0 (desert) is identical to today's PLANT_TYPES so nothing changes.

// Grid stays 4×5 for every world until the drag-to-pan camera lands (Phase B);
// only then do later worlds grow bigger. Keeping it fixed now means the
// dimension refactor (slice A2) is behaviour-preserving and balance is unchanged.
const COLS = 4, ROWS = 5;

export const WORLDS = [
  {
    id: 'thar',
    place: 'Thar Desert',
    region: 'India',
    biome: 'desert',
    blurb: 'A lone man, a few jugs of water, and seeds that mostly die. Begin here.',
    cols: COLS, rows: ROWS,
    mods: { survivalBonus: 0, growthMul: 1, thirstMul: 1 },
    // Sky/ground gradients per stage (barren → lush). Matches render.PALETTES.
    palettes: [
      { skyTop: [143, 183, 214], skyBot: [231, 214, 168], grTop: [217, 181, 121], grBot: [184, 137, 77] },
      { skyTop: [150, 190, 205], skyBot: [214, 210, 175], grTop: [178, 176, 112], grBot: [140, 140, 80] },
      { skyTop: [140, 190, 210], skyBot: [200, 216, 182], grTop: [122, 165, 82], grBot: [86, 120, 56] },
      { skyTop: [128, 186, 206], skyBot: [186, 210, 182], grTop: [92, 142, 68], grBot: [60, 100, 48] },
      { skyTop: [120, 180, 200], skyBot: [172, 206, 186], grTop: [58, 120, 58], grBot: [36, 86, 42] },
    ],
    plants: [
      { name: 'Hardy seed', emoji: '🌱', color: '#9ad152' },
      { name: 'Cactus', emoji: '🌵', color: '#3fa47e' },
      { name: 'Shrub', emoji: '🌿', color: '#6bb63f' },
      { name: 'Tree', emoji: '🌳', color: '#3f8f37' },
      { name: 'Date palm', emoji: '🌴', color: '#2a6f2e', shape: 'palm' },
    ],
  },
  {
    id: 'sahel',
    place: 'Sahel',
    region: 'West Africa',
    biome: 'savanna',
    blurb: 'The edge of the Sahara, parched by drought. Hardy acacias can hold the line.',
    cols: COLS, rows: ROWS,
    // Twist: harsher sun — seedlings survive a little less, so nurse plants and
    // upgrades matter more here.
    mods: { survivalBonus: -0.05, growthMul: 1, thirstMul: 1.3 },
    // Golden savanna: warm amber grassland that greens to a warm, olive forest.
    palettes: [
      { skyTop: [170, 180, 188], skyBot: [240, 214, 150], grTop: [224, 176, 92],  grBot: [186, 132, 58] },
      { skyTop: [168, 184, 190], skyBot: [230, 212, 150], grTop: [214, 186, 92],  grBot: [168, 142, 60] },
      { skyTop: [162, 188, 194], skyBot: [216, 214, 156], grTop: [188, 182, 84],  grBot: [138, 138, 58] },
      { skyTop: [150, 186, 196], skyBot: [200, 212, 168], grTop: [146, 164, 70],  grBot: [100, 122, 50] },
      { skyTop: [138, 182, 196], skyBot: [186, 208, 174], grTop: [100, 142, 58],  grBot: [66, 104, 42] },
    ],
    plants: [
      { name: 'Grass tuft', emoji: '🌱', color: '#b7cf5a' },
      { name: 'Aloe', emoji: '🌵', color: '#52a86e' },
      { name: 'Millet', emoji: '🌾', color: '#86b63f' },
      { name: 'Acacia', emoji: '🌳', color: '#4f8f3a', shape: 'acacia' },
      { name: 'Baobab', emoji: '🌴', color: '#2f6f2c', shape: 'baobab' },
    ],
  },
  {
    id: 'loess',
    place: 'Loess Plateau',
    region: 'China',
    biome: 'highland',
    blurb: 'Centuries of erosion stripped these hills bare. Terraces can bring them back.',
    cols: COLS, rows: ROWS,
    // Twist: cool, dry highland — plants grow a touch slower but rarely thirst.
    mods: { survivalBonus: 0, growthMul: 0.9, thirstMul: 0.6 },
    // Red-ochre terracotta earth, cool pale sky, greening to terraced hills.
    palettes: [
      { skyTop: [182, 194, 206], skyBot: [228, 210, 188], grTop: [198, 118, 74],  grBot: [150, 82, 50] },
      { skyTop: [178, 194, 206], skyBot: [220, 208, 186], grTop: [190, 130, 80],  grBot: [146, 94, 56] },
      { skyTop: [168, 192, 206], skyBot: [206, 210, 184], grTop: [162, 140, 78],  grBot: [118, 100, 56] },
      { skyTop: [150, 188, 206], skyBot: [190, 208, 184], grTop: [116, 142, 72],  grBot: [80, 104, 52] },
      { skyTop: [134, 182, 204], skyBot: [174, 204, 186], grTop: [74, 124, 62],   grBot: [46, 92, 46] },
    ],
    plants: [
      { name: 'Vetch', emoji: '🌱', color: '#a6cf62' },
      { name: 'Sea buckthorn', emoji: '🌵', color: '#58a876' },
      { name: 'Willow', emoji: '🌿', color: '#6bb648' },
      { name: 'Poplar', emoji: '🌳', color: '#3f8f40' },
      { name: 'Pine', emoji: '🌲', color: '#246b3a', shape: 'pine' },
    ],
  },
  {
    id: 'atlantic',
    place: 'Atlantic Forest',
    region: 'Brazil',
    biome: 'tropical',
    blurb: 'Warm rains and rich soil. Life wants to return — give it a foothold.',
    cols: COLS, rows: ROWS,
    // Twist: warm and wet — everything grows faster and survives more readily.
    mods: { survivalBonus: 0.05, growthMul: 1.15, thirstMul: 0.7 },
    // Humid tropics: deep blue sky and rich soil even at the start, to the
    // deepest, most saturated jungle green of any world.
    palettes: [
      { skyTop: [112, 170, 208], skyBot: [198, 208, 172], grTop: [176, 156, 108], grBot: [132, 112, 76] },
      { skyTop: [108, 172, 208], skyBot: [188, 210, 176], grTop: [128, 158, 90],  grBot: [86, 120, 58] },
      { skyTop: [102, 170, 210], skyBot: [176, 210, 182], grTop: [88, 150, 72],   grBot: [52, 112, 52] },
      { skyTop: [94, 166, 210],  skyBot: [162, 206, 184], grTop: [56, 130, 60],   grBot: [34, 98, 46] },
      { skyTop: [84, 160, 208],  skyBot: [148, 202, 186], grTop: [36, 108, 52],   grBot: [20, 78, 40] },
    ],
    plants: [
      { name: 'Fern', emoji: '🌱', color: '#8fd25a', shape: 'fern' },
      { name: 'Bromeliad', emoji: '🌺', color: '#4fae6e' },
      { name: 'Cecropia', emoji: '🌿', color: '#5fb63f' },
      { name: 'Jacaranda', emoji: '🌳', color: '#3a8f3c' },
      { name: 'Brazilwood', emoji: '🌴', color: '#246a2c', shape: 'palm' },
    ],
  },
];

const BY_ID = Object.fromEntries(WORLDS.map((w) => [w.id, w]));

export const FIRST_WORLD_ID = WORLDS[0].id;

// The active world drives dimensions, palette, plant cosmetics, and the twist.
// It's module-level (not in state) because geometry helpers in layout/state read
// it synchronously; save.js keeps state.worldId authoritative and calls
// setActiveWorld on load / switch.
let activeId = FIRST_WORLD_ID;

export function worldById(id) {
  return BY_ID[id] || WORLDS[0];
}
export function activeWorld() {
  return BY_ID[activeId] || WORLDS[0];
}
export function setActiveWorld(id) {
  if (BY_ID[id]) activeId = id;
  return activeWorld();
}
export function activeDims() {
  const w = activeWorld();
  return { cols: w.cols, rows: w.rows };
}
// The world unlocked after `id` (the next land to restore), or null at the end.
export function nextWorldId(id) {
  const i = WORLDS.findIndex((w) => w.id === id);
  return i >= 0 && i + 1 < WORLDS.length ? WORLDS[i + 1].id : null;
}
