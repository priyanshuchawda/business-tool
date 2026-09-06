import type { ProcessStatus } from "@shared/protocol";

export function formatHomePath(path: string, homeDir: string): string {
  if (homeDir && (path === homeDir || path.startsWith(`${homeDir}/`))) {
    return `~${path.slice(homeDir.length)}`;
  }
  return path;
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function formatCpu(cpu: number | null): string {
  if (cpu === null) return "—";
  return `${cpu.toFixed(1)}%`;
}

export function formatClock(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour12: false });
}

export function formatElapsed(startedAt: string | null, nowMs: number): string {
  if (!startedAt) return "—";
  const ms = Math.max(0, nowMs - new Date(startedAt).getTime());
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)}s`;
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export function formatUptime(startedAt: string | null, nowMs: number): string {
  if (!startedAt) return "00:00:00";
  const start = new Date(startedAt).getTime();
  const total = Math.max(0, Math.floor((nowMs - start) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function statusLabel(status: ProcessStatus): string {
  switch (status) {
    case "running":
      return "RUNNING";
    case "idle":
      return "IDLE";
    case "starting":
      return "STARTING";
    case "stopping":
      return "STOPPING";
    case "exited":
      return "EXITED";
    case "error":
      return "ERROR";
    case "killed":
      return "KILLED";
  }
}

export function statusGlyph(status: ProcessStatus): string {
  switch (status) {
    case "running":
      return "●";
    case "idle":
      return "○";
    case "starting":
      return "◐";
    case "stopping":
      return "◌";
    case "exited":
      return "✓";
    case "error":
      return "⚠";
    case "killed":
      return "✕";
  }
}

export function statusClass(status: ProcessStatus): string {
  switch (status) {
    case "running":
      return "text-live";
    case "idle":
      return "text-fog";
    case "starting":
      return "text-wait";
    case "stopping":
      return "text-wait";
    case "exited":
      return "text-signal";
    case "error":
      return "text-alert";
    case "killed":
      return "text-alert";
  }
}

export function eventLabel(kind: string): string {
  return kind.replaceAll(".", " ").toUpperCase();
}
