import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Terminal } from "@xterm/xterm";
import { useEffect, useRef } from "react";
import { terminalBus } from "../lib/terminal-bus";
import { controlRoom } from "../lib/ws-client";
import { xtermTheme } from "../lib/xterm-theme";

type Props = {
  sessionId: string;
  active: boolean;
};

export function TerminalView({ sessionId, active }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const term = new Terminal({
      theme: xtermTheme,
      fontFamily: '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: 13,
      lineHeight: 1.25,
      cursorBlink: true,
      cursorStyle: "block",
      scrollback: 5000,
      allowProposedApi: true,
      convertEol: false,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(host);
    termRef.current = term;
    fitRef.current = fit;

    const detach = terminalBus.attach(sessionId, term);
    const onData = term.onData((data) => {
      controlRoom.input(sessionId, data);
    });

    const resize = (): void => {
      try {
        fit.fit();
        controlRoom.resize(sessionId, term.cols, term.rows);
      } catch {
        // host may be hidden during layout changes
      }
    };

    const observer = new ResizeObserver(() => {
      resize();
    });
    observer.observe(host);
    requestAnimationFrame(resize);

    const onCopy = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key === "c" && term.hasSelection()) {
        event.preventDefault();
        void navigator.clipboard.writeText(term.getSelection());
      }
    };
    host.addEventListener("keydown", onCopy);

    return () => {
      host.removeEventListener("keydown", onCopy);
      observer.disconnect();
      onData.dispose();
      detach();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [sessionId]);

  useEffect(() => {
    if (active) {
      terminalBus.focus(sessionId);
      requestAnimationFrame(() => {
        try {
          fitRef.current?.fit();
        } catch {
          // ignore
        }
      });
    }
  }, [active, sessionId]);

  return (
    <div
      ref={hostRef}
      className="h-full min-h-0 w-full overflow-hidden bg-[#0a0a0a]"
      onClick={() => terminalBus.focus(sessionId)}
    />
  );
}
