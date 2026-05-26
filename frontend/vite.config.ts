import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    port: 5173,
    host: true,
    watch: {
      // No Windows + Docker, o filesystem não emite eventos de mudança;
      // o polling garante que o Vite detecte todas as edições.
      usePolling: true,
      interval: 300,
    },
    proxy: {
      "/api": { target: "http://backend:8000", changeOrigin: true },
    },
  },
});
