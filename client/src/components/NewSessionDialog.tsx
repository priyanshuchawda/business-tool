import { splitArgs } from "@shared/args";
import { useEffect, useState } from "react";
import { controlRoom } from "../lib/ws-client";
import { useRoom } from "../store/room";

type CwdCheck = { ok: boolean; path: string };

export function NewSessionDialog() {
  const open = useRoom((s) => s.newOpen);
  const setOpen = useRoom((s) => s.setNewOpen);
  const homeDir = useRoom((s) => s.homeDir);
  const [cwd, setCwd] = useState("");
  const [model, setModel] = useState("gpt-5.6-luna");
  const [args, setArgs] = useState("");
  const [check, setCheck] = useState<CwdCheck | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCwd(homeDir ? `${homeDir}/harness/project` : "/home/priyanshuchawda/harness/project");
      setError(null);
    }
  }, [open, homeDir]);

  useEffect(() => {
    if (!open || !cwd) {
      setCheck(null);
      return;
    }
    const handle = window.setTimeout(() => {
      void fetch(`/api/cwd?path=${encodeURIComponent(cwd)}`)
        .then((res) => res.json() as Promise<CwdCheck>)
        .then(setCheck)
        .catch(() => setCheck({ ok: false, path: cwd }));
    }, 200);
    return () => window.clearTimeout(handle);
  }, [cwd, open]);

  if (!open) return null;

  const startOne = (): void => {
    if (!check?.ok) {
      setError("Working directory does not exist.");
      return;
    }
    try {
      controlRoom.create({
        cwd,
        model,
        extraArgs: splitArgs(args),
        start: false,
      });
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to create session");
    }
  };

  const startPair = (): void => {
    if (!check?.ok) {
      setError("Working directory does not exist.");
      return;
    }
    try {
      controlRoom.create({ cwd, model, extraArgs: splitArgs(args), start: false, lane: "http" });
      controlRoom.create({ cwd, model, extraArgs: splitArgs(args), start: false, lane: "websocket" });
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to create sessions");
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70">
      <div className="w-[480px] rounded-2xl bg-panel p-5 ring-1 ring-line">
        <div className="text-[18px] font-medium text-paper">New terminal</div>
        <div className="mt-1 text-[13px] text-fog">
          Spawns a real Codex CLI in a PTY. It appears in this browser immediately.
        </div>
        <label className="mt-4 block">
          <span className="text-[12px] text-fog">Working directory</span>
          <input
            value={cwd}
            onChange={(event) => setCwd(event.target.value)}
            className="mt-1 w-full rounded-xl bg-void px-3 py-2 font-mono text-[13px] text-paper outline-none ring-1 ring-line focus:ring-line-strong"
          />
        </label>
        <div className="mt-1 text-[12px]">
          {check?.ok ? (
            <span className="text-live">valid · {check.path}</span>
          ) : (
            <span className="text-alert">directory not found</span>
          )}
        </div>
        <label className="mt-3 block">
          <span className="text-[12px] text-fog">Model</span>
          <input
            value={model}
            onChange={(event) => setModel(event.target.value)}
            className="mt-1 w-full rounded-xl bg-void px-3 py-2 font-mono text-[13px] text-paper outline-none ring-1 ring-line focus:ring-line-strong"
          />
        </label>
        <label className="mt-3 block">
          <span className="text-[12px] text-fog">Arguments</span>
          <input
            value={args}
            onChange={(event) => setArgs(event.target.value)}
            placeholder="optional"
            className="mt-1 w-full rounded-xl bg-void px-3 py-2 font-mono text-[13px] text-paper outline-none ring-1 ring-line focus:ring-line-strong"
          />
        </label>
        {error ? <div className="mt-3 text-[13px] text-alert">{error}</div> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-full px-3 py-1.5 text-[13px] text-fog hover:text-paper"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={startPair}
            className="rounded-full bg-panel-2 px-3 py-1.5 text-[13px] text-paper hover:bg-line"
          >
            Start pair
          </button>
          <button
            type="button"
            onClick={startOne}
            className="rounded-full bg-paper px-3 py-1.5 text-[13px] text-black"
          >
            Open Codex
          </button>
        </div>
      </div>
    </div>
  );
}
