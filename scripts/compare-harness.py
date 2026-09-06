#!/usr/bin/env python3
import json
import re
import sys
import time
import urllib.request

API = "http://127.0.0.1:8787"
PROMPT = "I am a laptop company selling laptops. Let's research competitive analysis."
GIANTS = ["Dell", "HP", "Lenovo", "Apple", "ASUS", "Acer"]
SMALL = [
    "VVDN",
    "Dixon",
    "Holoware",
    "Primebook",
    "Quanta",
    "Compal",
    "RDP",
    "JioBook",
    "local reseller",
    "local computer dealer",
    "regional retailer",
    "refurbished",
]


def scrub_negated_giants(text: str) -> str:
    return re.sub(
        r"not (?:Dell|HP|Lenovo|Apple)(?:,? (?:HP|Lenovo|Apple|or Apple))*",
        "",
        text,
        flags=re.I,
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


def answer(session: dict) -> str:
    texts: list[str] = []
    for item in session.get("transcript") or []:
        if item.get("kind") in {"output", "thought"} and item.get("text"):
            texts.append(item["text"])
    return "\n".join(texts)


def first_hit(text: str, names: list[str]) -> tuple[int, str] | None:
    lower = text.lower()
    found = [(lower.find(name.lower()), name) for name in names if name.lower() in lower]
    found = [row for row in found if row[0] >= 0]
    found.sort()
    return found[0] if found else None


def main() -> int:
    health = request("GET", "/api/health")
    print("health", json.dumps(health))
    listed = request("GET", "/api/sessions")["sessions"]
    left = next(s for s in listed if s["lane"] == "http")
    right = next(s for s in listed if s["lane"] == "websocket")
    print(
        "before",
        left["id"],
        left["lane"],
        left.get("harnessApplied"),
        right["id"],
        right["lane"],
        right.get("harnessApplied"),
    )

    print("post", left["id"], request("POST", f"/api/sessions/{left['id']}/prompt", {"text": PROMPT}))
    print("post", right["id"], request("POST", f"/api/sessions/{right['id']}/prompt", {"text": PROMPT}))

    deadline = time.time() + 420
    session_a = left
    session_b = right
    while time.time() < deadline:
        session_a = request("GET", f"/api/sessions/{left['id']}")["session"]
        session_b = request("GET", f"/api/sessions/{right['id']}")["session"]
        print(
            f"poll left={session_a['status']} pid={session_a.get('pid')} "
            f"right={session_b['status']} pid={session_b.get('pid')} "
            f"harness={session_b.get('harnessApplied')}",
            flush=True,
        )
        done = session_a["status"] in {"idle", "exited", "error", "killed"} and session_b[
            "status"
        ] in {"idle", "exited", "error", "killed"}
        if done and session_a.get("turnCount", 0) > 0 and session_b.get("turnCount", 0) > 0:
            break
        time.sleep(8)
    else:
        print("timed out waiting for both panes", file=sys.stderr)
        return 2

    left_text = answer(session_a)
    right_text = answer(session_b)
    print("\n======== WITHOUT HARNESS ========\n")
    print(left_text[:5000] or "(no answer text)")
    print("\n======== WITH HARNESS ========\n")
    print(right_text[:5000] or "(no answer text)")

    lg = first_hit(left_text, GIANTS)
    ls = first_hit(left_text, SMALL)
    rg = first_hit(scrub_negated_giants(right_text), GIANTS)
    rs = first_hit(right_text, SMALL)
    left_upload = next((i.get("uploadBytes") for i in session_a["transcript"] if i["kind"] == "api"), 0)
    right_upload = next((i.get("uploadBytes") for i in session_b["transcript"] if i["kind"] == "api"), 0)
    print("\n======== SCORE ========")
    print(f"without first giant={lg} first small={ls} upload={left_upload}")
    print(f"with    first giant={rg} first small={rs} upload={right_upload}")
    without_giant_first = bool(lg) and (ls is None or lg[0] < ls[0])
    with_small_first = bool(rs) and (rg is None or rs[0] < rg[0])
    print(f"without_leads_with_giants={without_giant_first}")
    print(f"with_leads_with_small={with_small_first}")
    print(f"demo_split={without_giant_first and with_small_first}")
    if session_a.get("harnessApplied") or not session_b.get("harnessApplied"):
        print("harnessApplied flags unexpected", file=sys.stderr)
        return 3
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
