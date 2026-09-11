// vite.config.js
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS FILE DOES:
//   Configures Vite — the build tool that runs your dev server and bundles
//   the app for production. You rarely need to edit this file.
//
// KEY SETTINGS:
//   - plugin-react-swc: compiles JSX to JavaScript (SWC is faster than Babel)
//   - @/* alias: lets you write @/components/... instead of ../../components/...
//   - test.include: tells Vitest to find unit tests with *.test.jsx pattern
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
      // This is why you can write: import X from "@/components/...\
      // It maps "@" to the "src" folder automatically
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'jsdom',
          globals: true,
          include: ['**/*.test.jsx'],
          exclude: ['**/*.integration.test.*'],
          setupFiles: ['./src/test/setup.js'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration:auth',
          environment: 'jsdom',
          globals: true,
          include: ['**/Login.integration.test.jsx'],
          setupFiles: ['./src/test/setup.integration.js'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration:firestore',
          environment: 'jsdom',
          globals: true,
          include: ['**/firestoreRules.integration.test.jsx'],
          setupFiles: ['./src/test/setup.integration.js'],
        },
      },
      {
        extends: true,
        test: {
          name: 'all',
          environment: 'jsdom',
          globals: true,
          include: ['**/*.test.jsx'],
          setupFiles: ['./src/test/setup.integration.js'],
        },
      },
    ]
  },
});
