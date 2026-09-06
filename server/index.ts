import { startControlRoomServer } from "./ws.ts";

const server = startControlRoomServer();

const shutdown = (): void => {
  server.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
