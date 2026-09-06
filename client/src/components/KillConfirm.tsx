import { controlRoom } from "../lib/ws-client";
import { useRoom } from "../store/room";

export function KillConfirm() {
  const killId = useRoom((s) => s.killId);
  const setKillId = useRoom((s) => s.setKillId);
  const session = useRoom((s) => (s.killId ? s.sessions[s.killId] : undefined));
  if (!killId || !session) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65">
      <div className="w-[420px] border border-alert/40 bg-panel p-4">
        <div className="font-mono text-[12px] tracking-[0.18em] text-alert">KILL PROCESS</div>
        <p className="mt-2 font-mono text-[12px] leading-5 text-paper">
          Send SIGKILL to {session.id.toUpperCase()}
          {session.pid ? ` (PID ${session.pid})` : ""}. This cannot be undone.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setKillId(null)}
            className="border border-line px-3 py-1.5 font-mono text-[10px] tracking-wide text-fog hover:text-paper"
          >
            CANCEL
          </button>
          <button
            type="button"
            onClick={() => {
              controlRoom.kill(killId);
              setKillId(null);
            }}
            className="border border-alert/50 bg-alert/10 px-3 py-1.5 font-mono text-[10px] tracking-wide text-alert"
          >
            KILL
          </button>
        </div>
      </div>
    </div>
  );
}
