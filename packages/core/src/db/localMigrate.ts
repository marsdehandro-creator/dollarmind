/**
 * On-device migration runner.
 *
 * Mirrors backend/src/db/migrate.ts's `_migrations` tracking-table pattern
 * (docs/v1-offline-product-spec.md's non-destructive-migration requirement),
 * but async (the on-device driver is Promise-based) and driver/migration-source
 * agnostic — callers hand it the SQL text rather than this module reading
 * files itself, so the same runner works whether migrations come from `fs`
 * (Node) or a bundled asset import (browser/Capacitor).
 *
 * This never deletes or recreates the database file — it only ever opens the
 * existing one and applies whatever migrations haven't run yet.
 */
import type { LocalDbDriver } from './LocalDbDriver.js';
import { nowIso } from '../utils/id.js';

export interface MigrationFile {
  id: string;
  sql: string;
}

/** SQL string literal escaping for the two controlled, non-user-supplied values below. */
function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** Statement shapes never allowed in a migration — see assertMigrationsAreAdditive. */
const FORBIDDEN_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /\bDROP\s+TABLE\b/i, reason: 'DROP TABLE would destroy an existing table and all its rows' },
  { pattern: /\bALTER\s+TABLE\s+\S+\s+DROP\b/i, reason: 'ALTER TABLE ... DROP would destroy an existing column and its data' },
  { pattern: /\bDELETE\s+FROM\b/i, reason: 'DELETE FROM in a schema migration would destroy existing rows' },
  { pattern: /\bTRUNCATE\b/i, reason: 'TRUNCATE would destroy all rows in a table' },
];

/**
 * Enforces the additive-only migration policy: throws if any migration in the
 * set contains a statement shape that could destroy existing user data.
 * Call this in tests against every migration file, and optionally at runtime
 * before applying a migration that shipped in an update.
 */
export function assertMigrationsAreAdditive(migrations: MigrationFile[]): void {
  for (const m of migrations) {
    for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
      if (pattern.test(m.sql)) {
        throw new Error(`Migration "${m.id}" contains a forbidden destructive statement: ${reason}`);
      }
    }
  }
}

/**
 * Applies every migration in `migrations` that hasn't already been recorded
 * in `_migrations`, in id order (filenames are zero-padded, e.g. 0001_*.sql,
 * so lexicographic order is apply order). Idempotent — safe to call on every
 * app start.
 */
export async function runLocalMigrations(driver: LocalDbDriver, migrations: MigrationFile[]): Promise<void> {
  await driver.execute('CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL) STRICT;');
  const appliedRows = await driver.query<{ id: string }>('SELECT id FROM _migrations');
  const applied = new Set(appliedRows.map((r) => r.id));

  const sorted = [...migrations].sort((a, b) => a.id.localeCompare(b.id));
  for (const m of sorted) {
    if (applied.has(m.id)) continue;
    try {
      // Everything inside the transaction goes through execute(), never
      // run() — run() persists (exports the DB) per call, and doing that
      // while a manual transaction is open silently ends it (confirmed
      // empirically against sql.js), which broke the final COMMIT below.
      await driver.execute('BEGIN;');
      await driver.execute(m.sql);
      await driver.execute(
        `INSERT INTO _migrations (id, applied_at) VALUES (${sqlLiteral(m.id)}, ${sqlLiteral(nowIso())});`,
      );
      await driver.execute('COMMIT;');
    } catch (err) {
      // Best-effort rollback — never let a failed rollback mask the real error above.
      try {
        await driver.execute('ROLLBACK;');
      } catch {
        /* ignore */
      }
      throw new Error(`Migration "${m.id}" failed: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
    }
  }
}
