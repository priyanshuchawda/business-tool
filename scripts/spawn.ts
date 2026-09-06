import { homedir } from "node:os";

const cwd = process.argv[2] ?? `${homedir()}/harness/project`;
const model = process.argv[3] ?? "gpt-5.6-luna";

const response = await fetch("http://127.0.0.1:8787/api/sessions", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ cwd, model, extraArgs: [], start: true }),
});

const body = (await response.json()) as {
  session?: { id: string; pid: number | null; cwd: string; status: string };
  error?: string;
};

if (!response.ok || !body.session) {
  console.error(body.error ?? `spawn failed (${response.status})`);
  process.exit(1);
}

const session = body.session;
console.log(`${session.id}  PID ${session.pid ?? "—"}  ${session.status}  ${session.cwd}`);
console.log("open http://127.0.0.1:5173");
