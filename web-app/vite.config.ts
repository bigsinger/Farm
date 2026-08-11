import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/web/",
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:7878",
      "/assets": "http://localhost:7878",
      "/ws": { target: "ws://localhost:7878", ws: true },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
