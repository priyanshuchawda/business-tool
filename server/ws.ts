import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { homedir } from "node:os";
import { realpathSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { WebSocketServer, type WebSocket } from "ws";
import {
  PROTOCOL_VERSION,
  type ClientMessage,
  type ServerMessage,
} from "../shared/protocol.ts";
import { CodexProcessManager } from "./manager.ts";

const HOST = process.env.CONTROL_ROOM_HOST ?? "127.0.0.1";
const PORT = Number(process.env.CONTROL_ROOM_PORT ?? 8787);

function send(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function parseClientMessage(raw: string): ClientMessage {
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || !("type" in parsed)) {
    throw new Error("invalid message");
  }
  return parsed as ClientMessage;
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(body));
}

function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => {
      if (chunks.length === 0) {
        resolveBody({});
        return;
      }
      try {
        const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          reject(new Error("JSON object required"));
          return;
        }
        resolveBody(parsed as Record<string, unknown>);
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function isLocalRequest(req: IncomingMessage): boolean {
  const addr = req.socket.remoteAddress;
  return addr === "127.0.0.1" || addr === "::1" || addr === ":ffff:127.0.0.1";
}

export function startControlRoomServer(): { close: () => void } {
  const manager = new CodexProcessManager();
  try {
    manager.ensureDefaultPair(`${homedir()}/harness/project`);
  } catch (error) {
    console.error("default pair", error);
  }

  const httpServer = createServer((req, res) => {
    if (!isLocalRequest(req)) {
      writeJson(res, 403, { error: "localhost only" });
      return;
    }
    const url = new URL(req.url ?? "/", `http://${HOST}:${PORT}`);
    if (req.method === "GET" && url.pathname === "/api/health") {
      writeJson(res, 200, {
        ok: true,
        startedAt: manager.startedAt,
        sessions: manager.list().length,
      });
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/sessions") {
      writeJson(res, 200, { sessions: manager.list() });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/sessions") {
      void readJson(req)
        .then((body) => {
          const cwd = typeof body.cwd === "string" ? body.cwd : `${homedir()}/harness/project`;
          const model = typeof body.model === "string" ? body.model : "gpt-5.6-luna";
          const extraArgs = Array.isArray(body.extraArgs)
            ? body.extraArgs.filter((arg): arg is string => typeof arg === "string")
            : [];
          const session = manager.create({ cwd, model, extraArgs, start: true });
          writeJson(res, 201, { session });
        })
        .catch((error: unknown) => {
          writeJson(res, 400, {
            error: error instanceof Error ? error.message : "invalid session request",
          });
        });
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/cwd") {
      const input = url.searchParams.get("path") ?? "";
      try {
        const cwd = resolve(input);
        const real = realpathSync(cwd);
        const stat = statSync(real);
        writeJson(res, 200, { ok: stat.isDirectory(), path: real });
      } catch {
        writeJson(res, 200, { ok: false, path: input });
      }
      return;
    }
    writeJson(res, 404, { error: "not found" });
  });

  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (socket, req) => {
    if (!isLocalRequest(req)) {
      socket.close(1008, "localhost only");
      return;
    }

    send(socket, {
      type: "hello",
      startedAt: manager.startedAt,
      protocolVersion: PROTOCOL_VERSION,
      homeDir: homedir(),
    });
    send(socket, {
      type: "session.snapshot",
      sessions: manager.list(),
      events: manager.listEvents(),
    });
    for (const session of manager.list()) {
      const replay = manager.replay(session.id);
      if (replay) {
        send(socket, { type: "terminal.replay", sessionId: session.id, data: replay });
      }
    }

    const offListener = manager.onListener({
      onCreated: (session) => {
        send(socket, { type: "session.created", session });
      },
      onUpdated: (session) => {
        send(socket, { type: "session.updated", session });
        send(socket, { type: "process.status", sessionId: session.id, status: session.status });
      },
      onRemoved: (sessionId) => {
        send(socket, { type: "session.removed", sessionId });
      },
      onOutput: (sessionId, data) => {
        send(socket, { type: "terminal.output", sessionId, data });
      },
      onEvent: (event) => {
        send(socket, { type: "event", event });
      },
      onExit: (sessionId, exitCode, signal) => {
        send(socket, { type: "terminal.exit", sessionId, exitCode, signal });
      },
    });

    const offMetrics = manager.onMetrics((sessionId, metrics) => {
      send(socket, { type: "process.metrics", sessionId, metrics });
    });

    socket.on("message", (raw) => {
      try {
        const text = typeof raw === "string" ? raw : raw.toString("utf8");
        const message = parseClientMessage(text);
        handleClientMessage(manager, socket, message);
      } catch (error) {
        send(socket, {
          type: "error",
          message: error instanceof Error ? error.message : "invalid message",
        });
      }
    });

    socket.on("close", () => {
      offListener();
      offMetrics();
    });
  });

  httpServer.listen(PORT, HOST, () => {
    console.log(`control-room server ws://127.0.0.1:${PORT}/ws`);
  });

  return {
    close: () => {
      wss.close();
      httpServer.close();
      manager.shutdown();
    },
  };
}

function handleClientMessage(
  manager: CodexProcessManager,
  socket: WebSocket,
  message: ClientMessage,
): void {
  switch (message.type) {
    case "session.list":
      send(socket, {
        type: "session.snapshot",
        sessions: manager.list(),
        events: manager.listEvents(),
      });
      send(socket, { type: "ok", requestId: message.requestId });
      return;
    case "session.create":
      manager.create(message.request);
      send(socket, { type: "ok", requestId: message.requestId });
      return;
    case "session.start":
      manager.start(message.sessionId);
      send(socket, { type: "ok", requestId: message.requestId });
      return;
    case "session.stop":
      manager.stop(message.sessionId);
      send(socket, { type: "ok", requestId: message.requestId });
      return;
    case "session.restart":
      manager.restart(message.sessionId);
      send(socket, { type: "ok", requestId: message.requestId });
      return;
    case "session.kill":
      manager.kill(message.sessionId);
      send(socket, { type: "ok", requestId: message.requestId });
      return;
    case "session.remove":
      manager.remove(message.sessionId);
      send(socket, { type: "ok", requestId: message.requestId });
      return;
    case "terminal.input":
      manager.write(message.sessionId, message.data);
      return;
    case "terminal.resize":
      manager.resize(message.sessionId, message.cols, message.rows);
      return;
    case "terminal.ctrlc":
      manager.sendCtrlC(message.sessionId);
      return;
    case "session.prompt":
      manager.prompt(message.sessionId, message.text);
      return;
    case "session.setApprove":
      manager.setApprove(message.sessionId, message.approve);
      return;
    default: {
      const neverMessage: never = message;
      throw new Error(`unsupported message ${(neverMessage as ClientMessage).type}`);
    }
  }
}
