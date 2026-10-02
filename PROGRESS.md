# Progress ledger — Phase 0 (playable browser prototype, stages 1–2)

**On resume: read this file first.** Work one slice at a time. Each slice must leave the
game runnable (`node serve.mjs`, open the printed URL). Commit after each slice, then update
this file. Never start a slice before the previous one is committed. See CLAUDE.md →
"Working method" for the rules.

## Stack (Phase 0)
Zero-build: vanilla JS + ES modules + Canvas, served by `serve.mjs` (no dependencies —
no npm needed). Migrate to Vite before the Capacitor wrap (Phase 2), once a package manager
is available.

## Run
```
node serve.mjs        # then open the printed http://localhost URL
```
Toggle the on-screen debug overlay with the `D` key (or tap the top-left corner).

## Slices (each independently playable, in order)

- [x] **S1 — Responsive canvas baseline.** Empty desert renders inside a fit-to-safe-area
      container: portrait play field, DPR-aware canvas, safe-area insets, visualViewport
      resize handling, debug overlay (viewport size, DPR, aspect, insets, FPS). No gameplay
      yet — this is the responsive scaffold CLAUDE.md requires from day one.
- [x] **S2 — Game loop + tile grid.** Fixed-timestep update/render loop; draw the planting
      grid of empty plots on the desert.
- [x] **S3 — Water currency + HUD.** Water counter anchored to a safe-area edge; a "collect
      water" action; number goes up. HUD stays tappable at all sizes.
