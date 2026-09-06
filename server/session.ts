import { spawn as spawnChild, type ChildProcess } from "node:child_process";
import { spawn, type IPty } from "node-pty";
import type {
  CodexSession,
  ProcessEvent,
  ProcessEventKind,
  ProcessStatus,
  SessionLane,
  SessionMetrics,
} from "../shared/protocol.ts";
import { emptyItem, type TranscriptItem } from "../shared/transcript.ts";
import { wrapPrompt } from "./harness-context.ts";
import { ExecEventParser } from "./parse-exec.ts";
import { forgetMetrics, readParentPid, sampleProcessTree } from "./metrics.ts";
import { nowIso } from "./util.ts";

const OUTPUT_BUFFER_LIMIT = 256 * 1024;

export type SessionListener = {
  onCreated: (session: CodexSession) => void;
  onUpdated: (session: CodexSession) => void;
  onRemoved: (sessionId: string) => void;
  onOutput: (sessionId: string, data: string) => void;
  onEvent: (event: ProcessEvent) => void;
  onExit: (sessionId: string, exitCode: number | null, signal: string | null) => void;
};

export class CodexSessionRuntime {
  readonly id: string;
  readonly command: string;
  readonly model: string;
  readonly cwd: string;
  readonly extraArgs: string[];
  readonly lane: SessionLane;

  private status: ProcessStatus = "idle";
  private pid: number | null = null;
  private ppid: number | null = null;
  private startedAt: string | null = null;
  private exitedAt: string | null = null;
  private exitCode: number | null = null;
  private exitSignal: string | null = null;
  private cols: number;
  private rows: number;
  private ptyConnected = false;
  private bytesOut = 0;
  private approveForMe = true;
  private threadId: string | null = null;
  private turnCount = 0;
  private lastPrompt: string | null = null;
  private transcript: TranscriptItem[] = [];
  private exec: ChildProcess | null = null;
  private metrics: SessionMetrics = {
    cpuPercent: null,
    memoryBytes: null,
    sampledAt: nowIso(),
  };
  private pty: IPty | null = null;
  private outputBuffer = "";
  private lastOutputEventAt = 0;
  private readonly listener: SessionListener;

  constructor(opts: {
    id: string;
    command: string;
    model: string;
    cwd: string;
    extraArgs: string[];
    lane: SessionLane;
    approveForMe?: boolean;
    cols?: number;
    rows?: number;
    listener: SessionListener;
  }) {
    this.id = opts.id;
    this.command = opts.command;
    this.model = opts.model;
    this.cwd = opts.cwd;
    this.extraArgs = opts.extraArgs;
    this.lane = opts.lane;
    this.approveForMe = opts.approveForMe ?? true;
    this.cols = opts.cols ?? 120;
    this.rows = opts.rows ?? 36;
    this.listener = opts.listener;
  }

  snapshot(): CodexSession {
    return {
      id: this.id,
      pid: this.pid,
      ppid: this.ppid,
      command: this.command,
      model: this.model,
      cwd: this.cwd,
      extraArgs: this.extraArgs,
      status: this.status,
      startedAt: this.startedAt,
      exitedAt: this.exitedAt,
      exitCode: this.exitCode,
      exitSignal: this.exitSignal,
      cols: this.cols,
      rows: this.rows,
      ptyConnected: this.ptyConnected,
      bytesOut: this.bytesOut,
      lane: this.lane,
      harnessApplied: this.lane === "websocket",
      threadId: this.threadId,
      approveForMe: this.approveForMe,
      turnCount: this.turnCount,
      lastPrompt: this.lastPrompt,
      transcript: this.transcript,
      metrics: this.metrics,
    };
  }

  replayBuffer(): string {
    return this.outputBuffer;
  }

  start(): void {
    if (this.pty) {
      throw new Error(`${this.id} is already running`);
    }

    this.setStatus("starting");
    this.exitCode = null;
    this.exitSignal = null;
    this.exitedAt = null;
    this.bytesOut = 0;

    const args: string[] = [];
    if (this.model.trim()) {
      args.push("--model", this.model.trim());
    }
    args.push(...this.extraArgs);

    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (typeof value === "string") {
        env[key] = value;
      }
    }
    env.TERM = "xterm-256color";
    env.COLORTERM = "truecolor";
    env.FORCE_COLOR = "1";

    let pty: IPty;
    try {
      pty = spawn(this.command, args, {
        name: "xterm-256color",
        cols: this.cols,
        rows: this.rows,
        cwd: this.cwd,
        env,
      });
    } catch (error) {
      this.setStatus("error");
      this.emit("process.error", error instanceof Error ? error.message : "failed to spawn");
      throw error;
    }

