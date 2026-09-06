#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if ! command -v gh >/dev/null 2>&1; then
  echo "gh is required" >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "gh is not authenticated. run: gh auth login" >&2
  exit 1
fi

if [[ ! -d .git ]]; then
  echo "not a git repository" >&2
  exit 1
fi

git add \
  .gitignore \
  HARNESS_LOOP_ENGINE.md \
  project/wifi-lab/scan.sh \
  scripts/compare-loop.py \
  server/harness-context.ts \
  server/session.ts \
  push-loop-engine.sh

if git diff --cached --quiet; then
  echo "nothing to commit"
else
  git commit -m "$(cat <<'EOF'
Add the loop-engine harness so WITH stops early on hardware, not extra scans.

EOF
)"
fi

git push -u origin HEAD

OWNER="$(gh api user --jq .login)"
REPO="$(gh repo view --json name --jq .name)"
echo
echo "https://github.com/${OWNER}/${REPO}"
