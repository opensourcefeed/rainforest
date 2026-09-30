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

Two git remotes: **`origin`** (GitLab, source) and **`github`** (GitHub, `opensourcefeed`
org — also serves the page). Deploy with:

```
./deploy.sh "commit message"   # commit + push main to both remotes, then deploy
./deploy.sh                    # no commit; push current main + deploy
```

The script pushes `main` (source) to both remotes and publishes the static site (index.html,
src/, .nojekyll) to the **`gh-pages`** branch on `github`. It's zero-build, so "build" just
stages the web files.

One-time GitHub setup: **Settings → Pages → Source: "Deploy from a branch" → `gh-pages` /
`/ (root)`**. Then it's live at `https://www.opensourcefeed.org/<repo-name>/` (the subpath is
the repo name).

- `.nojekyll` disables Jekyll (pure static). Do **not** add a `CNAME` file here — the custom
  domain is set on the org's `opensourcefeed.github.io` repo and applies to project pages
  automatically.
- All asset paths are relative, so serving under the `/<repo-name>/` subpath needs no changes.

## Status

Phase 0: playable browser prototype of stages 1–2. Built in small vertical slices — every
commit runs. Migrating to Vite + Capacitor for the Android build in Phase 2.

## Real Grove data

The in-game **Real Grove** screen (🌍) loads `grove.json`, which `deploy.sh`
publishes next to the game — so it can be updated without shipping a new build.
Add one entry per real tree; put photos in a `grove/` folder (also published).

```json
{
  "updated": "2026-10-01",
  "trees": [
    {
      "species": "Neem (Azadirachta indica)",
      "planted": "2026-06-14",
      "location": "Approximate area, e.g. town or district",
      "photo": "grove/neem-01.jpg",
      "note": "Optional survival update, e.g. 'Healthy, 1.2 m tall'"
    }
  ]
}
```

Keep locations approximate. Everything shown here is public.
