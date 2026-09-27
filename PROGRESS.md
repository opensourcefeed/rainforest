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
- [ ] **S7 — Growth over time.** Surviving plants grow through visible stages; mature plants
      contribute more to meters.
- [ ] **S8 — Stage 1→2 transition.** When meters cross a threshold, the scene shifts toward
      scrubland (cactus/acacia/date palm); new seed types unlock.
- [ ] **S9 — Save + offline progress.** Persist state (localStorage for now); on load,
      compute idle progress from the saved timestamp.
- [ ] **S10 — First-run feel pass.** Tune early economy so the opening is fun, not
      frustrating. This is Phase 0's go/no-go question.

## Notes / decisions
- (record any non-obvious choices here as we go)
