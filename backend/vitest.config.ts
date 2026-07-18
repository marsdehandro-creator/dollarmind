import { defineConfig } from 'vitest/config';

// Tests run against an in-memory SQLite database so they never touch the dev
// db/finance.db file. A single DatabaseSync connection is shared per process,
// so ':memory:' persists across queries within a test run. (node:sqlite is
// loaded via createRequire in db/connection.ts, so Vite never transforms it.)
export default defineConfig({
  test: {
    env: {
      DOLLARMIND_DATABASE_PATH: ':memory:',
    },
  },
});
