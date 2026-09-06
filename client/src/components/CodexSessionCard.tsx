import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { CodexSession } from "@shared/protocol";
import type { TranscriptItem } from "@shared/transcript";
import { formatBytes, formatElapsed } from "../lib/format";
import { PaneComposer } from "./PaneComposer";

type Props = {
  session: CodexSession;
  nowMs: number;
  compact?: boolean;
  active: boolean;
  hot: boolean;
  onSelect: () => void;
};

export function CodexSessionCard({ session, nowMs, active, onSelect }: Props) {
  const http = session.lane === "http";
  const ready = session.status === "idle" || session.status === "exited" || session.status === "running";
  const busy = session.status === "running" || session.status === "starting";
  const items = session.transcript ?? [];

  return (
    <article
      onMouseDown={onSelect}
      className={`flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[18px] bg-[#111] ${
        active ? "" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-2">
        <div className="min-w-0 text-[13px] leading-5">
          <div className="mb-1 text-[15px] font-medium tracking-[-0.02em] text-paper">
            {http ? "WITHOUT HARNESS ENGINEERING" : "WITH HARNESS ENGINEERING"}
          </div>
          <div>
            <span className="font-medium text-paper">{http ? "HTTP" : "WebSocket"}</span>
            <span className="text-fog">
              {" "}
              {http ? "Fresh request — retained window replay" : "Persistent socket — incremental continuation"}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-[12px] text-fog">
          <span>{formatElapsed(session.startedAt, nowMs)}</span>
          <span>{formatBytes(session.bytesOut ?? 0)}</span>
          <span className={busy ? "text-wait" : "text-live"}>
            <span className="mr-1">{busy ? "●" : "●"}</span>
            {busy ? "Running" : ready ? "Ready" : session.status}
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-auto px-5 py-2 scrollbar-thin">
        {items.length === 0 ? (
          <div className="rounded-2xl bg-[#1a1a1a] px-4 py-3 text-[14px] text-fog">
            Type below. This pane talks to a real Codex process
            {http ? " as a fresh exec each turn" : " and continues the same thread"}.
          </div>
        ) : (
          items.map((item) => <TranscriptRow key={item.id} item={item} />)
        )}
      </div>
      <PaneComposer session={session} />
    </article>
  );
}

function TranscriptRow({ item }: { item: TranscriptItem }) {
  const [open, setOpen] = useState(item.open);
  if (item.kind === "user") {
    return (
      <div className="max-w-[92%] rounded-2xl bg-[#1c1c1c] px-4 py-3 text-[14px] leading-6 text-paper">
        {item.text}
      </div>
    );
  }
  if (item.kind === "api") {
    return (
      <div className="rounded-xl bg-[#161616] px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center gap-2 text-left text-[13px] text-paper"
        >
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span className="font-medium">Responses API</span>
        </button>
        {open ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1 pb-1 text-[12px] text-fog">
            <span>
              {item.detail || "response.create"}
            </span>
            <span className="flex gap-4">
              <span>
                INPUT <span className="text-paper">{item.inputItems} items</span>
              </span>
              <span>
                UPLOAD <span className="text-paper">{formatBytes(item.uploadBytes)}</span>
              </span>
              <span>
                TIME <span className="text-paper">{(item.timeMs / 1000).toFixed(2)}s</span>
              </span>
            </span>
          </div>
        ) : null}
      </div>
    );
  }
  if (item.kind === "thought") {
    return <div className="px-1 text-[14px] leading-6 text-[#d4d4d4]">{item.text}</div>;
  }
  if (item.kind === "shell") {
    return (
      <div className="rounded-xl bg-[#161616]">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-paper"
        >
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Ran shell command
          <span className="text-fog">{item.command ? `  ${item.command}` : " ›"}</span>
        </button>
        {open && item.output ? (
          <pre className="max-h-48 overflow-auto px-4 pb-3 font-mono text-[12px] leading-5 text-fog scrollbar-thin">
            {item.output}
          </pre>
        ) : null}
      </div>
    );
  }
  return (
    <div className="px-1 font-mono text-[13px] leading-6 text-[#ececec]">{item.text}</div>
  );
}
