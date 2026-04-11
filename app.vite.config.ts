import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: true,
    outDir: "dist-app",
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
});
