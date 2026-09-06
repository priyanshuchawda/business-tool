import { emptyItem, type TranscriptItem } from "../shared/transcript.ts";

function textFromUnknown(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map((part) => textFromUnknown(part)).filter(Boolean).join("\n");
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.text === "string") return record.text;
    if (record.content !== undefined) return textFromUnknown(record.content);
    if (record.output !== undefined) return textFromUnknown(record.output);
  }
  return "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export class ExecEventParser {
  threadId: string | null = null;
  private counter = 0;

  ingest(line: string): TranscriptItem[] {
    const trimmed = line.trim();
    if (!trimmed) return [];
    try {
      return this.ingestJson(JSON.parse(trimmed) as unknown);
    } catch {
      if (trimmed.startsWith("{")) return [];
      const item = emptyItem("output", this.nextId("out"));
      item.text = trimmed;
      return [item];
    }
  }

  private ingestJson(raw: unknown): TranscriptItem[] {
    const obj = asRecord(raw);
    if (!obj) return [];
    const type = typeof obj.type === "string" ? obj.type : "";
    if (typeof obj.thread_id === "string") this.threadId = obj.thread_id;

    if (type === "thread.started" && typeof obj.thread_id === "string") {
      this.threadId = obj.thread_id;
      return [];
    }

    if (type === "item.completed" || type === "item.started" || type === "item.updated") {
      return this.fromItem(obj.item, type === "item.completed");
    }

    if (type === "event_msg") {
      const payload = asRecord(obj.payload) ?? obj;
      const inner = typeof payload.type === "string" ? payload.type : "";
      if (typeof payload.thread_id === "string") this.threadId = payload.thread_id;
      if (inner === "item_completed" || inner === "item.completed") {
        return this.fromItem(payload.item, true);
      }
      return [];
    }

    if (type === "response_item") {
      return this.fromResponseItem(asRecord(obj.payload) ?? obj);
    }

    if (type === "session_meta") {
      const payload = asRecord(obj.payload);
      const sid = payload && typeof payload.session_id === "string" ? payload.session_id : null;
      if (sid) this.threadId = sid;
    }

    return [];
  }

  private fromItem(value: unknown, completed: boolean): TranscriptItem[] {
    const item = asRecord(value);
    if (!item) return [];
    const kind = typeof item.type === "string" ? item.type : "";
    const id = typeof item.id === "string" ? item.id : this.nextId(kind);

    if (kind === "UserMessage" || kind === "user_message") {
      return [];
    }

    if (kind === "AgentMessage" || kind === "agent_message" || kind === "message") {
      const text = textFromUnknown(item.text) || textFromUnknown(item.content);
      if (!text) return [];
      const row = emptyItem("output", id);
      row.text = text;
      return [row];
    }

    if (
      kind === "CommandExecution" ||
      kind === "command_execution" ||
      kind === "shell" ||
      kind === "exec"
    ) {
      const row = emptyItem("shell", id);
      row.command = textFromUnknown(item.command) || textFromUnknown(item.cmd) || "shell";
      row.output = textFromUnknown(item.aggregated_output) || textFromUnknown(item.output);
      row.open = completed && Boolean(row.output);
      return [row];
    }

    if (kind === "Reasoning" || kind === "reasoning") {
      const text = textFromUnknown(item.summary) || textFromUnknown(item.text);
      if (!text) return [];
      const row = emptyItem("thought", id);
      row.text = text;
      return [row];
    }

    return [];
  }

  private fromResponseItem(item: Record<string, unknown> | null): TranscriptItem[] {
    if (!item) return [];
    const kind = typeof item.type === "string" ? item.type : "";
    if (kind === "message") {
      const role = typeof item.role === "string" ? item.role : "";
      const text = textFromUnknown(item.content);
      if (!text || role === "user" || role === "developer" || role === "system") return [];
      const row = emptyItem("output", typeof item.id === "string" ? item.id : this.nextId("msg"));
      row.text = text;
      return [row];
    }
    if (kind === "reasoning") {
      const text = textFromUnknown(item.summary);
      if (!text) return [];
      const row = emptyItem("thought", typeof item.id === "string" ? item.id : this.nextId("rs"));
      row.text = text;
      return [row];
    }
    if (kind === "custom_tool_call" || kind === "function_call") {
      const row = emptyItem("shell", typeof item.id === "string" ? item.id : this.nextId("sh"));
      row.command = typeof item.name === "string" ? item.name : "tool";
      row.output = textFromUnknown(item.input);
      return [row];
    }
    if (kind === "custom_tool_call_output" || kind === "function_call_output") {
      const row = emptyItem("shell", typeof item.id === "string" ? item.id : this.nextId("sho"));
      row.command = "tool output";
      row.output = textFromUnknown(item.output);
      row.open = true;
      return [row];
    }
    return [];
  }

  private nextId(prefix: string): string {
    this.counter += 1;
    return `${prefix}-${this.counter}`;
  }
}
