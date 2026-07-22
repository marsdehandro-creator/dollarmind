/**
 * Pre-migration safety snapshot (docs/v1-offline-product-spec.md Decision 3 /
 * the plan's "last-resort recovery net"). Migrations already run inside a
 * transaction with rollback on error (localMigrate.ts), so this is a second,
 * independent line of defense — a JSON snapshot taken right before any
 * not-yet-applied migration runs, kept outside the SQL database entirely (in
 * IndexedDB) so a broken migration can't take the backup down with it. Only
 * fires when there's actually a pending migration — not on every launch.
 */
import type { LocalDbDriver } from '@dollarmind/core/db/LocalDbDriver.js';
import type { MigrationFile } from '@dollarmind/core/db/localMigrate.js';
import { dumpTables } from './tableDump.js';
import { listKeys, saveBlob, deleteBlob } from './idbBlobStore.js';

const BACKUP_PREFIX = 'migration-backup:';
const KEEP_LAST = 3;

/** Caller guarantees the _migrations table already exists before calling this. */
async function hasPendingMigrations(db: LocalDbDriver, migrations: MigrationFile[]): Promise<boolean> {
  const applied = await db.query<{ id: string }>('SELECT id FROM _migrations');
  const appliedIds = new Set(applied.map((r) => r.id));
  return migrations.some((m) => !appliedIds.has(m.id));
}

/** No-op unless a migration is actually about to run against a database that already has the _migrations table (i.e. isn't a brand-new install). */
export async function backupBeforeMigrationIfPending(db: LocalDbDriver, migrations: MigrationFile[]): Promise<void> {
  const tableExists = await db.query<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='_migrations'",
  );
  if (tableExists.length === 0) return; // fresh install — nothing to protect yet

  if (!(await hasPendingMigrations(db, migrations))) return;

  const bundle = await dumpTables(db);
  const json = JSON.stringify(bundle);
  const bytes = new TextEncoder().encode(json);
  const key = `${BACKUP_PREFIX}${bundle.exportedAt}`;
  await saveBlob(key, bytes);

  const keys = await listKeys(BACKUP_PREFIX);
  const toRemove = keys.slice(0, Math.max(0, keys.length - KEEP_LAST));
  for (const k of toRemove) await deleteBlob(k);
}
