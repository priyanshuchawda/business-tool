import { useRoom } from "../store/room";

export function ConnectionBanner() {
  const connection = useRoom((s) => s.connection);
  const notice = useRoom((s) => s.notice);
  const setNotice = useRoom((s) => s.setNotice);

  if (connection === "open" && !notice) return null;

  return (
    <div className="flex items-center justify-between border-b border-alert/30 bg-alert/10 px-4 py-1.5 font-mono text-[11px] text-alert">
      <span>
        {connection !== "open" ? "⚠ CONNECTION LOST — retrying WebSocket" : notice}
      </span>
      {notice ? (
        <button type="button" onClick={() => setNotice(null)} className="text-fog hover:text-paper">
          dismiss
        </button>
      ) : null}
    </div>
  );
}
