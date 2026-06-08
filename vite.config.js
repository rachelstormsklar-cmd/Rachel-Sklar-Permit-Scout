import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Proxy /api and /health to the backend during development
      // so you don't need to set VITE_API_URL
      "/api": "http://localhost:3001",
      "/health": "http://localhost:3001",
    },
  },
});
