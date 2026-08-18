import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 3333,
    strictPort: true,
    proxy: {
      "/api": "http://localhost:3334",
      "/events": "http://localhost:3334",
      "/health": "http://localhost:3334",
      "/pairing-qr.svg": "http://localhost:3334",
      "/profile-image": "http://localhost:3334",
    },
  },
});
