import type { CodexSession } from "@shared/protocol";
import { formatBytes, formatCpu, formatUptime } from "../lib/format";

type Props = {
  session: CodexSession;
  nowMs: number;
};

export function ProcessMetadata({ session, nowMs }: Props) {
  return (
    <div className="grid grid-cols-4 gap-2 border-t border-line bg-panel-2/80 px-3 py-1.5 font-mono text-[10px] tracking-wide text-fog">
      <Meta label="CPU" value={formatCpu(session.metrics.cpuPercent)} />
      <Meta label="MEM" value={formatBytes(session.metrics.memoryBytes)} />
      <Meta label="UPTIME" value={session.startedAt ? formatUptime(session.startedAt, nowMs) : "—"} />
      <Meta
        label="PTY"
        value={session.ptyConnected ? "CONNECTED" : "—"}
        live={session.ptyConnected}
      />
    </div>
  );
}

function Meta({ label, value, live }: { label: string; value: string; live?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-fog/70">{label}</span>
      <span className={live ? "text-live" : "text-paper"}>{value}</span>
    </div>
  );
}
