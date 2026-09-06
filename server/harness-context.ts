import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { SessionLane } from "../shared/protocol.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONTEXT_FILE = resolve(ROOT, "HARNESS_CONTEXT.md");
const LOOP_FILE = resolve(ROOT, "HARNESS_LOOP_ENGINE.md");

export const DEMO_MAX_MS = 90_000;

export function demoMaxActions(lane: SessionLane): number {
  return lane === "websocket" ? 8 : 12;
}

function load(file: string): string {
  return readFileSync(file, "utf8");
}

function isMeasureTask(prompt: string): boolean {
  return /\b(wifi|wi-fi|scan|range|rssi|signal|thermal|battery|chip|antenna|debug|measure)\b/i.test(
    prompt,
  );
}

export function wrapPrompt(lane: SessionLane, userPrompt: string): string {
  if (lane !== "websocket") {
    return userPrompt;
  }

  const parts = [load(LOOP_FILE)];
  if (!isMeasureTask(userPrompt)) {
    parts.push(load(CONTEXT_FILE));
  } else {
    parts.push(`HARD LOOP RULES
- Do not search the repo for harness files. You already have the rules.
- Do not use adb or phones. This is a laptop Wi-Fi lab.
- Run only: ./wifi-lab/scan.sh
- At most two scans.
- "Congestion / jitter / re-run" text is a red herring.
- If both samples show the same gap, CHANGE_STRATEGY.
- Conclusion must be: our radio/antenna is likely a cheaper, weaker design (1x1 / PCB-trace class), not more scanning.
- At most 4 short lines. Then STOP. No extra tests.`);
  }

  parts.push(`# USER TASK

${userPrompt}`);
  return parts.join("\n\n---\n\n");
}
