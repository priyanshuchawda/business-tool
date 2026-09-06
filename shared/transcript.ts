export type TranscriptKind = "user" | "api" | "thought" | "shell" | "output";

export type TranscriptItem = {
  id: string;
  kind: TranscriptKind;
  text: string;
  detail: string;
  command: string;
  output: string;
  inputItems: number;
  uploadBytes: number;
  timeMs: number;
  open: boolean;
};

export function emptyItem(kind: TranscriptKind, id: string): TranscriptItem {
  return {
    id,
    kind,
    text: "",
    detail: "",
    command: "",
    output: "",
    inputItems: 0,
    uploadBytes: 0,
    timeMs: 0,
    open: kind === "api",
  };
}
