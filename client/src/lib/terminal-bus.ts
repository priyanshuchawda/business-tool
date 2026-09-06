import type { Terminal } from "@xterm/xterm";

class TerminalBus {
  private terms = new Map<string, Terminal>();
  private pending = new Map<string, string>();

  attach(sessionId: string, term: Terminal): () => void {
    this.terms.set(sessionId, term);
    const queued = this.pending.get(sessionId);
    if (queued) {
      term.write(queued);
      this.pending.delete(sessionId);
    }
    return () => {
      if (this.terms.get(sessionId) === term) {
        this.terms.delete(sessionId);
      }
    };
  }

  write(sessionId: string, data: string): void {
    const term = this.terms.get(sessionId);
    if (term) {
      term.write(data);
      return;
    }
    const prev = this.pending.get(sessionId) ?? "";
    const next = prev + data;
    this.pending.set(sessionId, next.length > 256 * 1024 ? next.slice(-256 * 1024) : next);
  }

  clear(sessionId: string): void {
    this.pending.delete(sessionId);
    this.terms.get(sessionId)?.clear();
  }

  async copy(sessionId: string): Promise<void> {
    const term = this.terms.get(sessionId);
    if (!term) return;
    if (!term.hasSelection()) {
      term.selectAll();
    }
    const text = term.getSelection();
    if (text) {
      await navigator.clipboard.writeText(text);
    }
    term.clearSelection();
  }

  focus(sessionId: string): void {
    this.terms.get(sessionId)?.focus();
  }
}

export const terminalBus = new TerminalBus();
