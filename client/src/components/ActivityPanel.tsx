import { ChevronDown, ChevronUp } from "lucide-react";
import { eventLabel, formatClock } from "../lib/format";
import { useRoom } from "../store/room";

export function ActivityPanel() {
  const events = useRoom((s) => s.events);
  const open = useRoom((s) => s.activityOpen);
  const setOpen = useRoom((s) => s.setActivityOpen);
  const recent = [...events].reverse().slice(0, 80);

  return (
    <section className="border-t border-line bg-panel">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-1.5 font-mono text-[10px] tracking-[0.16em] text-fog hover:text-paper"
      >
        <span>PROCESS EVENT STREAM</span>
        {open ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
      </button>
      {open ? (
        <div className="h-36 overflow-auto border-t border-line px-3 py-2 font-mono text-[11px] scrollbar-thin">
          {recent.length === 0 ? (
            <div className="text-fog">Waiting for process manager events.</div>
          ) : (
            recent.map((event, index) => (
              <div key={`${event.id}-${index}`} className="grid grid-cols-[72px_96px_1fr_1fr] gap-3 py-0.5">
                <span className="text-fog">{formatClock(event.ts)}</span>
                <span className="text-signal">{event.sessionId?.toUpperCase() ?? "ROOM"}</span>
                <span className="text-paper">{eventLabel(event.kind)}</span>
                <span className="truncate text-fog">{event.message}</span>
              </div>
            ))
          )}
        </div>
      ) : null}
    </section>
  );
}
