import { defineConfig } from "vite";

// Relative base so the built site works at any mount point (GitHub Pages
// serves it under /desktopper/). src/assets.js resolves asset paths from it.
export default defineConfig({
  base: "./",
  build: {
    chunkSizeWarningLimit: 1200, // three.js is one big vendor chunk; that's fine
  },
});
