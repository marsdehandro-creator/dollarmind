/**
 * Bundles db/migrations/*.sql into the app at build time (Vite raw-text
 * import) so the on-device migration runner has no filesystem to read from —
 * same migration files the server uses, unchanged (docs/v2-migration-spec.md).
 */
import type { MigrationFile } from '@dollarmind/core/db/localMigrate.js';

const modules = import.meta.glob('../../../db/migrations/*.sql', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export function loadBundledMigrations(): MigrationFile[] {
  return Object.entries(modules)
    .map(([path, sql]) => ({ id: path.split('/').pop()!, sql }))
    .sort((a, b) => a.id.localeCompare(b.id));
}
