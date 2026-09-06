import type { ClientMessage, ServerMessage, SessionCreateRequest } from "@shared/protocol";
import { terminalBus } from "./terminal-bus";
import { useRoom } from "../store/room";

function requestId(): string {
  return crypto.randomUUID();
}

export class ControlRoomSocket {
  private socket: WebSocket | null = null;
  private closed = false;
  private attempts = 0;
  private reconnectTimer: number | null = null;

  start(): void {
    this.closed = false;
    this.connect();
  }

  stop(): void {
    this.closed = true;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close();
    this.socket = null;
  }

  send(message: ClientMessage): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("not connected");
    }
    this.socket.send(JSON.stringify(message));
  }

  create(request: SessionCreateRequest): void {
    this.send({ type: "session.create", requestId: requestId(), request });
  }

  startSession(sessionId: string): void {
    this.send({ type: "session.start", requestId: requestId(), sessionId });
  }

  stopSession(sessionId: string): void {
    this.send({ type: "session.stop", requestId: requestId(), sessionId });
  }

  restart(sessionId: string): void {
    this.send({ type: "session.restart", requestId: requestId(), sessionId });
  }

  kill(sessionId: string): void {
    this.send({ type: "session.kill", requestId: requestId(), sessionId });
  }

  remove(sessionId: string): void {
    this.send({ type: "session.remove", requestId: requestId(), sessionId });
  }

  input(sessionId: string, data: string): void {
    this.send({ type: "terminal.input", sessionId, data });
  }

  resize(sessionId: string, cols: number, rows: number): void {
    this.send({ type: "terminal.resize", sessionId, cols, rows });
  }

  ctrlc(sessionId: string): void {
    this.send({ type: "terminal.ctrlc", sessionId });
  }

  prompt(sessionId: string, text: string): void {
    this.send({ type: "session.prompt", sessionId, text });
  }

  setApprove(sessionId: string, approve: boolean): void {
    this.send({ type: "session.setApprove", sessionId, approve });
  }

  private connect(): void {
    useRoom.getState().setConnection("connecting");
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const socket = new WebSocket(`${protocol}://${window.location.host}/ws`);
    this.socket = socket;

    socket.addEventListener("open", () => {
      this.attempts = 0;
      useRoom.getState().setConnection("open");
    });

    socket.addEventListener("message", (event) => {
      if (typeof event.data !== "string") return;
      const message = JSON.parse(event.data) as ServerMessage;
      this.dispatch(message);
    });

    socket.addEventListener("close", () => {
      useRoom.getState().setConnection("closed");
      this.scheduleReconnect();
    });

    socket.addEventListener("error", () => {
      socket.close();
    });
  }

  private scheduleReconnect(): void {
    if (this.closed) return;
    this.attempts += 1;
    const delay = Math.min(8000, 400 * 2 ** Math.min(this.attempts, 5));
    this.reconnectTimer = window.setTimeout(() => this.connect(), delay);
  }

  private dispatch(message: ServerMessage): void {
    const room = useRoom.getState();
    switch (message.type) {
      case "hello":
        room.setHello(message.startedAt, message.homeDir);
        return;
      case "session.snapshot":
        room.replaceSessions(message.sessions);
        room.replaceEvents(message.events);
        return;
      case "session.created":
      case "session.updated":
        room.upsertSession(message.session);
        return;
      case "session.removed":
        terminalBus.clear(message.sessionId);
        room.removeSession(message.sessionId);
        return;
      case "terminal.output":
      case "terminal.replay":
        terminalBus.write(message.sessionId, message.data);
        room.markActivity(message.sessionId);
        return;
      case "terminal.exit":
        return;
      case "process.status":
        room.patchStatus(message.sessionId, message.status);
        return;
      case "process.metrics":
        room.patchMetrics(message.sessionId, message.metrics);
        return;
      case "event":
        room.pushEvent(message.event);
        return;
      case "error":
        room.setNotice(message.message);
        return;
      case "ok":
        return;
    }
  }
}

export const controlRoom = new ControlRoomSocket();
