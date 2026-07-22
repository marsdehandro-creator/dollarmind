/**
 * Migration safety gate (docs/v1-offline-product-spec.md — "never lose user
 * data on an update"). Two checks:
 *   1. Static: no migration file contains a destructive statement shape.
 *   2. Behavioral: seeding data, then applying a not-yet-applied migration,
 *      never touches previously-seeded rows.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { runLocalMigrations, assertMigrationsAreAdditive, type MigrationFile } from './localMigrate.js';
import { createNodeTestDriver } from './nodeTestDriver.js';

const MIGRATIONS_DIR = resolve(process.cwd(), '..', '..', 'db', 'migrations');

function loadMigrations(): MigrationFile[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((id) => ({ id, sql: readFileSync(join(MIGRATIONS_DIR, id), 'utf-8') }));
}

describe('migration safety', () => {
  const migrations = loadMigrations();

  it('finds the real migration set (sanity check the path resolved)', () => {
    expect(migrations.length).toBeGreaterThanOrEqual(10);
    expect(migrations[0].id).toBe('0001_init.sql');
  });

  it('contains no destructive statement in any migration file', () => {
    expect(() => assertMigrationsAreAdditive(migrations)).not.toThrow();
  });

  it('rejects a migration set that does contain a destructive statement', () => {
    const bad: MigrationFile[] = [...migrations, { id: '9999_bad.sql', sql: 'DROP TABLE "transaction";' }];
    expect(() => assertMigrationsAreAdditive(bad)).toThrow(/DROP TABLE/);
  });

  it('applies the full chain cleanly from an empty database', async () => {
    const driver = createNodeTestDriver();
    await expect(runLocalMigrations(driver, migrations)).resolves.not.toThrow();
  });

  it('is idempotent — re-running the full chain applies nothing twice', async () => {
    const driver = createNodeTestDriver();
    await runLocalMigrations(driver, migrations);
    await expect(runLocalMigrations(driver, migrations)).resolves.not.toThrow();
    const rows = await driver.query<{ id: string }>('SELECT id FROM _migrations');
    expect(rows.length).toBe(migrations.length);
  });

  it('preserves existing rows when a new migration is applied on top (the update scenario)', async () => {
    const driver = createNodeTestDriver();
    const allButLast = migrations.slice(0, -1);
    const last = migrations[migrations.length - 1];

    // Simulate a user who has been using the app up through the second-to-last migration.
    await runLocalMigrations(driver, allButLast);
    const now = new Date().toISOString();
    await driver.run(
      `INSERT INTO tenant (id, display_name, status, created_at, updated_at) VALUES (?, ?, 'active', ?, ?)`,
      ['test-tenant-id', 'Test Tenant', now, now],
    );
    const before = await driver.query('SELECT * FROM tenant WHERE id = ?', ['test-tenant-id']);
    expect(before).toHaveLength(1);

    // Now ship the update: apply the remaining migration(s).
    await runLocalMigrations(driver, migrations);

    const after = await driver.query('SELECT * FROM tenant WHERE id = ?', ['test-tenant-id']);
    expect(after).toEqual(before);
    void last; // documents intent: this is the migration the update introduces
  });
});
