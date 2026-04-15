// vite.config.js
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS FILE DOES:
//   Configures Vite — the build tool that runs your dev server and bundles
//   the app for production. You rarely need to edit this file.
//
// KEY SETTINGS:
//   - plugin-react-swc: compiles JSX to JavaScript (SWC is faster than Babel)
//   - @/* alias: lets you write @/components/... instead of ../../components/...
// ─────────────────────────────────────────────────────────────────────────────
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [
    react(), // handles JSX transformation
  ],
  resolve: {
    alias: {
      // This is why you can write: import X from "@/components/..."
      // It maps "@" to the "src" folder automatically
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
