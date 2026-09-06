import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { SessionLane } from "../shared/protocol.ts";

const FILE = resolve(dirname(fileURLToPath(import.meta.url)), "..", "HARNESS_CONTEXT.md");

export function loadHarnessContext(): string {
  return readFileSync(FILE, "utf8");
}

export function wrapPrompt(lane: SessionLane, userPrompt: string): string {
  if (lane !== "websocket") {
    return userPrompt;
  }
  const context = loadHarnessContext();
  return `${context}

---

# USER TASK

Read and follow HARNESS_CONTEXT.md above as the source of truth before answering.
Do not compete with Dell, HP, Lenovo, or Apple first.
Start with small / local / emerging laptop makers and contract manufacturers.

${userPrompt}
`;
}
