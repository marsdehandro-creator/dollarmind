/**
 * Native LocalDbDriver, backed by @capacitor-community/sqlite's real native
 * SQLite bridge (Android/iOS only — the web platform uses webSqlJsDriver.ts
 * instead, see sqliteDriver.ts).
 *
 * The database file is opened once and never dropped/recreated — updates
 * only ever run new migrations against the existing file (docs/v1-offline-product-spec.md).
 */
import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite';
import type { LocalDbDriver } from '@dollarmind/core/db/LocalDbDriver.js';

const DB_NAME = 'dollarmind';
let connection: SQLiteDBConnection | null = null;

async function getConnection(): Promise<SQLiteDBConnection> {
  if (connection) return connection;

  const sqlite = new SQLiteConnection(CapacitorSQLite);
  const isConn = (await sqlite.isConnection(DB_NAME, false)).result;
  const db = isConn
    ? await sqlite.retrieveConnection(DB_NAME, false)
    : await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
  await db.open();
  await db.execute('PRAGMA foreign_keys = ON;');
  connection = db;
  return db;
}

export async function getNativeSqliteDriver(): Promise<LocalDbDriver> {
  const db = await getConnection();
  return {
    // transaction: false on every call — the plugin otherwise auto-wraps each
    // individual execute()/run() in its own transaction, which breaks the
    // manual multi-call BEGIN/COMMIT/ROLLBACK sequence in localMigrate.ts
    // (each call would see no transaction "active" from its own perspective).
    async execute(sql: string): Promise<void> {
      await db.execute(sql, false);
    },
    async run(sql: string, params: unknown[] = []): Promise<void> {
      await db.run(sql, params, false);
    },
    async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
      const result = await db.query(sql, params);
      return (result.values ?? []) as T[];
    },
  };
}
