/**
 * The on-device SQL driver contract. Production is backed by
 * `@capacitor-community/sqlite` (native SQLite on Android, WASM SQLite via
 * `jeep-sqlite` on the web) — see frontend/src/local/sqliteDriver.ts (Phase 2).
 * Tests use a thin `node:sqlite`-backed adapter instead, since that engine is
 * already exercised heavily by the backend's own test suite; this keeps the
 * repository/migration logic testable in plain Node with no WASM or DOM.
 *
 * Every `Local*Repository` and the migration runner depend only on this
 * interface, never on a concrete driver — the same port/adapter shape the
 * `Sqlite*Repository` classes already use for `Db` (docs/architecture.md §2).
 */
export interface LocalDbDriver {
  /** DDL / multi-statement execution (schema changes, migrations). No rows returned. */
  execute(sql: string): Promise<void>;
  /** INSERT / UPDATE / DELETE. No rows returned. */
  run(sql: string, params?: unknown[]): Promise<void>;
  /** SELECT. Returns plain row objects (snake_case columns, 0/1 booleans) — same shape rowMappers.ts already expects. */
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}
