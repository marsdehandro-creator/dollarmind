/**
 * Table-level dump/restore primitives shared by exportImport.ts (user-facing
 * backup) and migrationBackup.ts (automatic pre-migration snapshot). Kept as
 * a leaf module with no dependency on db.ts, so neither of those two modules
 * risk an import cycle through this one.
 */
import type { LocalDbDriver } from '@dollarmind/core/db/LocalDbDriver.js';

// Import order matters — dependents must follow what they reference (foreign
// keys are enforced; see db/migrations/*.sql for the actual constraints).
const EXPORT_TABLES = [
  'account',
  'category',
  'merchant_rule',
  'document',
  'category_rule',
  'salary_slip',
  'bank_statement',
  'salary_component',
  'transaction',
  'manual_expense',
  'cash_entry',
  'goal',
  'issue_log',
  'audit_log',
] as const;

const SCHEMA_VERSION = 1;

export interface ExportBundle {
  format: 'dollarmind-export';
  schemaVersion: number;
  exportedAt: string;
  tables: Record<string, Record<string, unknown>[]>;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// BLOB round-tripping is verified against the web (sql.js) driver, which
// returns BLOB columns as Uint8Array. Not yet verified against the native
// Android driver, whose JS bridge may hand blobs back as base64 strings
// already — see Phase 6 Android testing.
function encodeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = v instanceof Uint8Array ? { __blob_base64__: toBase64(v) } : v;
  }
  return out;
}

export function decodeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] =
      v && typeof v === 'object' && '__blob_base64__' in v ? fromBase64((v as { __blob_base64__: string }).__blob_base64__) : v;
  }
  return out;
}

export function exportTableNames(): readonly string[] {
  return EXPORT_TABLES;
}

export async function dumpTables(db: LocalDbDriver): Promise<ExportBundle> {
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const table of EXPORT_TABLES) {
    const rows = await db.query<Record<string, unknown>>(`SELECT * FROM "${table}"`);
    tables[table] = rows.map(encodeRow);
  }
  return { format: 'dollarmind-export', schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), tables };
}
