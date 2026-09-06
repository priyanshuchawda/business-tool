import type { ReactNode } from "react";
import type { CodexSession } from "@shared/protocol";
import {
  CircleStop,
  Copy,
  Maximize2,
  Play,
  RefreshCw,
  Square,
  TerminalSquare,
  Trash2,
  Unplug,
} from "lucide-react";
import { terminalBus } from "../lib/terminal-bus";
import { controlRoom } from "../lib/ws-client";
import { useRoom } from "../store/room";

type Props = {
  session: CodexSession;
};

export function TerminalControls({ session }: Props) {
  const running = session.status === "running" || session.status === "starting";
  const setKillId = useRoom((s) => s.setKillId);
  const setFocused = useRoom((s) => s.setFocused);

  return (
    <div className="flex flex-wrap items-center gap-1 border-t border-line px-2 py-1.5">
      <Control
        label="Start"
        disabled={running}
        onClick={() => controlRoom.startSession(session.id)}
        icon={<Play size={11} />}
      />
      <Control
        label="Stop"
        disabled={!running}
        onClick={() => controlRoom.stopSession(session.id)}
        icon={<CircleStop size={11} />}
      />
      <Control
        label="Restart"
        onClick={() => controlRoom.restart(session.id)}
        icon={<RefreshCw size={11} />}
      />
      <Control
        label="Kill"
        danger
        disabled={!running}
        onClick={() => setKillId(session.id)}
        icon={<Square size={11} />}
      />
      <span className="mx-1 h-3 w-px bg-line" />
      <Control
        label="Ctrl+C"
        disabled={!running}
        onClick={() => controlRoom.ctrlc(session.id)}
        icon={<TerminalSquare size={11} />}
      />
      <Control
        label="Clear"
        onClick={() => terminalBus.clear(session.id)}
        icon={<Trash2 size={11} />}
      />
      <Control
        label="Copy"
        onClick={() => {
          void terminalBus.copy(session.id);
        }}
        icon={<Copy size={11} />}
      />
      <Control
        label="Focus"
        onClick={() => setFocused(session.id)}
        icon={<Maximize2 size={11} />}
      />
      <Control
        label="Reconnect"
        onClick={() => controlRoom.startSession(session.id)}
        disabled={running}
        icon={<Unplug size={11} />}
      />
    </div>
  );
}

function Control({
  label,
  onClick,
  icon,
  disabled,
  danger,
}: {
  label: string;
  onClick: () => void;
  icon: ReactNode;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-1 font-mono text-[10px] tracking-wide uppercase transition ${
        danger
          ? "text-alert/80 hover:bg-alert/10 hover:text-alert"
          : "text-fog hover:bg-panel-2 hover:text-paper"
      } disabled:cursor-not-allowed disabled:opacity-30`}
    >
      {icon}
      {label}
    </button>
  );
}
