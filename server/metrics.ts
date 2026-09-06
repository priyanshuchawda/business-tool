import { readdirSync, readFileSync } from "node:fs";

type CpuSample = {
  pid: number;
  totalJiffies: number;
  atMs: number;
};

const previous = new Map<number, CpuSample>();

function readProcText(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function parseStat(pid: number): { ppid: number; utime: number; stime: number } | null {
  const text = readProcText(`/proc/${pid}/stat`);
  if (!text) return null;
  const close = text.lastIndexOf(")");
  if (close < 0) return null;
  const rest = text.slice(close + 2).split(" ");
  const ppid = Number(rest[1]);
  const utime = Number(rest[11]);
  const stime = Number(rest[12]);
  if (!Number.isFinite(ppid) || !Number.isFinite(utime) || !Number.isFinite(stime)) {
    return null;
  }
  return { ppid, utime, stime };
}

function parseRssBytes(pid: number): number | null {
  const text = readProcText(`/proc/${pid}/status`);
  if (!text) return null;
  const match = text.match(/^VmRSS:\s+(\d+)\s+kB$/m);
  if (!match) return null;
  const kb = Number(match[1]);
  if (!Number.isFinite(kb)) return null;
  return kb * 1024;
}

function childPids(rootPid: number): number[] {
  const found = new Set<number>([rootPid]);
  let added = true;
  let entries: string[] = [];
  try {
    entries = readdirSync("/proc");
  } catch {
    return [rootPid];
  }
  const numeric = entries.filter((name) => /^\d+$/.test(name)).map((name) => Number(name));
  while (added) {
    added = false;
    for (const pid of numeric) {
      if (found.has(pid)) continue;
      const stat = parseStat(pid);
      if (stat && found.has(stat.ppid)) {
        found.add(pid);
        added = true;
      }
    }
  }
  return [...found];
}

export function readParentPid(pid: number): number | null {
  return parseStat(pid)?.ppid ?? null;
}

export function sampleProcessTree(rootPid: number): {
  cpuPercent: number | null;
  memoryBytes: number | null;
} {
  const pids = childPids(rootPid);
  let memory = 0;
  let memoryOk = false;
  let jiffies = 0;
  let cpuOk = false;

  for (const pid of pids) {
    const rss = parseRssBytes(pid);
    if (rss !== null) {
      memory += rss;
      memoryOk = true;
    }
    const stat = parseStat(pid);
    if (stat) {
      jiffies += stat.utime + stat.stime;
      cpuOk = true;
    }
  }

  const now = Date.now();
  let cpuPercent: number | null = null;
  if (cpuOk) {
    const prev = previous.get(rootPid);
    previous.set(rootPid, { pid: rootPid, totalJiffies: jiffies, atMs: now });
    if (prev && now > prev.atMs) {
      const hz = 100;
      const deltaSec = (now - prev.atMs) / 1000;
      const deltaJiffies = Math.max(0, jiffies - prev.totalJiffies);
      cpuPercent = (deltaJiffies / hz / deltaSec) * 100;
      if (!Number.isFinite(cpuPercent)) {
        cpuPercent = null;
      } else {
        cpuPercent = Math.min(cpuPercent, 100 * (pids.length || 1));
      }
    }
  }

  return {
    cpuPercent,
    memoryBytes: memoryOk ? memory : null,
  };
}

export function forgetMetrics(pid: number): void {
  previous.delete(pid);
}
