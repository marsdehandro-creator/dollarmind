-- =====================================================================
-- DollarMind — SQLite schema (pilot)
-- =====================================================================
-- This file is the human-readable REFERENCE for the pilot database.
-- The executable source of truth is the migration set in db/migrations/.
-- The canonical model (with the PostgreSQL variant) lives in
-- docs/data-model.md. Keep them in sync.
--
-- Conventions (docs/data-model.md §1):
--   - UUID primary keys stored as TEXT.
--   - Money as INTEGER minor units (cents).
--   - Timestamps as ISO-8601 TEXT (UTC).
--   - Booleans as INTEGER (0/1).
--   - Soft delete via archived_at.
--
-- The full DDL is applied by migration 0001_init.sql.
-- =====================================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- See db/migrations/0001_init.sql for the table definitions.
