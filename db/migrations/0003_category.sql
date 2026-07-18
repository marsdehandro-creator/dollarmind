-- =====================================================================
-- Migration 0003_category  (pilot / SQLite)
-- =====================================================================
-- Adds categories + categorization rules (docs/data-model.md §5).
-- transaction.category_id remains a plain column (no FK) as noted in 0002.
-- =====================================================================

CREATE TABLE category (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL REFERENCES tenant(id),
  name         TEXT NOT NULL,
  parent_id    TEXT REFERENCES category(id),
  is_system    INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0,1)),
  color        TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  archived_at  TEXT
) STRICT;

CREATE TABLE category_rule (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL REFERENCES tenant(id),
  match_type   TEXT NOT NULL CHECK (match_type IN ('contains','regex','merchant','amount_range')),
  pattern      TEXT NOT NULL,
  category_id  TEXT NOT NULL REFERENCES category(id),
  priority     INTEGER NOT NULL DEFAULT 100,
  learned      INTEGER NOT NULL DEFAULT 0 CHECK (learned IN (0,1)),
  hit_count    INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  archived_at  TEXT
) STRICT;

CREATE INDEX idx_category_tenant       ON category(tenant_id);
CREATE INDEX idx_rule_tenant_priority  ON category_rule(tenant_id, priority);
