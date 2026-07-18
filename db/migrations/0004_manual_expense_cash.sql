-- =====================================================================
-- Migration 0004_manual_expense_cash  (pilot / SQLite)
-- =====================================================================
-- Adds manual expenses (docs/data-model.md §3.12) and cash entries (cash
-- inflow/outflow tracking). category_id / reconciled_transaction_id are plain
-- columns (no FK) as in earlier migrations; reconciliation FKs land with F6.
-- =====================================================================

CREATE TABLE manual_expense (
  id                        TEXT PRIMARY KEY,
  tenant_id                 TEXT NOT NULL REFERENCES tenant(id),
  txn_date                  TEXT NOT NULL,
  amount                    INTEGER NOT NULL,
  currency                  TEXT NOT NULL DEFAULT 'ZAR',
  category_id               TEXT,
  note                      TEXT,
  reconciled_transaction_id TEXT,
  created_at                TEXT NOT NULL,
  updated_at                TEXT NOT NULL,
  archived_at               TEXT
) STRICT;

CREATE TABLE cash_entry (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL REFERENCES tenant(id),
  entry_date   TEXT NOT NULL,
  direction    TEXT NOT NULL CHECK (direction IN ('inflow','outflow')),
  amount       INTEGER NOT NULL,
  currency     TEXT NOT NULL DEFAULT 'ZAR',
  category_id  TEXT,
  note         TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  archived_at  TEXT
) STRICT;

CREATE INDEX idx_manual_expense_tenant ON manual_expense(tenant_id, txn_date);
CREATE INDEX idx_cash_entry_tenant     ON cash_entry(tenant_id, entry_date);
