#!/usr/bin/env bash
#
# Deploy script for Rainforest.
#
#   Code       -> push `main` to BOTH remotes (GitLab `origin` + GitHub `github`).
#   Deployable -> build the static site and publish it to the `gh-pages` branch
#                 on `github`, which GitHub Pages serves.
#
# The site is zero-build (vanilla JS/Canvas), so "build" just stages the web
# files (index.html, src/, .nojekyll) — no compile step.
#
# Usage:
#   ./deploy.sh "commit message"   # commit tracked changes, then push + deploy
#   ./deploy.sh                    # no commit; push current main + deploy
#
set -euo pipefail
cd "$(dirname "$0")"

CODE_REMOTES=(origin github)   # source is mirrored to both
DEPLOY_REMOTE=github           # gh-pages lives here
DEPLOY_BRANCH=gh-pages
SRC_BRANCH=main

# --- 1. Optional commit of code changes -----------------------------------
if [ $# -ge 1 ]; then
  if ! git diff --quiet || ! git diff --cached --quiet; then
    git add -A
    git commit -m "$1"
  else
    echo "No changes to commit; skipping commit."
  fi
fi

SRC_SHA="$(git rev-parse --short HEAD)"

# --- 2. Push code (main) to both remotes ----------------------------------
for r in "${CODE_REMOTES[@]}"; do
  echo ">> pushing $SRC_BRANCH -> $r"
  git push "$r" "$SRC_BRANCH"
done

# --- 3. Build the deployable static site ----------------------------------
DEPLOY_URL="$(git remote get-url "$DEPLOY_REMOTE")"
BUILD_DIR="$(mktemp -d)"
trap 'rm -rf "$BUILD_DIR"' EXIT
cp index.html "$BUILD_DIR/"
cp -r src "$BUILD_DIR/"
cp .nojekyll "$BUILD_DIR/"
cp grove.json "$BUILD_DIR/"                       # Real Grove data
[ -d grove ] && cp -r grove "$BUILD_DIR/"          # Real Grove photos (optional)

# --- 4. Publish it to gh-pages as a single clean commit -------------------
# A throwaway repo keeps gh-pages history-light; force-push since it is a
# generated artifact, not source.
(
  cd "$BUILD_DIR"
  git init -q -b "$DEPLOY_BRANCH"
  git add -A
  git -c user.email="contact.opensourcefeed@gmail.com" -c user.name="OpenSourceFeed" \
    commit -q -m "Deploy from ${SRC_SHA}"
  echo ">> publishing $DEPLOY_BRANCH -> $DEPLOY_REMOTE"
  git push -f "$DEPLOY_URL" "HEAD:$DEPLOY_BRANCH"
)

echo "Done. Code -> ${CODE_REMOTES[*]}; deployed gh-pages -> $DEPLOY_REMOTE (from ${SRC_SHA})."
