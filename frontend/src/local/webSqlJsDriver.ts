/**
 * Web LocalDbDriver, backed by sql.js directly (not jeep-sqlite — its
 * Stencil-bundled wasm loader hit a reproducible WebAssembly LinkError in
 * testing; sql.js used directly is the simpler, more predictable path for
 * the browser target). Native platforms use the real Capacitor SQLite plugin
 * instead — see sqliteDriver.ts.
 *
 * sql.js runs entirely in memory; there is no native persistence, so writes
 * export the full database and save it to IndexedDB. Only `run()` (regular
 * single-statement, autocommitting INSERT/UPDATE/DELETE) persists per call —
 * `execute()` (DDL / multi-statement / explicit BEGIN..COMMIT, used by the
 * migration runner) deliberately does NOT: calling db.export() while a
 * manual transaction is open silently ends it (confirmed empirically), which
 * broke migrations that span multiple execute() calls. Callers that only use
 * execute() (i.e. the migration runner) must call persistWebDb() once after
 * they're done — db.ts's bootstrap() already does this.
 */
import initSqlJs, { type Database } from 'sql.js';
import type { LocalDbDriver } from '@dollarmind/core/db/LocalDbDriver.js';
import { loadBlob, saveBlob } from './idbBlobStore.js';

const STORE_KEY = 'dollarmind.db';
let driverPromise: Promise<{ driver: LocalDbDriver; db: Database }> | null = null;

function rowsFromExec(result: ReturnType<Database['exec']>): Record<string, unknown>[] {
  if (result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map((row) => Object.fromEntries(columns.map((col, i) => [col, row[i]])));
}

async function build(): Promise<{ driver: LocalDbDriver; db: Database }> {
  const SQL = await initSqlJs({
    locateFile: (file) => `${import.meta.env.BASE_URL}assets/${file}`,
  });

  const existing = await loadBlob(STORE_KEY);
  const db = existing ? new SQL.Database(existing) : new SQL.Database();

  const driver: LocalDbDriver = {
    async execute(sql: string): Promise<void> {
      db.exec(sql);
    },
    async run(sql: string, params: unknown[] = []): Promise<void> {
      db.run(sql, params as (string | number | Uint8Array | null)[]);
      await saveBlob(STORE_KEY, db.export());
    },
    async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
      const result = db.exec(sql, params as (string | number | Uint8Array | null)[]);
      return rowsFromExec(result) as T[];
    },
  };
  return { driver, db };
}

function getBuild(): Promise<{ driver: LocalDbDriver; db: Database }> {
  if (!driverPromise) driverPromise = build();
  return driverPromise;
}

export async function getWebSqlJsDriver(): Promise<LocalDbDriver> {
  return (await getBuild()).driver;
}

/** Explicit flush to IndexedDB — required after any execute()-only sequence (e.g. migrations). */
export async function persistWebDb(): Promise<void> {
  const { db } = await getBuild();
  await saveBlob(STORE_KEY, db.export());
}
