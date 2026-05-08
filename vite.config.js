import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    open: false,
    allowedHosts: ["natural-grope-equate.ngrok-free.dev"],
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
