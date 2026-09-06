import type { CodexSession } from "@shared/protocol";
import { CodexSessionCard } from "./CodexSessionCard";
import { useRoom } from "../store/room";

type Props = {
  sessions: CodexSession[];
  nowMs: number;
};

export function SessionGrid({ sessions, nowMs }: Props) {
  const layout = useRoom((s) => s.layout);
  const focusedId = useRoom((s) => s.focusedId);
  const lastActivityAt = useRoom((s) => s.lastActivityAt);
  const setFocused = useRoom((s) => s.setFocused);
  const hotWindow = Date.now() - 1200;

  if (layout === "focus" && focusedId) {
    const focused = sessions.find((session) => session.id === focusedId);
    if (!focused) return null;
    return (
      <div className="grid min-h-0 flex-1 grid-cols-[200px_minmax(0,1fr)] gap-3 px-4 pb-4">
        <aside className="flex min-h-0 flex-col gap-2 overflow-auto scrollbar-thin">
          {sessions.map((session) => (
            <button
              key={session.id}
              type="button"
              onClick={() => setFocused(session.id)}
              className={`rounded-xl px-3 py-2 text-left ${
                session.id === focusedId ? "bg-panel" : "bg-transparent text-fog"
              }`}
            >
              <div className="text-[13px] text-paper">{session.id.toUpperCase()}</div>
              <div className="mt-0.5 font-mono text-[11px] text-fog">PID {session.pid ?? "—"}</div>
            </button>
          ))}
        </aside>
        <CodexSessionCard
          session={focused}
          nowMs={nowMs}
          active
          hot={(lastActivityAt[focused.id] ?? 0) > hotWindow}
          onSelect={() => setFocused(focused.id)}
        />
      </div>
    );
  }

  const columns =
    layout === "grid-4" ? "grid-cols-4" : layout === "grid-3" ? "grid-cols-3" : "grid-cols-2";

  return (
    <div className={`grid min-h-0 flex-1 gap-3 px-4 pb-4 ${columns}`}>
      {sessions.map((session, index) => (
        <CodexSessionCard
          key={session.id}
          session={session}
          nowMs={nowMs}
          compact={layout === "compact"}
          active={focusedId === session.id || (!focusedId && index === 0)}
          hot={(lastActivityAt[session.id] ?? 0) > hotWindow}
          onSelect={() => useRoom.setState({ focusedId: session.id })}
        />
      ))}
    </div>
  );
}
