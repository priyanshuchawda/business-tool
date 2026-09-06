import { realpathSync, statSync } from "node:fs";
import { resolve } from "node:path";
import type {
  CodexSession,
  ProcessEvent,
  SessionCreateRequest,
  SessionMetrics,
} from "../shared/protocol.ts";
import { CodexSessionRuntime, type SessionListener } from "./session.ts";
import { nextSessionId, nowIso, resolveCodexBinary, validateExtraArgs } from "./util.ts";

const MAX_SESSIONS = 8;
const MAX_EVENTS = 400;

export class CodexProcessManager {
  readonly startedAt = nowIso();
  private readonly sessions = new Map<string, CodexSessionRuntime>();
  private readonly events: ProcessEvent[] = [];
  private readonly listeners = new Set<SessionListener>();
  private readonly binary: string;
  private metricsTimer: ReturnType<typeof setInterval> | null = null;
  private readonly metricsSubscribers = new Set<(sessionId: string, metrics: SessionMetrics) => void>();

  constructor() {
    this.binary = resolveCodexBinary();
    this.metricsTimer = setInterval(() => {
      for (const session of this.sessions.values()) {
        const metrics = session.sampleMetrics();
        for (const subscriber of this.metricsSubscribers) {
          subscriber(session.id, metrics);
        }
      }
    }, 1000);
    this.metricsTimer.unref?.();
  }

  onListener(listener: SessionListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  onMetrics(subscriber: (sessionId: string, metrics: SessionMetrics) => void): () => void {
    this.metricsSubscribers.add(subscriber);
    return () => {
      this.metricsSubscribers.delete(subscriber);
    };
  }

  list(): CodexSession[] {
    return [...this.sessions.values()].map((session) => session.snapshot());
  }

  listEvents(): ProcessEvent[] {
    return [...this.events];
  }

  get(sessionId: string): CodexSessionRuntime {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`unknown session ${sessionId}`);
    }
    return session;
  }

  replay(sessionId: string): string {
    return this.get(sessionId).replayBuffer();
  }

  create(request: SessionCreateRequest): CodexSession {
    if (this.sessions.size >= MAX_SESSIONS) {
      throw new Error(`session limit reached (${MAX_SESSIONS})`);
    }
    const cwd = this.assertCwd(request.cwd);
    const extraArgs = validateExtraArgs(request.extraArgs);
    const model = request.model.trim();
    const id = nextSessionId(this.sessions.keys());
    const runtime = new CodexSessionRuntime({
      id,
      command: this.binary,
      model,
      cwd,
      extraArgs,
      lane: request.lane ?? (this.sessions.size === 0 ? "http" : "websocket"),
      approveForMe: request.approveForMe,
      listener: {
        onCreated: () => undefined,
        onUpdated: (session) => this.broadcast("onUpdated", session),
        onRemoved: () => undefined,
        onOutput: (sessionId, data) => this.broadcast("onOutput", sessionId, data),
        onEvent: (event) => {
          this.recordEvent(event);
        },
        onExit: (sessionId, exitCode, signal) => this.broadcast("onExit", sessionId, exitCode, signal),
      },
    });
    this.sessions.set(id, runtime);
    this.recordEvent({
      id: `${id}-created`,
      ts: nowIso(),
      sessionId: id,
      kind: "session.created",
      message: `${cwd} · ${model || "default model"}`,
    });
    this.broadcast("onCreated", runtime.snapshot());
    if (request.start === true) {
      runtime.start();
    }
    return runtime.snapshot();
  }

  start(sessionId: string): CodexSession {
    const session = this.get(sessionId);
    session.start();
    return session.snapshot();
  }

  stop(sessionId: string): CodexSession {
    const session = this.get(sessionId);
    session.stop();
    return session.snapshot();
  }

  restart(sessionId: string): void {
    const session = this.get(sessionId);
    session.stop();
    this.recordEvent({
      id: `${sessionId}-restart-${Date.now()}`,
      ts: nowIso(),
      sessionId,
      kind: "session.restarted",
      message: "restart requested",
    });
    const waitForExit = (): void => {
      try {
        const snap = session.snapshot();
        if (snap.ptyConnected || snap.status === "starting" || snap.status === "stopping") {
          setTimeout(waitForExit, 150);
          return;
        }
        session.start();
      } catch (error) {
        this.recordEvent({
          id: `${sessionId}-restart-error-${Date.now()}`,
          ts: nowIso(),
          sessionId,
          kind: "process.error",
          message: error instanceof Error ? error.message : "restart failed",
        });
      }
    };
    setTimeout(waitForExit, 200);
  }

  kill(sessionId: string): CodexSession {
    const session = this.get(sessionId);
    session.kill();
    return session.snapshot();
  }

  remove(sessionId: string): void {
    const session = this.get(sessionId);
    session.dispose();
    this.sessions.delete(sessionId);
    this.recordEvent({
      id: `${sessionId}-removed`,
      ts: nowIso(),
      sessionId,
      kind: "session.removed",
      message: "session removed",
    });
    this.broadcast("onRemoved", sessionId);
  }

  prompt(sessionId: string, text: string): void {
    this.get(sessionId).prompt(text);
  }

  setApprove(sessionId: string, approve: boolean): void {
    this.get(sessionId).setApprove(approve);
  }

  write(sessionId: string, data: string): void {
    this.get(sessionId).write(data);
  }

  ensureDefaultPair(cwd: string): void {
    if (this.sessions.size > 0) return;
    this.create({ cwd, model: "gpt-5.6-luna", extraArgs: [], start: false, lane: "http" });
    this.create({ cwd, model: "gpt-5.6-luna", extraArgs: [], start: false, lane: "websocket" });
  }

  resize(sessionId: string, cols: number, rows: number): void {
    this.get(sessionId).resize(cols, rows);
  }

  sendCtrlC(sessionId: string): void {
    this.get(sessionId).sendCtrlC();
  }

  shutdown(): void {
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = null;
    }
    for (const session of this.sessions.values()) {
      session.dispose();
    }
    this.sessions.clear();
  }

  private assertCwd(input: string): string {
    const cwd = resolve(input);
    let real: string;
    try {
      real = realpathSync(cwd);
    } catch {
      throw new Error(`working directory does not exist: ${cwd}`);
    }
    const stat = statSync(real);
    if (!stat.isDirectory()) {
      throw new Error(`working directory is not a directory: ${real}`);
    }
    return real;
  }

  private recordEvent(event: ProcessEvent): void {
    this.events.push(event);
    if (this.events.length > MAX_EVENTS) {
      this.events.splice(0, this.events.length - MAX_EVENTS);
    }
    this.broadcast("onEvent", event);
  }

  private broadcast<K extends keyof SessionListener>(
    method: K,
    ...args: Parameters<SessionListener[K]>
  ): void {
    for (const listener of this.listeners) {
      const fn = listener[method] as (...fnArgs: Parameters<SessionListener[K]>) => void;
      fn(...args);
    }
  }
}
