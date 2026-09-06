import type { TranscriptItem } from "./transcript.ts";

export type { TranscriptItem };
export const PROTOCOL_VERSION = 1;

export type ProcessStatus =
  | "idle"
  | "starting"
  | "running"
  | "stopping"
  | "exited"
  | "error"
  | "killed";

export type SessionMetrics = {
  cpuPercent: number | null;
  memoryBytes: number | null;
  sampledAt: string;
};

export type SessionLane = "http" | "websocket";

export type CodexSession = {
  id: string;
  pid: number | null;
  ppid: number | null;
  command: string;
  model: string;
  cwd: string;
  extraArgs: string[];
  status: ProcessStatus;
  startedAt: string | null;
  exitedAt: string | null;
  exitCode: number | null;
  exitSignal: string | null;
  cols: number;
  rows: number;
  ptyConnected: boolean;
  bytesOut: number;
  lane: SessionLane;
  harnessApplied: boolean;
  threadId: string | null;
  approveForMe: boolean;
  turnCount: number;
  lastPrompt: string | null;
  transcript: TranscriptItem[];
  metrics: SessionMetrics;
};

export type ProcessEventKind =
  | "process.started"
  | "process.exited"
  | "process.killed"
  | "process.error"
  | "pty.connected"
  | "pty.disconnected"
  | "user.input"
  | "output.received"
  | "session.created"
  | "session.removed"
  | "session.restarted";

export type ProcessEvent = {
  id: string;
  ts: string;
  sessionId: string | null;
  kind: ProcessEventKind;
  message: string;
};

export type SessionCreateRequest = {
  cwd: string;
  model: string;
  extraArgs: string[];
  start?: boolean;
  lane?: SessionLane;
  approveForMe?: boolean;
};

export type ClientMessage =
  | { type: "session.create"; requestId: string; request: SessionCreateRequest }
  | { type: "session.start"; requestId: string; sessionId: string }
  | { type: "session.stop"; requestId: string; sessionId: string }
  | { type: "session.restart"; requestId: string; sessionId: string }
  | { type: "session.kill"; requestId: string; sessionId: string }
  | { type: "session.remove"; requestId: string; sessionId: string }
  | { type: "terminal.input"; sessionId: string; data: string }
  | { type: "terminal.resize"; sessionId: string; cols: number; rows: number }
  | { type: "terminal.ctrlc"; sessionId: string }
  | { type: "session.prompt"; sessionId: string; text: string }
  | { type: "session.setApprove"; sessionId: string; approve: boolean }
  | { type: "session.list"; requestId: string };

export type ServerMessage =
  | { type: "hello"; startedAt: string; protocolVersion: number; homeDir: string }
  | { type: "session.snapshot"; sessions: CodexSession[]; events: ProcessEvent[] }
  | { type: "session.created"; session: CodexSession }
  | { type: "session.updated"; session: CodexSession }
  | { type: "session.removed"; sessionId: string }
  | { type: "terminal.output"; sessionId: string; data: string }
  | { type: "terminal.replay"; sessionId: string; data: string }
  | { type: "terminal.exit"; sessionId: string; exitCode: number | null; signal: string | null }
  | { type: "process.status"; sessionId: string; status: ProcessStatus }
  | { type: "process.metrics"; sessionId: string; metrics: SessionMetrics }
  | { type: "event"; event: ProcessEvent }
  | { type: "error"; requestId?: string; message: string }
  | { type: "ok"; requestId: string };

export type LayoutMode = "grid-2" | "grid-3" | "grid-4" | "focus" | "compact";
