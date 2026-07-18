-- =====================================================================
-- Migration 0002_bank_statement_transaction  (pilot / SQLite)
-- =====================================================================
-- Adds bank statements + the transaction ledger (docs/data-model.md §5).
--
-- Note: transaction.category_id and reconciled_expense_id are plain columns
-- (no FK) for now, because the category and manual_expense tables arrive in
-- later phases. The canonical model (docs/data-model.md) adds those FKs when
-- those tables land.
-- =====================================================================

CREATE TABLE bank_statement (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL REFERENCES tenant(id),
  account_id          TEXT NOT NULL REFERENCES account(id),
  source_document_id  TEXT NOT NULL REFERENCES document(id),
  period_start        TEXT,
  period_end          TEXT,
  opening_balance     INTEGER,
  closing_balance     INTEGER,
  currency            TEXT NOT NULL DEFAULT 'ZAR',
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  archived_at         TEXT
) STRICT;

CREATE TABLE "transaction" (
  id                     TEXT PRIMARY KEY,
  tenant_id              TEXT NOT NULL REFERENCES tenant(id),
  account_id             TEXT NOT NULL REFERENCES account(id),
  bank_statement_id      TEXT REFERENCES bank_statement(id),
  source_document_id     TEXT NOT NULL REFERENCES document(id),
  source_row             INTEGER,
  txn_date               TEXT NOT NULL,
  description_raw        TEXT NOT NULL,
  description_norm       TEXT NOT NULL,
  amount                 INTEGER NOT NULL,
  direction              TEXT NOT NULL CHECK (direction IN ('debit','credit')),
  balance_after          INTEGER,
  currency               TEXT NOT NULL DEFAULT 'ZAR',
  category_id            TEXT,
  category_source        TEXT NOT NULL DEFAULT 'default'
                           CHECK (category_source IN ('rule','manual','auto','default')),
  dedup_group_id         TEXT,
  dedup_hash             TEXT NOT NULL,
  reconciled_expense_id  TEXT,
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL,
  archived_at            TEXT
) STRICT;

CREATE INDEX idx_txn_tenant_acct_date ON "transaction"(tenant_id, account_id, txn_date);
CREATE INDEX idx_txn_dedup_hash       ON "transaction"(tenant_id, dedup_hash);
CREATE INDEX idx_txn_descnorm         ON "transaction"(description_norm);
CREATE INDEX idx_txn_category         ON "transaction"(tenant_id, category_id);
CREATE INDEX idx_stmt_tenant_created  ON bank_statement(tenant_id, created_at);
