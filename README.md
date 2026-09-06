# Harness Engineering

A local process observatory for real OpenAI Codex CLI sessions. The browser is the control surface. Each pane is an independent PTY attached to a live `codex` process.

```
Browser (React + xterm.js)
        │ WebSocket
        ▼
Node process manager
        │ node-pty
        ▼
REAL Codex CLI  (one PTY per session)
```

## Architecture

- **Frontend** (`client/`): React + TypeScript + Vite + Tailwind. Each session card mounts an xterm.js terminal. Raw PTY bytes are written with `term.write()`. Keyboard input is sent only to that session's PTY.
- **Backend** (`server/`): localhost HTTP + WebSocket server. `CodexProcessManager` owns in-memory session state. `CodexSessionRuntime` wraps one `node-pty` instance.
- **Shared** (`shared/`): WebSocket protocol types used by both sides.

Process metadata (PID, PPID, cwd, model, status, CPU, RSS) is read from the real OS. CPU and memory come from `/proc` on Linux. If a sample is unavailable the UI shows `—`. Nothing is fabricated.

## How the PTY works

`node-pty` allocates a pseudo-terminal. Codex is spawned as the PTY slave so it believes it is attached to a real terminal (cursor movement, colors, raw mode, Ctrl+C).

```
codex process  →  PTY data event  →  WebSocket terminal.output  →  xterm.write(data)
xterm onData   →  WebSocket terminal.input   →  pty.write(data)  →  codex
```

There is no stdout polling and no simulated log stream.

## How Codex is spawned

The server resolves the `codex` binary from `CODEX_BIN` or `PATH`. It never accepts an arbitrary command. A session is created with:

- working directory (must exist)
- model (`--model`)
- extra CLI arguments (parsed as argv, not a shell string)

Maximum 8 concurrent sessions. The HTTP API is read-only (`/api/health`, `/api/sessions`, `/api/cwd`). There is no `POST /execute`.

## WebSocket protocol

Client → server:

- `session.create` / `start` / `stop` / `restart` / `kill` / `remove`
- `terminal.input` `{ sessionId, data }`
- `terminal.resize` `{ sessionId, cols, rows }`
- `terminal.ctrlc`

Server → client:

- `hello`, `session.snapshot`, `session.created`, `session.updated`, `session.removed`
- `terminal.output`, `terminal.replay`, `terminal.exit`
- `process.status`, `process.metrics`, `event`

See `shared/protocol.ts`.

## Start

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173).

This starts the Node process manager on `127.0.0.1:8787` and the Vite UI on `127.0.0.1:5173` with a WebSocket proxy.

Requires:

- Node 20+
- a local `codex` binary on `PATH`
- Linux `/proc` for live CPU/memory (otherwise those fields stay `—`)

## Add another Codex session

1. Click **NEW CODEX**
2. Confirm the working directory exists
3. Set the model / optional args
4. **START CODEX** or **START PAIR**

Layout modes: 2 / 3 / 4 columns, compact, or focus. Shortcuts: `n` new, `1-9` focus session, `g` grid, `Esc` leave focus, `a` toggle the event stream.

## Security

- Binds to localhost only
- Refuses non-loopback clients
- Spawns only the resolved `codex` binary
- Validates cwd and argument length
- Does not expose a general remote shell

This is a local operator console, not a multi-tenant service.

## Persistence

Session state lives in memory. A backend restart drops PTYs. The code is structured so a store can be added later without changing the protocol.
