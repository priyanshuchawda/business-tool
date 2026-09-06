#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

NEW_NAME="${1:-business-tool}"

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

OWNER="$(gh api user --jq .login)"
CURRENT_NAME="$(gh repo view --json name --jq .name)"

if [[ "$CURRENT_NAME" != "$NEW_NAME" ]]; then
  gh repo rename "$NEW_NAME" --yes
fi

NEW_URL="https://github.com/${OWNER}/${NEW_NAME}.git"
git remote set-url origin "$NEW_URL"
git fetch origin
git branch --set-upstream-to="origin/$(git rev-parse --abbrev-ref HEAD)" || true

echo
echo "https://github.com/${OWNER}/${NEW_NAME}"
