# Eco Tycoon Game (working title) — Tahrik Studio

## Concept
An eco-friendly idle/tycoon simulator. After many years, a lone man is in an isolated
desert with a little water and a few desert-hardy seeds. He plants them; most die at
first. Gradually more survive, the ground cools, rain returns, the climate becomes
comfortable, and the desert finally becomes a rainforest. The game also motivates
players to plant real trees.

## Progression stages
1. Barren desert — one man, a few water jugs, hardy seeds. Most early plants die.
2. Scrubland — cactus, acacia, date palms. Shade starts cooling the ground.
3. Grassland — soil improves, insects and birds appear, first light rain.
4. Dry woodland — trees create a microclimate, rain becomes regular.
5. Rainforest — dense canopy, rivers, wildlife. The desert is gone.

## Core loop
- Water is the main currency early on.
- Every plant contributes to three hidden meters: soil health, shade/temperature, humidity.
- Plant survival chance starts low and rises as the meters improve. Early failure should
  teach, not punish.
- When humidity crosses a threshold, rain events unlock and water becomes renewable
  (the tycoon turning point).
- Idle/offline growth. Returning animals are milestone rewards.

### Critical design risk: early-game feel
The single biggest risk is that the barren-desert opening feels punishing and slow — the
opposite of what idle games promise — right when we need to hook the player. Guardrails:
- Make early failure **cheap and fast**: seeds near-free, death resolves quickly, and each
  loss visibly teaches the soil/shade/humidity relationships.
- Never let the player hit a dead end where they can't afford to try again.
- Phase 0's whole purpose is to answer "is the early struggle fun, not frustrating?" — get
  this feel right before building any further content.

## Tech decisions
- Build as a web game (single codebase, testable in browser).
- Wrap for Android with Capacitor (local notifications, native storage, Play Billing).
- The WebView does not run in the background: compute offline/idle progress on resume
  from saved timestamps.
- Use native storage for saves, not only localStorage.
- All purchases go through Google Play Billing.
- Use git from the start (save system + remote JSON make history worth keeping).

## Monetization (to define before Phase 2)
Play Billing is wired in, but *what* we sell is still open and needs deciding early because
it shapes the economy. Candidates: time skips, offline-earning multipliers, cosmetic groves,
one-time ad-removal. Whatever we choose must not undercut the core loop or the
"funds real trees" story (e.g. avoid pay-to-win over patience; keep the real-grove framing
clean). Draft the model before building the Phase 1 economy so balancing accounts for it.

## Screen support / responsive (standing constraint)
The game must render correctly on every real-world Android screen — small budget phones,
tall flagships, tablets, and foldables — not just the dev device. Rules:
- **Portrait-locked**, single fit-scaled play field + an edge-anchored responsive HUD. The
  play field scales; HUD (water counter, buttons) anchors to actual edges at a fixed
  physical size. Never non-uniformly stretch — extend the background on taller screens
  instead of distorting.
- **Never let UI shrink below tappable size**: min ~44–48px logical tap targets, sized in
  dp-equivalent units so they work on both small phones and tablets.
- **Safe-area insets**: `viewport-fit=cover` + CSS `env(safe-area-inset-*)`. Keep
  interactive UI clear of notches, punch-holes, rounded corners, and the bottom gesture bar.
- **Use `visualViewport`** (not `window.innerHeight`) for usable height; recompute layout on
  its resize/scroll, debounced and idempotent (foldables fire rapid resize on fold/unfold).
- **Canvas**: size the backing store by `devicePixelRatio` (capped ~2–3 for perf) and scale
  the context so rendering stays crisp without tanking cheap high-DPI phones.
- Build the Phase 0 prototype inside this fit-to-safe-area container from the first commit —
  retrofitting responsive layout onto a game late is painful.
- **Verification**: ship a debug overlay (viewport size, DPR, aspect ratio, safe-area
  insets) and test the extremes — small phone (~360×640), tall flagship (~412×915),
  tablet (600dp+), foldable. Emulation covers most; notches/DPR/keyboard need real hardware.

## Real-tree layer
- The developer (Niyas) plants the real trees himself; no partner organization.
- 7 trees already planted. Plan to add more during development and launch with a
  documented starter grove.
- Frame it as "a share of net revenue funds trees planted by the developer"
  (not donations). Exact ratio still being decided.
- The revenue-share line is a public promise: word it to avoid reading as a solicitation of
  donations or an unsubstantiated environmental claim, and keep it verifiable via the public
  planting log. Settle the exact wording before it ships in-store.
- In-app "Real Grove" screen: photos, dates, species, approximate locations, loaded from
  a remote JSON file (e.g. GitHub Pages) so it updates without an app release.
- Public planting log on the web, including survival updates over time.
- Optional in-game rewards tied to real grove milestones.

## Roadmap for initial release (~3 months part-time)
Treat 3 months as an aggressive best case, not a commitment — Phase 1's content + balancing
is the most likely to overrun. Phase 0 is the real go/no-go gate; don't start Phase 1 until
the early-game feel is proven fun.
- Phase 0 — Prototype (2–3 wks): stages 1–2 in browser; water, survival, the three
  meters. Goal: is the early struggle fun, not frustrating?
- Phase 1 — Full loop (4–6 wks): all 5 stages, rain events, animal milestones, save
  system, offline progress, simple 2D art, ambient sound.
- Phase 2 — App shell (2 wks): Capacitor wrap, local notifications, Play Billing,
  Firebase analytics + Crashlytics.
- Phase 3 — Real Grove (1–2 wks): Real Grove screen, remote JSON, milestone rewards.
- Phase 4 — Launch prep (2 wks): closed testing, store listing, privacy policy,
  cross-promotion via opensourcefeed.org and social channels.

## Out of scope for v1
Accounts/cloud save, leaderboards, multiplayer, iOS.

## Working method (agentic / incremental) — MUST follow
Work in small **vertical slices**, each leaving the game playable end-to-end (just with less
in it), never in horizontal layers that leave nothing runnable halfway. This guarantees that
if a session is interrupted (e.g. quota), the last checkpoint still works.

Every increment, in this order:
1. Implement the next slice from `PROGRESS.md` (smallest change that keeps the build running).
2. Verify the build still runs and the slice works.
3. Commit with a descriptive message. **Never commit a broken build.**
4. Update `PROGRESS.md` (mark done, note what's next).
5. Only then start the next slice.

Rules: never start a new slice before the previous one is committed. The last commit must
always be playable. On resume, read `PROGRESS.md` first to pick up cleanly.

## Current step
Start Phase 0: build a playable browser prototype of stages 1–2.