- [x] **S4 — Plant a seed.** Tap a plot, spend water, a seedling appears. Seeds are cheap.
- [x] **S5 — Survival roll.** Each planted seed has a survival chance; most die early,
      quickly and cheaply (teaches, doesn't punish). Visible outcome per plant.
- [x] **S6 — The three meters.** Hidden soil / shade / humidity meters; living plants nudge
      them up; survival chance reads from them. Debug overlay shows the meter values.
- [x] **S7 — Growth over time.** Surviving plants grow through visible stages; mature plants
      contribute more to meters.
- [x] **S8 — Stage 1→2 transition.** When meters cross a threshold, the scene shifts toward
      scrubland (cactus/acacia/date palm); new seed types unlock.
- [x] **S9 — Save + offline progress.** Persist state (localStorage for now); on load,
      compute idle progress from the saved timestamp.
- [x] **S10 — First-run feel pass.** Tune early economy so the opening is fun, not
      frustrating. This is Phase 0's go/no-go question.

## S10 feel-pass outcome
Simulated an early session (steady tapping + auto-plant, real survival RNG). First-pass
values reached Scrubland in ~20s — too fast, the desert struggle barely existed. Retuned:
slower meter gain (0.0006), longer growth (25s), seed cost 2 (water is a real early
constraint), gentle trickle (0.08/s) so no hard-stall. Now: Scrubland ~1–1.7 min, fully
green ~1.5–2.3 min, with more early deaths than survivors — struggle present, recovery
rewarding. **Caveat:** the sim is a proxy. The real go/no-go is a playtest on a device;
these constants are a first honest guess, not final balance.

## Phase 0.5 — legibility & UX pass (from playtest feedback)
Playtest showed the loop worked but progress was invisible ("plants grow then nothing"),
water was unexplained, and the Collect-water button overlapped the grid. Fixes:
- [x] **S11 — Fix button/grid overlap.** Reserved a 120-unit bottom control band; grid lays
      out above it.
- [x] **S12 — Show the three meters + goal.** Always-on HUD eco panel (soil/shade/humidity
      bars + "Next: Scrubland" %). Makes the progression visible — the core fix.
- [x] **S13 — Plant feedback.** Floating survival % on planting; green pop for survivors, red
      cross for deaths; 🌱 living-plants counter.
- [x] **S14 — Onboarding + labels.** First-run intro card (once) + persistent "tap soil to
      plant" hint.
- [x] **S15 — Title / boot screen.** Front-door title screen every launch; notes idle
      progress on resume.
- [x] **S16 — Stronger visible greening + tuning.** Ground vegetation fades in as the land
      heals; stronger green color shift; meter gain nudged 0.0006→0.0008, greening divisor
      0.45→0.4.

## Phase 1 (in progress) — land expansion + full loop
Turning the beat-in-2-minutes prototype into a real economy loop.
- [x] **S17 — Land expansion.** Plots start locked; buy them with water at a rising cost.
      First real water sink.
- [x] **S18 — Grove water yield.** Mature plants yield water as humidity rises (idle economy);
      HUD shows +/s income.
- [x] **S19 — Five stages.** Barren→Scrubland→Grassland→Dry woodland→Rainforest, with a
      per-stage scene palette, dimming sun, and vegetation across the whole range.
- [x] **S20 — Plant tiers.** Five plant types unlocked per stage (Seed→Cactus→Shrub→Tree→
      Canopy); higher tiers cost more, heal faster, yield more. HUD type selector.
- [x] **S21 — Milestone rewards + wildlife.** Stage-up water bonus + banner; stage-gated
      critters fade in.
- [x] **S22 — Balance + desktop HUD fix.** Diminishing returns (squared) so early is fast and
      late stages take work: optimal-play pacing Scrubland ~1.2m → Rainforest ~6.5m. HUD now
      pinned to the play field on wide/letterboxed screens.

### Polish batch (from playtest)
- [x] **S23 — Fix controls/grid overlap.** Bottom reserve measured from real DOM control
      height each layout; tidy locked-plot price labels.
- [x] **S24 — Scene composition + character.** Raised horizon (bigger plots, filled sky);
      lone man drawn as a recognizable figure; soft grass clumps instead of specks.
- [x] **S25 — Animation.** Sun halo + pulse; fluttering butterflies, drifting birds, bobbing
      animals.
- [x] **S26 — Stage celebration modal.** Reaching a new stage pauses the game and shows a
      confetti modal (stage art, flavor, +bonus, Continue). Fires once per stage, one at a
      time; replaces the old corner banner.

- [x] **S27 — Full-window backdrop.** Extended scenery behind the play field (horizon-aligned,
      seamless), vignette; wide screens no longer letterboxed.
- [x] **S28 — Distinct plant shapes.** Sprout / cactus / shrub / tree / canopy silhouettes.
- [x] **S29 — Rain events.** Once humidity ≥ 0.5, rain cycles on/off (12s on / 34s off),
      pouring ~4💧/s — the renewable-water turning point. Animated rain + clouds in scene and
      backdrop; HUD rain badge.

### Isometric conversion
- [x] **S30 — Iso tile grid.** Diamond-tile projection (isoOrigin/tileCenter + inverse-
      transform hit-testing); depth-sorted rendering; plants as billboards on tiles; fx and
      locked prices re-anchored. Removed canvas box-shadow.
- [x] **S31 — Raised soil blocks.** Tiles render as 3D blocks (side faces + top) that green
      with progress.
- [x] S32 — Scene recomposition; S33 accessible cells; S34 scene polish; S35 full-screen
      scenery.
- [x] **S36 — Full adaptive layout.** Dropped the fixed portrait design-box + letterbox.
      New layout.js computes screen-space geometry (horizon by aspect, iso grid sized/centered
      to available space, UI unit scale); both canvases fill the window; render + hit-testing
      work in screen px. Tile count fixed (20) so balance is unchanged. Verified 20/20 hit-test
      on phone/tablet/desktop.

Decision: staying vanilla Canvas 2D for iso (no framework) — reassess at the Vite/Capacitor
migration; PixiJS would be the natural upgrade then if richer 2D is wanted.

Next in Phase 1: ambient sound, real art, then migrate to Vite for Capacitor.

## Phase 0 status
Core loop + legibility pass done — a playable, readable stages 1–2 prototype. Next:
real-device playtest to answer "is the early struggle fun?", then Phase 1 (remaining stages,
rain, animals, real art) after migrating to Vite for the Capacitor wrap.

## Notes / decisions
- Stack: zero-build vanilla JS/Canvas because the environment has Node but no
  npm/npx/pnpm/yarn. Migrate to Vite before Capacitor (Phase 2).
- Modules: config (constants) · state (data + geometry) · game (rules/verbs +
  world update) · render (canvas draw) · hud (DOM overlay) · main (shell/loop).
- S8 ships the *visible* stage transition (scene greening + stage banner). Actual
  distinct scrubland seed types (cactus/acacia/date palm) are deferred to Phase 1;
  Phase 0 only needs to prove the progression feels good.

### Weather + intro + real-tree pass
- [x] **S38 — Gradual rain + real clouds.** Eased rain intensity (build/wean over ~10s) drives
      light, density, clouds, yield; puffy multi-lobe clouds drift across and off the edges.
- [x] **S39 — Loading animation.** ~2.5s animated loader (growing sprout + progress) on every
      launch, then story (first run) or straight to play.
- [x] **S40 — Premium first-run story.** Evolving desert→forest scene with fading narration
      panels, dots, skip, "Begin your forest". Shown once.
- [x] **S41 — Real-tree motivation.** Stage-celebration modal now nudges the player to plant a
      real tree (stage-specific line).

### Engagement systems (endgame + activities)
- [x] **S42 — Upgrades shop.** Six water-bought permanent upgrades (survival/growth/yield/cost/
      rain/collect). The core water sink.
- [x] **S43 — Ambient sound + SFX.** Procedural Web Audio (rain ambience + action SFX), mute toggle.
- [x] **S44 — Quests/goals.** Three rotating objectives with rewards + claimable indicator.
- [x] **S45 — Prestige ("Plant a New Forest").** After Rainforest, reset for permanent legacy
      (+3%/pt growth & yield). Keeps legacy/forests/lifetime stats; ties to the real-tree theme.

Phase 1 core loop is now full: plant → heal → expand → upgrade → rain → complete → prestige,
with quests for direction and sound for feel. Remaining Phase 1: real art, then Vite/Capacitor.

### Depth + fixes pass
- [x] **S49 — Upgrade plants in place.** Select a better kind, tap an old plant. Taps that
      would do nothing no longer send the man walking.
- [x] **S50 — Settings, more quests, while-away.** ⚙️ sheet (sound, volume, replay story,
      two-step reset); 8→10 quest types; "while you were away" toast.
- [x] **S51 — Performance.** Static backdrop cached offscreen; clouds pre-rendered as sprites.
- [x] **S52 — Adjacency bonuses.** Nurse plants (+survival), shade (+growth), mixed grove
      (+yield); green/gold markers; stage tips teach each rule.
- [x] **S53 — Harvest + care.** Fruit to tap on grown plants; thirsty plants pause until
      watered (rain waters all). Collect button retires once rain arrives.
- [x] **S54 — Real Grove + daily gift.** 🌍 sheet reads grove.json (published by deploy.sh,
      empty until real entries are added — format in README); daily streak gift.
- [x] **S55 — Balance pass.** `node tools/balance-sim.mjs`. Compressed tier multipliers,
      softer growth/yield upgrades, cubic diminishing returns. Optimal bot: Scrubland 1.2m →
      Rainforest 7.3m; casual bot: 2.4m → ~10m; late income ~11–16💧/s (was ~35).

## Phase A — Multiple worlds (ongoing progression)
Plan: `~/.claude/plans/jazzy-churning-otter.md`. Evolve prestige into a chain of real-world
places you restore one after another; worlds are **switchable** via a World Map and **restored
worlds produce water passively** into a shared global pool (the endless-idle loop). Global:
water, upgrades, legacy, stats, daily. Per-world: meters, plots, rain, stage. Phase B (later)
adds bigger drag-to-pan grids. Grids stay 4×5 through Phase A so balance is unchanged.
- [x] **A1 — world.js data + accessors.** WORLDS (Thar Desert → Sahel → Loess Plateau →
      Atlantic Forest): per-world palettes, plant reskins, grid size, twist mods;
      activeWorld/setActiveWorld/activeDims/nextWorldId. Additive — nothing wired yet.
- [x] **A2 — read active world for dims + cosmetics.** GRID.cols/rows reads
      (state/layout/game/render/main) now go through activeDims(); render scene palette reads
      activeWorld().palettes; new game.plantCosmetic() feeds render/HUD/celebrate the per-world
      plant name/emoji/color. Behaviour-preserving (world 0 == today's desert; verified).
- [x] **A3 — state/save global/per-world split.** Global pool (water/upgrades/legacy/stats/
      daily/quests) + per-world `worlds` map keyed by `worldId`; freshPlots/activeSnapshot/
      applySnapshot helpers; loadGame migrates old flat saves. Verified headless (round-trip,
      multi-world, migration). Still one active world — invisible.
- [x] **A4 — completeWorld** (evolve doPrestige; keep water/upgrades/legacy, stamp restoredDate,
      snapshot the restored world, switch to next via applySnapshot). Verified headless.
- [x] **A5 — restore-next UI.** Shop card → "Restore the Next Land → <place, region>" (or
      "Complete This Forest"); prestige modal reveals the next place + blurb, states the global
      pool is kept and the forest stays behind growing water. Folded into A4 so no stale copy ships.
- [x] **A6 — per-world twist.** worldMods() feeds survivalChance (+survivalBonus) and updateWorld
      (×growthMul, ×thirstMul). World 0 neutral (balance unchanged); Sahel harsher, Atlantic easier.
- [ ] **A7 — idle income** from restored worlds (live + offline) + HUD passive rate.
- [ ] **A8 — World Map overlay = switch hub** (🗺️).
- [ ] **A9 — world-complete celebration.**
