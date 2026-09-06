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

if ! gh repo edit --visibility public --accept-visibility-change-consequences; then
  gh repo edit --visibility public
fi

gh repo view --json name,url,visibility
echo
gh repo view --json url --jq .url
