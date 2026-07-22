/**
 * Migration runner + bootstrap seeding.
 *
 * Applies ordered .sql files from db/migrations, tracking applied versions in a
 * `_migrations` table so it is idempotent. `ensureBootstrap` seeds the single
 * pilot tenant and the RBAC roles (docs/data-model.md §7, docs/security.md §2.2).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Db } from './connection.js';
import { DEFAULT_TENANT_ID } from '../config/index.js';
import { nowIso } from '@dollarmind/core/utils/id.js';
import { logger } from '@dollarmind/core/utils/logger.js';

const MIGRATIONS_DIR =
  process.env.DOLLARMIND_MIGRATIONS_DIR ??
  process.env.MIGRATIONS_DIR ??
  resolve(process.cwd(), '..', 'db', 'migrations');

/** Fixed role ids so user_role rows can reference them deterministically. */
export const ROLE_IDS: Record<string, string> = {
  user: '00000000-0000-0000-0000-0000000000a1',
  admin: '00000000-0000-0000-0000-0000000000a2',
  support: '00000000-0000-0000-0000-0000000000a3',
};

export function runMigrations(db: Db): void {
  db.exec('CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL) STRICT;');
  const appliedRows = db.prepare('SELECT id FROM _migrations').all() as { id: string }[];
  const applied = new Set(appliedRows.map((r) => r.id));

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');
    db.exec('BEGIN;');
    try {
      db.exec(sql);
      db.prepare('INSERT INTO _migrations (id, applied_at) VALUES (?, ?)').run(file, nowIso());
      db.exec('COMMIT;');
      logger.info(`migration applied: ${file}`);
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  }
}

export function ensureBootstrap(db: Db): void {
  const now = nowIso();
  db.prepare(
    `INSERT OR IGNORE INTO tenant (id, display_name, status, created_at, updated_at)
     VALUES (?, ?, 'active', ?, ?)`,
  ).run(DEFAULT_TENANT_ID, 'Pilot', now, now);

  const insertRole = db.prepare('INSERT OR IGNORE INTO role (id, name) VALUES (?, ?)');
  for (const [name, id] of Object.entries(ROLE_IDS)) {
    insertRole.run(id, name);
  }
}
