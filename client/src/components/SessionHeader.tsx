import type { CodexSession } from "@shared/protocol";
import { Maximize2 } from "lucide-react";
import { formatHomePath, statusClass, statusGlyph, statusLabel } from "../lib/format";
import { useRoom } from "../store/room";

type Props = {
  session: CodexSession;
  hot?: boolean;
};

export function SessionHeader({ session, hot }: Props) {
  const homeDir = useRoom((s) => s.homeDir);
  const setFocused = useRoom((s) => s.setFocused);

  return (
    <div className="flex items-start justify-between gap-3 border-b border-line px-3 py-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] font-semibold tracking-[0.18em] text-paper">
            {session.id.toUpperCase()}
          </span>
          {hot ? <span className="h-1.5 w-1.5 rounded-full bg-live pulse-live" /> : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px]">
          <span className={`${statusClass(session.status)} tracking-wide`}>
            {statusGlyph(session.status)} {statusLabel(session.status)}
          </span>
          <span className="text-fog">
            PID <span className="text-paper">{session.pid ?? "—"}</span>
          </span>
          <span className="text-fog">
            PPID <span className="text-paper">{session.ppid ?? "—"}</span>
          </span>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 font-mono text-[10px] text-fog">
          <span className="truncate text-signal">{session.model || "default model"}</span>
          <span className="truncate">{formatHomePath(session.cwd, homeDir)}</span>
          {session.exitCode !== null ? <span>exit {session.exitCode}</span> : null}
          {session.exitSignal ? <span>sig {session.exitSignal}</span> : null}
        </div>
      </div>
      <button
        type="button"
        title="Focus this session"
        onClick={() => setFocused(session.id)}
        className="rounded-sm p-1 text-fog hover:bg-panel-2 hover:text-paper"
      >
        <Maximize2 size={13} />
      </button>
    </div>
  );
}
