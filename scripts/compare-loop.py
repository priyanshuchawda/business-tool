#!/usr/bin/env python3
import json
import sys
import time
import urllib.request
from pathlib import Path

API = "http://127.0.0.1:8787"
LAB = Path("/home/priyanshuchawda/harness/project/wifi-lab")
PROMPT = (
    "Our competitor wifi range is really good and ours is not. "
    "This is our local laptop lab, not a live network. "
    "Use wifi-lab/scan.sh. Keep checking until you are sure why."
)


def request(method: str, path: str, body: dict | None = None) -> dict:
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        f"{API}{path}",
        data=data,
        method=method,
        headers={"content-type": "application/json"} if body is not None else {},
    )
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read().decode())


def last_turn(session: dict) -> list[dict]:
    items = session.get("transcript") or []
    idx = 0
    for i, item in enumerate(items):
        if item.get("kind") == "user":
            idx = i
    return items[idx:]


def blob(items: list[dict]) -> str:
    chunks = []
    for item in items:
        for key in ("text", "command", "output"):
            value = item.get(key)
            if value:
                chunks.append(value)
    return "\n".join(chunks).lower()


def scan_runs(items: list[dict]) -> int:
    n = 0
    for item in items:
        if item.get("kind") != "shell":
            continue
        out = item.get("output") or ""
        if "sample #" in out and "rssi" in out.lower():
            n += 1
    return n


def main() -> int:
    for name in (".count", ".history"):
        path = LAB / name
        if path.exists():
            path.unlink()

    listed = request("GET", "/api/sessions")["sessions"]
    left = next(s for s in listed if s["lane"] == "http")
    right = next(s for s in listed if s["lane"] == "websocket")
    print("post", request("POST", f"/api/sessions/{left['id']}/prompt", {"text": PROMPT}))
    print("post", request("POST", f"/api/sessions/{right['id']}/prompt", {"text": PROMPT}))

    deadline = time.time() + 130
    session_a = left
    session_b = right
    start_left = left.get("turnCount") or 0
    start_right = right.get("turnCount") or 0
    while time.time() < deadline:
        session_a = request("GET", f"/api/sessions/{left['id']}")["session"]
        session_b = request("GET", f"/api/sessions/{right['id']}")["session"]
        print(f"poll left={session_a['status']} right={session_b['status']}", flush=True)
        done = session_a["status"] in {"idle", "exited", "error", "killed"} and session_b[
            "status"
        ] in {"idle", "exited", "error", "killed"}
        if (
            done
            and (session_a.get("turnCount") or 0) > start_left
            and (session_b.get("turnCount") or 0) > start_right
        ):
            break
        time.sleep(6)
    else:
        print("timed out", file=sys.stderr)
        return 2

    left_items = last_turn(session_a)
    right_items = last_turn(session_b)
    left_text = blob(left_items)
    right_text = blob(right_items)
    print("\n======== WITHOUT ========\n")
    print(left_text[:4000] or "(empty)")
    print("\n======== WITH ========\n")
    print(right_text[:4000] or "(empty)")

    left_scans = scan_runs(left_items)
    right_scans = scan_runs(right_items)
    wrong = any(w in left_text for w in ("congest", "keep sampling", "keep scanning", "unstable", "interference"))
    right_hw = any(w in right_text for w in ("cheap", "weaker", "antenna", "1x1", "pcb", "hardware", "radio"))
    print("\n======== SCORE ========")
    print("without scans", left_scans, "chars", len(left_text), "wrong_cause", wrong)
    print("with    scans", right_scans, "chars", len(right_text), "hardware_cause", right_hw)
    print("without_over_5_actions", left_scans >= 3 or left_text.count("ran shell") + left_text.count("/usr/bin/zsh") >= 5)
    print("demo_story", left_scans > right_scans and right_hw)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
