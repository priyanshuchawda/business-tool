import { create } from "zustand";
import type {
  CodexSession,
  LayoutMode,
  ProcessEvent,
  ProcessStatus,
  SessionMetrics,
} from "@shared/protocol";

export type ConnectionState = "idle" | "connecting" | "open" | "closed";

type RoomState = {
  connection: ConnectionState;
  startedAt: string | null;
  homeDir: string;
  sessions: Record<string, CodexSession>;
  sessionOrder: string[];
  events: ProcessEvent[];
  layout: LayoutMode;
  focusedId: string | null;
  activityOpen: boolean;
  newOpen: boolean;
  killId: string | null;
  notice: string | null;
  lastActivityAt: Record<string, number>;
  setConnection: (connection: ConnectionState) => void;
  setHello: (startedAt: string, homeDir: string) => void;
  replaceSessions: (sessions: CodexSession[]) => void;
  replaceEvents: (events: ProcessEvent[]) => void;
  upsertSession: (session: CodexSession) => void;
  removeSession: (sessionId: string) => void;
  patchStatus: (sessionId: string, status: ProcessStatus) => void;
  patchMetrics: (sessionId: string, metrics: SessionMetrics) => void;
  pushEvent: (event: ProcessEvent) => void;
  markActivity: (sessionId: string) => void;
  setLayout: (layout: LayoutMode) => void;
  setFocused: (sessionId: string | null) => void;
  setActivityOpen: (open: boolean) => void;
  setNewOpen: (open: boolean) => void;
  setKillId: (sessionId: string | null) => void;
  setNotice: (notice: string | null) => void;
};

export const useRoom = create<RoomState>((set) => ({
  connection: "idle",
  startedAt: null,
  homeDir: "",
  sessions: {},
  sessionOrder: [],
  events: [],
  layout: "grid-2",
  focusedId: null,
  activityOpen: true,
  newOpen: false,
  killId: null,
  notice: null,
  lastActivityAt: {},
  setConnection: (connection) => set({ connection }),
  setHello: (startedAt, homeDir) => set({ startedAt, homeDir }),
  replaceSessions: (sessions) =>
    set({
      sessions: Object.fromEntries(sessions.map((session) => [session.id, session])),
      sessionOrder: sessions.map((session) => session.id),
    }),
  replaceEvents: (events) => set({ events }),
  upsertSession: (session) =>
    set((state) => ({
      sessions: { ...state.sessions, [session.id]: session },
      sessionOrder: state.sessionOrder.includes(session.id)
        ? state.sessionOrder
        : [...state.sessionOrder, session.id],
    })),
  removeSession: (sessionId) =>
    set((state) => {
      const sessions = { ...state.sessions };
      delete sessions[sessionId];
      return {
        sessions,
        sessionOrder: state.sessionOrder.filter((id) => id !== sessionId),
        focusedId: state.focusedId === sessionId ? null : state.focusedId,
        killId: state.killId === sessionId ? null : state.killId,
      };
    }),
  patchStatus: (sessionId, status) =>
    set((state) => {
      const current = state.sessions[sessionId];
      if (!current) return state;
      return { sessions: { ...state.sessions, [sessionId]: { ...current, status } } };
    }),
  patchMetrics: (sessionId, metrics) =>
    set((state) => {
      const current = state.sessions[sessionId];
      if (!current) return state;
      return { sessions: { ...state.sessions, [sessionId]: { ...current, metrics } } };
    }),
  pushEvent: (event) =>
    set((state) => {
      if (state.events.some((existing) => existing.id === event.id)) {
        return state;
      }
      return { events: [...state.events.slice(-399), event] };
    }),
  markActivity: (sessionId) =>
    set((state) => {
      const prev = state.lastActivityAt[sessionId] ?? 0;
      const now = Date.now();
      if (now - prev < 200) return state;
      return { lastActivityAt: { ...state.lastActivityAt, [sessionId]: now } };
    }),
  setLayout: (layout) =>
    set((state) => ({
      layout,
      focusedId: layout === "focus" ? state.focusedId ?? state.sessionOrder[0] ?? null : state.focusedId,
    })),
  setFocused: (sessionId) =>
    set((state) => ({
      focusedId: sessionId,
      layout: sessionId ? "focus" : state.layout === "focus" ? "grid-2" : state.layout,
    })),
  setActivityOpen: (activityOpen) => set({ activityOpen }),
  setNewOpen: (newOpen) => set({ newOpen }),
  setKillId: (killId) => set({ killId }),
  setNotice: (notice) => set({ notice }),
}));
