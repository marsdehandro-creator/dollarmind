/**
 * Database access. `getDb` returns a process-wide singleton opened at
 * env.DATABASE_PATH, migrated and bootstrapped on first use.
 */
import { env, DEFAULT_TENANT_ID } from '../config/index.js';
import { openDb, type Db } from './connection.js';
import { ensureBootstrap, runMigrations } from './migrate.js';
import { seedCategories } from './seedCategories.js';

let singleton: Db | null = null;

/** Open, migrate, and bootstrap a database at the given path. */
export function createConfiguredDb(path: string): Db {
  const db = openDb(path);
  runMigrations(db);
  ensureBootstrap(db);
  seedCategories(db, DEFAULT_TENANT_ID);
  return db;
}

export function getDb(): Db {
  if (!singleton) {
    singleton = createConfiguredDb(env.DATABASE_PATH);
  }
  return singleton;
}

/** Explicit init hook for app startup. Idempotent. */
export function initDatabase(): void {
  getDb();
}

export type { Db } from './connection.js';
