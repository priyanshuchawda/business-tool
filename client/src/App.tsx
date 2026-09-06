import { useEffect, useMemo, useState } from "react";
import { ConnectionBanner } from "./components/ConnectionBanner";
import { EmptyState } from "./components/EmptyState";
import { Header } from "./components/Header";
import { KillConfirm } from "./components/KillConfirm";
import { NewSessionDialog } from "./components/NewSessionDialog";
import { SessionGrid } from "./components/SessionGrid";
import { controlRoom } from "./lib/ws-client";
import { useRoom } from "./store/room";

export function App() {
  const sessionOrder = useRoom((s) => s.sessionOrder);
  const sessionsMap = useRoom((s) => s.sessions);
  const setNewOpen = useRoom((s) => s.setNewOpen);
  const setLayout = useRoom((s) => s.setLayout);
  const setFocused = useRoom((s) => s.setFocused);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const sessions = useMemo(
    () =>
      sessionOrder
        .map((id) => sessionsMap[id])
        .filter((session): session is NonNullable<typeof session> => session !== undefined),
    [sessionOrder, sessionsMap],
  );

  useEffect(() => {
    controlRoom.start();
    const clock = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => {
      window.clearInterval(clock);
      controlRoom.stop();
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      if (event.key === "n" && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        setNewOpen(true);
      }
      if (event.key === "g") setLayout("grid-2");
      if (event.key === "f" && sessions[0]) setFocused(sessions[0].id);
      if (event.key === "Escape") setFocused(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sessions, setFocused, setLayout, setNewOpen]);

  return (
    <div className="flex h-full flex-col bg-black text-paper">
      <Header />
      <ConnectionBanner />
      {sessions.length === 0 ? <EmptyState /> : <SessionGrid sessions={sessions} nowMs={nowMs} />}
      <NewSessionDialog />
      <KillConfirm />
    </div>
  );
}
