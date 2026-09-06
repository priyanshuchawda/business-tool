import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: "client",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "client/src"),
      "@shared": path.resolve(rootDir, "shared"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/ws": {
        target: "http://127.0.0.1:8787",
        ws: true,
      },
      "/api": {
        target: "http://127.0.0.1:8787",
      },
    },
  },
  build: {
    outDir: path.resolve(rootDir, "dist"),
    emptyOutDir: true,
  },
});
