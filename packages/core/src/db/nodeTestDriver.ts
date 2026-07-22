/**
 * Test-only `LocalDbDriver` backed by `node:sqlite`.
 *
 * NOT used by any production runtime (frontend uses the real Capacitor SQLite
 * driver — see frontend/src/local/sqliteDriver.ts, Phase 2). This exists so the
 * `Local*Repository` implementations and the migration runner can be tested in
 * plain Node — fast, no WASM, no DOM — against an engine (node:sqlite) already
 * proven correct by the backend's own test suite.
 */
import { createRequire } from 'node:module';
import type { LocalDbDriver } from './LocalDbDriver.js';

const nodeRequire = createRequire(import.meta.url);
const sqlite = nodeRequire('node:sqlite') as typeof import('node:sqlite');

export function createNodeTestDriver(path = ':memory:'): LocalDbDriver {
  const db = new sqlite.DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON;');

  return {
    async execute(sql: string): Promise<void> {
      db.exec(sql);
    },
    async run(sql: string, params: unknown[] = []): Promise<void> {
      db.prepare(sql).run(...(params as never[]));
    },
    async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
      return db.prepare(sql).all(...(params as never[])) as T[];
    },
  };
}