    this.pty = pty;
    this.pid = pty.pid;
    this.ppid = readParentPid(pty.pid);
    this.startedAt = nowIso();
    this.ptyConnected = true;
    this.setStatus("running");
    this.emit("process.started", `PID ${pty.pid}`);
    this.emit("pty.connected", `PTY attached · ${this.cols}×${this.rows}`);
    this.listener.onUpdated(this.snapshot());

    pty.onData((data) => {
      this.appendOutput(data);
      this.listener.onOutput(this.id, data);
      const now = Date.now();
      if (now - this.lastOutputEventAt > 2000) {
        this.lastOutputEventAt = now;
        this.emit("output.received", `${data.length} bytes`);
      }
    });

    pty.onExit(({ exitCode, signal }) => {
      const trackedPid = this.pid;
      if (trackedPid !== null) {
        forgetMetrics(trackedPid);
      }
      this.pty = null;
      this.ptyConnected = false;
      this.exitedAt = nowIso();
      this.exitCode = exitCode;
      this.exitSignal = signal !== undefined && signal !== 0 ? String(signal) : null;
      if (this.status !== "killed") {
        this.setStatus("exited");
      }
      this.emit("pty.disconnected", "PTY closed");
      this.emit(
        "process.exited",
        `exit ${exitCode}${this.exitSignal ? ` · signal ${this.exitSignal}` : ""}`,
      );
      this.listener.onExit(this.id, exitCode, this.exitSignal);
      this.listener.onUpdated(this.snapshot());
    });
  }

  write(data: string): void {
    if (this.pty) {
      this.pty.write(data);
      return;
    }
    const text = data.replaceAll("\r", "").trim();
    if (text) {
      this.prompt(text);
    }
  }

  setApprove(approve: boolean): void {
    this.approveForMe = approve;
    this.listener.onUpdated(this.snapshot());
  }

  prompt(text: string): void {
    const prompt = text.trim();
    if (!prompt) return;
    if (this.exec) {
      throw new Error(`${this.id} is already running a turn`);
    }

    this.lastPrompt = prompt;
    this.turnCount += 1;
    const user = emptyItem("user", `${this.id}-user-${this.turnCount}`);
    user.text = prompt;
    this.transcript = [...this.transcript, user];

    const api = emptyItem("api", `${this.id}-api-${this.turnCount}`);
    api.detail = this.lane === "http" ? `Full replay  response.create  #${this.turnCount}` : `Incremental  response.create  #${this.turnCount}`;
    api.inputItems = 1;
    api.uploadBytes = Buffer.byteLength(wrapPrompt(this.lane, prompt));
    api.open = true;
    this.transcript = [...this.transcript, api];
    const apiId = api.id;
    const started = Date.now();

    this.setStatus("starting");
    const args = this.buildExecArgs(prompt);
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (typeof value === "string") env[key] = value;
    }

    const child = spawnChild(this.command, args, {
      cwd: this.cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    this.exec = child;
    this.pid = child.pid ?? null;
    this.ppid = this.pid !== null ? readParentPid(this.pid) : null;
    this.startedAt = this.startedAt ?? nowIso();
    this.ptyConnected = true;
    this.setStatus("running");
    this.emit("process.started", `exec PID ${this.pid ?? "—"}`);
    this.listener.onUpdated(this.snapshot());

    const parser = new ExecEventParser();
    let stdout = "";
    const onChunk = (chunk: Buffer): void => {
      const data = chunk.toString("utf8");
      this.appendOutput(data);
      stdout += data;
      const lines = stdout.split("\n");
      stdout = lines.pop() ?? "";
      for (const line of lines) {
        for (const item of parser.ingest(line)) {
          this.upsertTranscript(item);
        }
      }
      if (parser.threadId) this.threadId = parser.threadId;
      this.patchApi(apiId, Date.now() - started);
      this.listener.onUpdated(this.snapshot());
    };
    child.stdout?.on("data", onChunk);
    child.stderr?.on("data", (chunk: Buffer) => {
      this.appendOutput(chunk.toString("utf8"));
    });
    child.on("error", (error) => {
      this.exec = null;
      this.ptyConnected = false;
      this.setStatus("error");
      this.emit("process.error", error.message);
    });
    child.on("exit", (code, signal) => {
      if (stdout.trim()) {
        for (const item of parser.ingest(stdout)) {
          this.upsertTranscript(item);
        }
      }
      if (parser.threadId) this.threadId = parser.threadId;
      this.patchApi(apiId, Date.now() - started);
      this.exec = null;
      this.ptyConnected = false;
      this.exitCode = code;
      this.exitSignal = signal ?? null;
      this.setStatus(code === 0 || code === null ? "idle" : "exited");
      this.emit("process.exited", `exit ${code ?? 0}`);
      this.listener.onUpdated(this.snapshot());
    });
  }

  sendCtrlC(): void {
    this.write("\u0003");
    this.emit("user.input", "Ctrl+C");
  }

  resize(cols: number, rows: number): void {
    const nextCols = Math.max(20, Math.min(400, Math.floor(cols)));
    const nextRows = Math.max(8, Math.min(200, Math.floor(rows)));
    this.cols = nextCols;
    this.rows = nextRows;
    if (this.pty) {
      this.pty.resize(nextCols, nextRows);
    }
    this.listener.onUpdated(this.snapshot());
  }

  stop(): void {
    if (this.exec) {
      this.setStatus("stopping");
      this.exec.kill("SIGTERM");
      return;
    }
    if (!this.pty) return;
    this.setStatus("stopping");
    this.pty.write("\u0003");
    const handle = this.pty;
    setTimeout(() => {
      if (this.pty === handle) {
        handle.kill("SIGTERM");
      }
    }, 400);
  }

  kill(): void {
    if (this.exec) {
      this.setStatus("killed");
      this.exec.kill("SIGKILL");
      this.emit("process.killed", "SIGKILL");
      return;
    }
    if (!this.pty) return;
    this.setStatus("killed");
    this.pty.kill("SIGKILL");
    this.emit("process.killed", "SIGKILL");
  }

  sampleMetrics(): SessionMetrics {
    if (this.pid === null || (!this.pty && !this.exec)) {
      this.metrics = {
        cpuPercent: null,
        memoryBytes: null,
        sampledAt: nowIso(),
      };
      return this.metrics;
    }
    const sample = sampleProcessTree(this.pid);
    this.metrics = {
      cpuPercent: sample.cpuPercent,
      memoryBytes: sample.memoryBytes,
      sampledAt: nowIso(),
    };
    if (this.ppid === null) {
      this.ppid = readParentPid(this.pid);
    }
    return this.metrics;
  }

  dispose(): void {
    if (this.exec) {
      this.exec.kill("SIGKILL");
      this.exec = null;
    }
    if (this.pty) {
      this.pty.kill("SIGKILL");
      this.pty = null;
    }
    if (this.pid !== null) {
      forgetMetrics(this.pid);
    }
  }

  private buildExecArgs(prompt: string): string[] {
    const args: string[] = ["exec"];
    if (this.lane === "websocket" && this.threadId) {
      args.push("resume", this.threadId);
    }
    args.push("--json", "--color", "never", "--skip-git-repo-check");
    if (this.approveForMe) args.push("--approve-for-me");
    if (this.model.trim()) args.push("--model", this.model.trim());
    args.push("-C", this.cwd);
    args.push(...this.extraArgs);
    args.push(wrapPrompt(this.lane, prompt));
    return args;
  }

  private upsertTranscript(item: TranscriptItem): void {
    const index = this.transcript.findIndex((row) => row.id === item.id);
    if (index >= 0) {
      const current = this.transcript[index];
      if (!current) return;
      const next = [...this.transcript];
      next[index] = { ...current, ...item, id: item.id };
      this.transcript = next;
      return;
    }
    this.transcript = [...this.transcript, item];
  }

  private patchApi(id: string, timeMs: number): void {
    this.transcript = this.transcript.map((row) =>
      row.id === id
        ? { ...row, timeMs, inputItems: Math.max(row.inputItems, 1) }
        : row,
    );
  }

  private setStatus(status: ProcessStatus): void {
    this.status = status;
    this.listener.onUpdated(this.snapshot());
  }

  private appendOutput(data: string): void {
    this.bytesOut += data.length;
    this.outputBuffer += data;
    if (this.outputBuffer.length > OUTPUT_BUFFER_LIMIT) {
      this.outputBuffer = this.outputBuffer.slice(this.outputBuffer.length - OUTPUT_BUFFER_LIMIT);
    }
  }

  private emit(kind: ProcessEventKind, message: string): void {
    this.listener.onEvent({
      id: `${this.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ts: nowIso(),
      sessionId: this.id,
      kind,
      message,
    });
  }
}
