-- =====================================================================
-- Migration 0001_init  (pilot / SQLite)
-- =====================================================================
-- Initial schema for Phases 6-7: auth (tenant/user/role) + salary slips.
-- Mirrors docs/data-model.md §5 (the canonical SQLite variant).
-- Additional tables (transaction, bank_statement, goal, category, ...) arrive
-- in their own migrations in later phases.
--
-- Conventions: UUID PKs as TEXT, money as INTEGER cents, timestamps as
-- ISO-8601 TEXT (UTC), booleans as INTEGER (0/1), soft delete via archived_at.
-- =====================================================================

CREATE TABLE tenant (
  id            TEXT PRIMARY KEY,
  display_name  TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
) STRICT;

CREATE TABLE role (
  id    TEXT PRIMARY KEY,
  name  TEXT NOT NULL UNIQUE CHECK (name IN ('user','admin','support'))
) STRICT;

CREATE TABLE "user" (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL REFERENCES tenant(id),
  email               TEXT NOT NULL,
  email_verified_at   TEXT,
  password_hash       TEXT,
  password_algo       TEXT NOT NULL DEFAULT 'bcrypt',
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','locked','disabled')),
  failed_login_count  INTEGER NOT NULL DEFAULT 0,
  locked_until        TEXT,
  mfa_enabled         INTEGER NOT NULL DEFAULT 0 CHECK (mfa_enabled IN (0,1)),
  last_login_at       TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  archived_at         TEXT,
  UNIQUE (tenant_id, email)
) STRICT;

CREATE TABLE user_role (
  user_id    TEXT NOT NULL REFERENCES "user"(id),
  role_id    TEXT NOT NULL REFERENCES role(id),
  tenant_id  TEXT NOT NULL REFERENCES tenant(id),
  PRIMARY KEY (user_id, role_id, tenant_id)
) STRICT;

CREATE TABLE account (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL REFERENCES tenant(id),
  kind         TEXT NOT NULL CHECK (kind IN ('bank','income_source')),
  name         TEXT NOT NULL,
  institution  TEXT,
  currency     TEXT NOT NULL DEFAULT 'ZAR',
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  archived_at  TEXT
) STRICT;

CREATE TABLE document (
  id                 TEXT PRIMARY KEY,
  tenant_id          TEXT NOT NULL REFERENCES tenant(id),
  account_id         TEXT REFERENCES account(id),
  doc_type           TEXT NOT NULL CHECK (doc_type IN ('bank_statement','payslip')),
  file_path          TEXT NOT NULL,
  file_hash          TEXT NOT NULL,
  mime_type          TEXT NOT NULL,
  byte_size          INTEGER NOT NULL,
  parser_id          TEXT,
  parse_status       TEXT NOT NULL DEFAULT 'ok' CHECK (parse_status IN ('ok','partial','failed')),
  parse_meta         TEXT,
  uploaded_at        TEXT NOT NULL,
  archived_at        TEXT,
  UNIQUE (tenant_id, file_hash)
) STRICT;

CREATE TABLE salary_slip (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL REFERENCES tenant(id),
  account_id          TEXT NOT NULL REFERENCES account(id),
  source_document_id  TEXT NOT NULL REFERENCES document(id),
  period_start        TEXT NOT NULL,
  period_end          TEXT NOT NULL,
  pay_date            TEXT,
  gross_amount        INTEGER NOT NULL,
  net_amount          INTEGER NOT NULL,
  currency            TEXT NOT NULL DEFAULT 'ZAR',
  confirmed           INTEGER NOT NULL DEFAULT 0 CHECK (confirmed IN (0,1)),
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  archived_at         TEXT
) STRICT;

CREATE TABLE salary_component (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL REFERENCES tenant(id),
  salary_slip_id  TEXT NOT NULL REFERENCES salary_slip(id),
  component_type  TEXT NOT NULL CHECK (component_type IN ('earning','deduction','contribution','allowance','tax')),
  code            TEXT,
  label           TEXT NOT NULL,
  amount          INTEGER NOT NULL,
  is_taxable      INTEGER CHECK (is_taxable IN (0,1)),
  confidence      REAL NOT NULL DEFAULT 1.0,
  display_order   INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
) STRICT;

CREATE TABLE issue_log (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL REFERENCES tenant(id),
  source       TEXT NOT NULL CHECK (source IN ('system','user')),
  kind         TEXT NOT NULL,
  severity     TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','error')),
  entity_type  TEXT,
  entity_id    TEXT,
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  detail       TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  resolved_at  TEXT
) STRICT;

CREATE TABLE audit_log (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL REFERENCES tenant(id),
  actor        TEXT NOT NULL,
  actor_role   TEXT,
  action       TEXT NOT NULL,
  entity_type  TEXT,
  entity_id    TEXT,
  before       TEXT,
  after        TEXT,
  context      TEXT,
  at           TEXT NOT NULL
) STRICT;

CREATE INDEX idx_component_slip       ON salary_component(salary_slip_id);
CREATE INDEX idx_slip_tenant_created  ON salary_slip(tenant_id, created_at);
CREATE INDEX idx_issue_tenant_status  ON issue_log(tenant_id, status);
CREATE INDEX idx_audit_tenant_at      ON audit_log(tenant_id, at);
