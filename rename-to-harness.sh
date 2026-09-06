#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

NEW_NAME="${1:-harness-engineering}"
TITLE="Harness Engineering"

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

CURRENT_NAME="$(gh repo view --json name --jq .name)"
if [[ "$CURRENT_NAME" != "$NEW_NAME" ]]; then
  gh repo rename "$NEW_NAME" --yes
fi

git add -A
if ! git diff --cached --quiet; then
  git commit -m "$(cat <<EOF
Rename the product and repository to ${TITLE}.

EOF
)"
fi

git push -u origin HEAD

OWNER="$(gh api user --jq .login)"
echo
echo "https://github.com/${OWNER}/${NEW_NAME}"
