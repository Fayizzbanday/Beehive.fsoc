import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    strictPort: true,
    allowedHosts: [".sajidbanday.me", "localhost", "127.0.0.1"],
    watch: { awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 25 } },
    proxy: { "/api": { target: "http://127.0.0.1:8788", changeOrigin: true } },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          motion: ["framer-motion"],
        },
      },
    },
  },
});
