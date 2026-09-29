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
