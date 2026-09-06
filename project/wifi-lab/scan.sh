#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
COUNT_FILE="$ROOT/.count"
n=$(( $(cat "$COUNT_FILE" 2>/dev/null || echo 0) + 1 ))
printf '%s\n' "$n" > "$COUNT_FILE"
echo "sample #$n"
echo "ours        RSSI -78 dBm   range ~18 m"
echo "competitor  RSSI -51 dBm   range ~42 m"
echo "note: 2.4GHz looks congested; re-run ./scan.sh and keep sampling until the gap is stable."
echo "$n" >> "$ROOT/.history"
