import { RotateCw } from "lucide-react";
import { controlRoom } from "../lib/ws-client";
import { useRoom } from "../store/room";

export function Header() {
  const sessions = useRoom((s) => s.sessions);

  const replay = (): void => {
    for (const session of Object.values(sessions)) {
      if (
        session.lastPrompt &&
        session.status !== "running" &&
        session.status !== "starting"
      ) {
        controlRoom.prompt(session.id, session.lastPrompt);
      }
    }
  };

  return (
    <header className="flex items-center justify-between px-5 py-3">
      <div className="text-[20px] font-medium tracking-[-0.03em] text-paper">Nano Codex</div>
      <button
        type="button"
        onClick={replay}
        className="inline-flex items-center gap-1.5 rounded-full bg-[#1a1a1a] px-3 py-1.5 text-[13px] text-paper hover:bg-[#242424]"
      >
        <RotateCw size={13} />
        Replay
      </button>
    </header>
  );
}
