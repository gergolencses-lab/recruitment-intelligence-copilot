#!/usr/bin/env bash
# A docs/ statikus demo publikálása a publikus demo-repóba (GitHub Pages).
# A fő repo privát marad; csak a kliens-oldali demo (mock API, mintaadatok) megy ki.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
git clone -q --depth 1 "https://github.com/gergolencses-lab/recruitment-intelligence-demo.git" "$TMP"
cp "$ROOT"/docs/index.html "$ROOT"/docs/app.js "$ROOT"/docs/styles.css "$ROOT"/docs/mock-api.js "$TMP"/
cd "$TMP"
git add -A
if git diff --cached --quiet; then echo "Nincs változás — a demo naprakész."; exit 0; fi
git commit -q -m "Demo frissítése a fő repo docs/ tükréből"
git push -q
echo "Publikálva: https://gergolencses-lab.github.io/recruitment-intelligence-demo/"
