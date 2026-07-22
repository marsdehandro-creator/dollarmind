/**
 * Full-data export/import (docs/v1-offline-product-spec.md Decision 7) — the
 * safety net for "device loss = data loss" since V1 has no cloud backup.
 * Exports every user-data table to a single JSON file; import restores it via
 * direct idempotent inserts (safe to re-run — rows are matched by their real
 * identity before inserting, so re-importing the same export twice, or
 * restoring onto a device that already re-seeded its own categories, never
 * creates duplicates).
 *
 * Deliberately excludes: tenant/role/user/user_role/user_session/user_settings
 * (bootstrap/reference rows recreated by migration+seed on any install, or
 * tables unused by V1's single-local-user runtime — nothing in the local
 * composition root writes to them). The app-lock PIN (pinLock.ts) lives in
 * localStorage specifically so it's outside this export too — restoring a
 * backup on a new device shouldn't carry over the old device's PIN.
 *
 * Categories deserve a specific note: seedCategories.ts assigns each category
 * a fresh random id on every install (idempotent per-install by name, but NOT
 * stable across installs). A naive id-keyed import would therefore treat a
 * restored backup's categories as all-new and duplicate every one of them —
 * confirmed empirically (15 categories became 30). Categories are matched by
 * (tenant_id, name) instead, and every row that references a category_id is
 * remapped from the backup's id to whatever id that category actually has on
 * *this* install before being inserted. category_rule rows that aren't
 * user-learned are skipped entirely — they're exactly reproduced by
 * seedCategories() from the same bundled config either way.
 */
import type { LocalDbDriver } from '@dollarmind/core/db/LocalDbDriver.js';
import { getLocalDb } from './db.js';
import { dumpTables, decodeRow, exportTableNames, type ExportBundle } from './tableDump.js';

export type { ExportBundle };

export async function buildExport(): Promise<ExportBundle> {
  const db = await getLocalDb();
  return dumpTables(db);
}

export async function exportToJson(): Promise<string> {
  return JSON.stringify(await buildExport(), null, 2);
}

export interface ImportSummary {
  inserted: number;
  skippedExisting: number;
  tablesProcessed: number;
}

function isExportBundle(data: unknown): data is ExportBundle {
  return (
    !!data &&
    typeof data === 'object' &&
    (data as ExportBundle).format === 'dollarmind-export' &&
    typeof (data as ExportBundle).tables === 'object'
  );
}

// Every exported table is keyed by a single "id" column except merchant_rule,
// whose primary key is the composite (tenant_id, merchant) — see
// db/migrations/0009_merchant_rules_confidence.sql — and category, which
// needs identity-by-name (see module doc comment above).
const KEY_COLUMNS: Record<string, string[]> = {
  merchant_rule: ['tenant_id', 'merchant'],
  category: ['tenant_id', 'name'],
};

// Tables whose category_id column must be remapped through categoryIdRemap
// before insert, since it may point at an id from the exporting device that
// this device's copy of that same category never had.
const REMAPS_CATEGORY_ID = new Set(['transaction', 'manual_expense', 'cash_entry', 'goal', 'category_rule']);

async function findExistingId(db: LocalDbDriver, table: string, keyColumns: string[], decoded: Record<string, unknown>): Promise<string | undefined> {
  const whereClause = keyColumns.map((c) => `"${c}" = ?`).join(' AND ');
  const rows = await db.query<{ id: string }>(
    `SELECT id FROM "${table}" WHERE ${whereClause}`,
    keyColumns.map((c) => decoded[c]),
  );
  return rows[0]?.id;
}

async function rowExists(db: LocalDbDriver, table: string, keyColumns: string[], decoded: Record<string, unknown>): Promise<boolean> {
  const whereClause = keyColumns.map((c) => `"${c}" = ?`).join(' AND ');
  const rows = await db.query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM "${table}" WHERE ${whereClause}`,
    keyColumns.map((c) => decoded[c]),
  );
  return (rows[0]?.n ?? 0) > 0;
}

async function insertRow(db: LocalDbDriver, table: string, columns: string[], decoded: Record<string, unknown>): Promise<void> {
  const placeholders = columns.map(() => '?').join(', ');
  await db.run(
    `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${placeholders})`,
    columns.map((c) => decoded[c]),
  );
}

/**
 * Imports the `category` table first and specially: matched by name, not id.
 * Returns a map from the backup's category id to the id that category
 * actually has on this install (whether it already existed or was just
 * inserted), so every other table can remap its category_id references.
 */
async function importCategories(db: LocalDbDriver, rows: Record<string, unknown>[]): Promise<{ idRemap: Map<string, string>; inserted: number; skipped: number }> {
  const idRemap = new Map<string, string>();
  let inserted = 0;
  let skipped = 0;
  for (const raw of rows) {
    const decoded = decodeRow(raw);
    const backupId = decoded.id as string;
    const existingId = await findExistingId(db, 'category', KEY_COLUMNS.category, decoded);
    if (existingId) {
      idRemap.set(backupId, existingId);
      skipped++;
      continue;
    }
    await insertRow(db, 'category', Object.keys(decoded), decoded);
    idRemap.set(backupId, backupId);
    inserted++;
  }
  return { idRemap, inserted, skipped };
}

function remapCategoryId(decoded: Record<string, unknown>, idRemap: Map<string, string>): Record<string, unknown> {
  if (typeof decoded.categoryId === 'string' && idRemap.has(decoded.categoryId)) {
    return { ...decoded, categoryId: idRemap.get(decoded.categoryId) };
  }
  // Raw driver rows use snake_case column names, not the camelCase model field.
  if (typeof decoded.category_id === 'string' && idRemap.has(decoded.category_id)) {
    return { ...decoded, category_id: idRemap.get(decoded.category_id) };
  }
  return decoded;
}

/** Restores an export. Safe to run multiple times — matching rows are left untouched, never overwritten or duplicated. */
export async function importFromJson(json: string): Promise<ImportSummary> {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('This file is not valid JSON.');
  }
  if (!isExportBundle(data)) {
    throw new Error('This file is not a DollarMind export.');
  }

  const db = await getLocalDb();
  let inserted = 0;
  let skippedExisting = 0;
  let tablesProcessed = 0;
  let categoryIdRemap = new Map<string, string>();

  for (const table of exportTableNames()) {
    const rows = data.tables[table];
    if (!rows) continue;
    tablesProcessed++;

    if (table === 'category') {
      const result = await importCategories(db, rows);
      categoryIdRemap = result.idRemap;
      inserted += result.inserted;
      skippedExisting += result.skipped;
      continue;
    }

    for (const raw of rows) {
      let decoded = decodeRow(raw);

      // Seed-derived rules are reproduced exactly by seedCategories() from the
      // same bundled config on every install — only user-learned ones carry
      // information that config doesn't already have.
      if (table === 'category_rule' && !decoded.learned) continue;

      if (REMAPS_CATEGORY_ID.has(table)) decoded = remapCategoryId(decoded, categoryIdRemap);

      const keyColumns = KEY_COLUMNS[table] ?? ['id'];
      if (await rowExists(db, table, keyColumns, decoded)) {
        skippedExisting++;
        continue;
      }
      await insertRow(db, table, Object.keys(decoded), decoded);
      inserted++;
    }
  }

  return { inserted, skippedExisting, tablesProcessed };
}
