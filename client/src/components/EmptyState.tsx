import { useRoom } from "../store/room";

export function EmptyState() {
  const setNewOpen = useRoom((s) => s.setNewOpen);
  const connection = useRoom((s) => s.connection);

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-8">
      <div className="max-w-md rounded-2xl bg-panel px-6 py-8 ring-1 ring-line">
        <div className="text-[18px] font-medium text-paper">No terminals yet</div>
        <p className="mt-2 text-[14px] leading-6 text-fog">
          Two panes talk to real Codex. Type in Do anything — HTTP is a fresh exec, WebSocket
          continues the same thread.
        </p>
        <button
          type="button"
          disabled={connection !== "open"}
          onClick={() => setNewOpen(true)}
          className="mt-5 rounded-full bg-paper px-4 py-2 text-[13px] text-black disabled:opacity-40"
        >
          New terminal
        </button>
      </div>
    </div>
  );
}
