import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": "http://localhost:3333",
      "/events": "http://localhost:3333",
      "/health": "http://localhost:3333",
      "/pairing-qr.svg": "http://localhost:3333",
    },
  },
});
