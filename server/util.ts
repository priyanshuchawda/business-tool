import { existsSync } from "node:fs";
import { delimiter } from "node:path";
import { splitArgs } from "../shared/args.ts";

export { splitArgs };

export function nowIso(): string {
  return new Date().toISOString();
}

export function nextSessionId(existing: Iterable<string>): string {
  const used = new Set(existing);
  for (let n = 1; n < 1000; n += 1) {
    const id = `codex-${String(n).padStart(2, "0")}`;
    if (!used.has(id)) {
      return id;
    }
  }
  throw new Error("session id space exhausted");
}

export function resolveCodexBinary(): string {
  const fromEnv = process.env.CODEX_BIN;
  if (fromEnv && existsSync(fromEnv)) {
    return fromEnv;
  }
  const pathEnv = process.env.PATH ?? "";
  for (const dir of pathEnv.split(delimiter)) {
    if (!dir) continue;
    const candidate = `${dir}/codex`;
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error("codex binary not found in PATH. Set CODEX_BIN to an absolute path.");
}

export function validateExtraArgs(args: string[]): string[] {
  if (args.length > 32) {
    throw new Error("too many extra arguments (max 32)");
  }
  for (const arg of args) {
    if (arg.length > 512) {
      throw new Error("argument exceeds 512 characters");
    }
    if (arg.includes("\0")) {
      throw new Error("invalid argument");
    }
  }
  return args;
}
