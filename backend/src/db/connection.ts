/**
 * SQLite connection using Node's built-in `node:sqlite` (DatabaseSync).
 *
 * Chosen because it needs no native build and no third-party dependency on
 * Node 24. It sits behind the repository ports, so swapping the driver later
 * touches only this layer (docs/architecture.md §2, §3).
 *
 * We load it via createRequire (not a static import) so bundlers/test runners
 * (Vite/Vitest) don't try to transform this very new built-in — Node resolves
 * it at runtime. Types come from the ambient declaration in
 * src/types/node-sqlite.d.ts.
 */
import { createRequire } from 'node:module';

const nodeRequire = createRequire(import.meta.url);
const sqlite = nodeRequire('node:sqlite') as typeof import('node:sqlite');

export type Db = InstanceType<typeof sqlite.DatabaseSync>;

export function openDb(path: string): Db {
  const db = new sqlite.DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');
  return db;
}
