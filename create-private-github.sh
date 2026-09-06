#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

REPO_NAME="${1:-harness-engineering}"
VISIBILITY="${2:-private}"

if [[ "$VISIBILITY" != "private" && "$VISIBILITY" != "public" ]]; then
  echo "visibility must be private or public" >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "gh is required" >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "gh is not authenticated. run: gh auth login" >&2
  exit 1
fi

OWNER="$(gh api user --jq .login)"

if [[ ! -d .git ]]; then
  git init
fi

git add -A
if git diff --cached --quiet; then
  echo "nothing to commit"
else
  git commit -m "$(cat <<'EOF'
Initial commit of Harness Engineering.

EOF
)"
fi

if git remote get-url origin >/dev/null 2>&1; then
  echo "origin already exists: $(git remote get-url origin)"
else
  gh repo create "${OWNER}/${REPO_NAME}" \
    --"${VISIBILITY}" \
    --source . \
    --remote origin \
    --description "Harness Engineering — local dual-pane Codex control room"
fi

git push -u origin HEAD

echo
echo "https://github.com/${OWNER}/${REPO_NAME}"
