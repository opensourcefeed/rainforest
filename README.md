# Rainforest

An eco-friendly idle/tycoon game: turn a barren desert into a rainforest, one tree at a
time. A share of net revenue funds real trees planted by the developer. See
[CLAUDE.md](CLAUDE.md) for the full design, and [PROGRESS.md](PROGRESS.md) for the current
build status.

## Run (Phase 0 prototype)

Zero-build — no `npm install` needed. Requires only Node.

```
node serve.mjs        # then open the printed http://localhost URL
```

Press `D` (or tap the top-left corner) to toggle the debug overlay.

## Deploy (GitHub Pages)

The prototype is a static site (no build step), so GitHub Pages serves it directly. It's
hosted from a repo in the `opensourcefeed` GitHub org, under the org's custom domain:

- Enable **Settings → Pages → Deploy from a branch → `main` / `/ (root)`**.
- URL is the org domain + repo name: `https://www.opensourcefeed.org/<repo-name>/`.
- `.nojekyll` disables Jekyll (pure static). Do **not** add a `CNAME` file here — the custom
  domain is set on the org's `opensourcefeed.github.io` repo and applies to project pages
  automatically.
- All asset paths are relative, so serving under the `/<repo-name>/` subpath needs no changes.

## Status

Phase 0: playable browser prototype of stages 1–2. Built in small vertical slices — every
commit runs. Migrating to Vite + Capacitor for the Android build in Phase 2.
