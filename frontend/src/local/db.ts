/**
 * On-device database bootstrap: open (never recreate) -> migrate -> ensure
 * the pilot tenant row -> seed categories. Mirrors backend/src/db/index.ts's
 * sequence, against the on-device driver instead of node:sqlite.
 */
import type { LocalDbDriver } from '@dollarmind/core/db/LocalDbDriver.js';
import { runLocalMigrations } from '@dollarmind/core/db/localMigrate.js';
import { DEFAULT_TENANT_ID } from '@dollarmind/core/constants.js';
import { nowIso } from '@dollarmind/core/utils/id.js';
import { getLocalDbDriver, persist } from './sqliteDriver.js';
import { loadBundledMigrations } from './migrations.js';
import { seedCategories } from './seedCategories.js';

let dbPromise: Promise<LocalDbDriver> | null = null;

async function bootstrap(): Promise<LocalDbDriver> {
  const db = await getLocalDbDriver();
  await runLocalMigrations(db, loadBundledMigrations());

  const now = nowIso();
  await db.run(
    `INSERT OR IGNORE INTO tenant (id, display_name, status, created_at, updated_at) VALUES (?, ?, 'active', ?, ?)`,
    [DEFAULT_TENANT_ID, 'Pilot', now, now],
  );

  await seedCategories(db, DEFAULT_TENANT_ID);
  await persist();
  return db;
}

/** Process-wide singleton — same DB connection reused across the app, never dropped/recreated. */
export function getLocalDb(): Promise<LocalDbDriver> {
  if (!dbPromise) dbPromise = bootstrap();
  return dbPromise;
}
