import { Check, Plus, Square } from "lucide-react";
import { useState } from "react";
import type { CodexSession } from "@shared/protocol";
import { controlRoom } from "../lib/ws-client";
import { useRoom } from "../store/room";

type Props = {
  session: CodexSession;
};

export function PaneComposer({ session }: Props) {
  const [draft, setDraft] = useState("");
  const setNewOpen = useRoom((s) => s.setNewOpen);
  const busy = session.status === "running" || session.status === "starting";

  const send = (): void => {
    const text = draft.trim();
    if (!text || busy) return;
    controlRoom.prompt(session.id, text);
    setDraft("");
  };

  return (
    <div className="px-4 pb-4 pt-2">
      <div className="flex items-center gap-2 rounded-2xl bg-[#1a1a1a] px-3 py-2">
        <button
          type="button"
          title="New terminal"
          onClick={() => setNewOpen(true)}
          className="flex h-8 w-8 shrink-0 items-center justify-center text-fog hover:text-paper"
        >
          <Plus size={16} />
        </button>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              send();
            }
          }}
          placeholder="Do anything"
          disabled={busy}
          className="min-w-0 flex-1 bg-transparent text-[14px] text-paper outline-none placeholder:text-fog disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => controlRoom.setApprove(session.id, !session.approveForMe)}
          className="flex shrink-0 items-center gap-1 text-[13px] text-fog hover:text-paper"
        >
          {session.approveForMe ? <Check size={13} /> : null}
          Approve for me
        </button>
        <div className="flex shrink-0 items-center gap-1.5 text-[12px] text-fog">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-sm bg-[#2a2a2a] text-[9px]">
            ◆
          </span>
          <span>{session.model || "gpt-5.6-luna"}</span>
        </div>
        <button
          type="button"
          title={busy ? "Stop" : "Idle"}
          onClick={() => {
            if (busy) controlRoom.stopSession(session.id);
          }}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-black"
        >
          <Square size={10} fill="currentColor" />
        </button>
      </div>
    </div>
  );
}
