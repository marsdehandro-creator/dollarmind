import { defineConfig, searchForWorkspaceRoot } from 'vite';
import react from '@vitejs/plugin-react';

// DollarMind V1 is offline-first: no backend, so this is a plain static build.
// GitHub Pages serves it from /dollarmind/, hence the base path.
export default defineConfig({
  base: '/dollarmind/',
  plugins: [react()],
  server: {
    port: 5173,
    fs: {
      // Allow importing db/migrations/*.sql and config/*.json from the repo
      // root (outside this package) — see src/local/migrations.ts, config.ts.
      allow: [searchForWorkspaceRoot(process.cwd())],
    },
  },
});
