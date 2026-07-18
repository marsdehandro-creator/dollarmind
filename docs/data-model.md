# DollarMind — Data Model

**Status:** Draft v1
**Owner:** Dehandro
**Last updated:** 2026-07-17
**Companion to:** [requirements.md](requirements.md), [architecture.md](architecture.md), [security.md](security.md)

This is the **canonical data model** — it consolidates and supersedes the schema sketches in architecture §4 and security §2.2. Where they differ, this document wins.

---

## 1. Design conventions

These rules apply to **every** table unless explicitly noted. They exist to make the offline→SaaS transition additive (architecture §8) and compliance-ready (security §6).

| Convention | Rule | Why |
|---|---|---|
| **Primary keys** | UUID (v4/v7). Stored as `TEXT` in SQLite, `UUID` in Postgres. | Non-enumerable (anti-IDOR, security §4.6); safe in a future distributed/synced world. |
| **Tenant scoping** | Every business table carries `tenant_id`, even with one tenant today. | Multi-tenancy becomes a filter, not a migration (architecture §8). |
| **Money** | Integer **minor units (cents)**, `INTEGER`/`BIGINT`. Never float/decimal. | Eliminates rounding bugs (architecture §4). `1234` = R12.34. |
| **Currency** | `currency` char(3), default `'ZAR'`. | Region-modular; don't hardcode ZAR into logic. |
| **Timestamps** | `created_at`, `updated_at`. ISO-8601 `TEXT` in SQLite, `TIMESTAMPTZ` in Postgres. UTC always. | Portability + correctness. |
| **Soft delete** | `archived_at` (nullable). Rows are archived, not deleted. | Trust + "don't destroy financial records" (PRD §8.2); erasure is a separate, explicit workflow (security §6). |
| **Provenance** | Derived data records where it came from (source doc, source row, decision source). | Explainability + reversibility (architecture principle 3). |
| **Enums** | `CHECK` constraint on a `TEXT` column (both dialects) rather than native ENUM. | Identical DDL across SQLite/Postgres; easy to extend. |
| **Booleans** | `INTEGER` 0/1 in SQLite, `BOOLEAN` in Postgres. | SQLite has no native boolean. |
| **JSON** | `TEXT` (JSON1) in SQLite, `JSONB` in Postgres. | For flexible/sparse metadata (parse output, issue detail). |

---

## 2. Entity overview & relationships

```
tenant 1───* user 1───* user_role *───1 role
  │            │
  │            └───* session, mfa_factor, oauth_identity, consent   (see security.md)
  │
  ├───* account ──────────────┐
  │        │                  │
  │        │ (income_source)  │ (bank)
  │        ▼                  ▼
  ├───* salary_slip       bank_statement
  │        │                  │
  │        └─* salary_        └─* transaction *─┐
  │           component            │  │         │
  │                                │  │ dedup_group_id (self-cluster)
  │                                │  │
  ├───* category ◀── category_rule │  │
  │        ▲    ▲___________________│  │
  │        │                          │
  ├───* manual_expense ◀──reconciled──┘  (1:1 optional)
  │
  ├───* goal 1───* goal_contribution
  │
  ├───* issue_log        (links polymorphically to any entity)
  │
  └───* audit_log        (append-only; links polymorphically)

document (uploaded file) 1───* transaction        (a bank_statement's file)
document 1───1 salary_slip / bank_statement        (the source file record)
```

**Cardinality summary:**
- `tenant` → many `user`, `account`, `category`, `goal`, `issue_log`, `audit_log`.
- `account` (kind=`bank`) → many `bank_statement`; (kind=`income_source`) → many `salary_slip`.
- `bank_statement` → many `transaction`; `transaction` optionally → 1 `category`, self-clusters via `dedup_group_id`, optionally 1:1 with `manual_expense` via reconciliation.
- `salary_slip` → many `salary_component`.
- `goal` → many `goal_contribution`.
- `document` is the raw-file record; `bank_statement`/`salary_slip` reference it, and `transaction` keeps `source_document_id` + `source_row` for provenance.

---

## 3. Entity definitions

Types below are dialect-neutral; §5 and §6 give the concrete DDL.

### 3.1 tenant
The isolation boundary. One row in the pilot.

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| display_name | text | |
| status | text | `active` \| `suspended` |
| created_at / updated_at | timestamp | |

### 3.2 user
Login identity. See security §2.2 for the full auth-related columns (password_hash, mfa, lockout) — summarized here.

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| tenant_id | UUID FK → tenant | |
| email | text | unique per tenant; the login id |
| email_verified_at | timestamp null | |
| password_hash | text null | Argon2id; null if OAuth-only |
| password_algo | text | e.g. `argon2id` — enables transparent rehash |
| status | text | `active` \| `locked` \| `disabled` |
| failed_login_count | int | lockout tracking |
| locked_until | timestamp null | |
| mfa_enabled | bool | |
| last_login_at | timestamp null | |
| created_at / updated_at | timestamp | |
| archived_at | timestamp null | soft delete |

Relationships: belongs to `tenant`; has many `session`, `user_role`, `mfa_factor`, `oauth_identity`, `consent` (auth tables live in security.md and are omitted here to avoid duplication, except `user_role`/`role` below since RBAC touches data access).

### 3.3 role / user_role (RBAC)

**role**

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| name | text | `user` \| `admin` \| `support` |

**user_role**

| Field | Type | Notes |
|---|---|---|
| user_id | UUID FK → user | |
| role_id | UUID FK → role | |
| tenant_id | UUID FK → tenant | role scoped to a tenant |
| PK | (user_id, role_id, tenant_id) | |

### 3.4 account
A source of financial data — a bank account or an income source (employer). Unifying these lets everything hang off one `tenant → account` spine.

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| tenant_id | UUID FK → tenant | |
| kind | text | `bank` \| `income_source` |
| name | text | e.g. "FNB Cheque", "Employer X" |
| institution | text null | bank/employer name |
| currency | char(3) | default `ZAR` |
| created_at / updated_at | timestamp | |
| archived_at | timestamp null | |

### 3.5 document
The raw uploaded file record. Every ingested file is stored here first; nothing is ever parsed without a `document` row for provenance and reproducibility.

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| tenant_id | UUID FK → tenant | |
| account_id | UUID FK → account null | |
| doc_type | text | `bank_statement` \| `payslip` |
| file_path | text | local path / blob ref (stored outside web root in SaaS, security §4.4) |
| file_hash | text | sha-256; **file-level dedup shortcut** |
| mime_type | text | validated by content, not extension |
| byte_size | int | enforced against upload caps |
| parser_id | text null | which parser+version produced the parse (e.g. `fnb-csv-v2`) |
| parse_status | text | `ok` \| `partial` \| `failed` |
| parse_meta | json | confidence, warnings, raw extract |
| uploaded_at | timestamp | |
| archived_at | timestamp null | |

### 3.6 salary_slip (SalarySlip)
A parsed payslip header. Line-level detail lives in `salary_component` — this is what makes slip parsing **dynamic** (§4.1).

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| tenant_id | UUID FK → tenant | |
| account_id | UUID FK → account | the income source |
| source_document_id | UUID FK → document | |
| period_start | date | |
| period_end | date | |
| pay_date | date null | |
| gross_amount | int | cents; cached total for fast queries |
| net_amount | int | cents; cached total |
| currency | char(3) | default ZAR |
| confirmed | bool | user reviewed the draft parse |
| created_at / updated_at | timestamp | |
| archived_at | timestamp null | |

> `gross_amount`/`net_amount` are **denormalized caches** of the component sums (for fast listing). They must reconcile against `salary_component`; a mismatch raises an `issue_log`.

### 3.7 salary_component (SalaryComponent)
One line on a payslip. **Rows, not columns** — this is the core of dynamic slip parsing: any slip can have arbitrary, employer-specific components.

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| tenant_id | UUID FK → tenant | |
| salary_slip_id | UUID FK → salary_slip | |
| component_type | text | `earning` \| `deduction` \| `contribution` \| `allowance` \| `tax` |
| code | text null | normalized key, e.g. `paye`, `uif`, `pension` |
| label | text | as printed on the slip |
| amount | int | cents |
| is_taxable | bool null | supports SARS guidance (Phase 2) |
| confidence | real | 0..1; low-confidence flags feed `issue_log` |
| display_order | int | preserve slip ordering |
| created_at / updated_at | timestamp | |

### 3.8 bank_statement (BankStatement)
A parsed statement header. Transactions hang off it.

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| tenant_id | UUID FK → tenant | |
| account_id | UUID FK → account | the bank account |
| source_document_id | UUID FK → document | |
| period_start | date null | |
| period_end | date null | |
| opening_balance | int null | cents; for balance validation |
| closing_balance | int null | cents |
| currency | char(3) | default ZAR |
| created_at / updated_at | timestamp | |
| archived_at | timestamp null | |

### 3.9 transaction (Transaction)
The heart of the ledger. Every row keeps provenance and carries the fields that power dedup, categorization, and reconciliation.

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| tenant_id | UUID FK → tenant | |
| account_id | UUID FK → account | |
| bank_statement_id | UUID FK → bank_statement null | |
| source_document_id | UUID FK → document | **provenance** |
| source_row | int null | which line of the source file |
| txn_date | date | posting date |
| description_raw | text | as printed |
| description_norm | text | normalized for matching/dedup (§4.3) |
| amount | int | cents; always positive |
| direction | text | `debit` \| `credit` |
| balance_after | int null | cents, if the statement provides it |
| currency | char(3) | default ZAR |
| category_id | UUID FK → category null | |
| category_source | text | `rule` \| `manual` \| `auto` \| `default` |
| dedup_group_id | UUID null | clusters rows judged "the same" (§4.3) |
| dedup_hash | text | deterministic hash for exact-match dedup |
| reconciled_expense_id | UUID FK → manual_expense null | 1:1 reconciliation |
| created_at / updated_at | timestamp | |
| archived_at | timestamp null | |

### 3.10 category (Category)
User-facing spending categories, optionally hierarchical.

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| tenant_id | UUID FK → tenant | |
| name | text | e.g. "Groceries" |
| parent_id | UUID FK → category null | optional hierarchy |
| is_system | bool | seeded defaults vs. user-created |
| color | text null | UI |
| created_at / updated_at | timestamp | |
| archived_at | timestamp null | |

### 3.11 category_rule
The engine behind **dynamic category detection** (§4.2). Rules match transactions to categories; user overrides create `learned` rules.

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| tenant_id | UUID FK → tenant | |
| match_type | text | `contains` \| `regex` \| `merchant` \| `amount_range` |
| pattern | text | the match expression |
| category_id | UUID FK → category | |
| priority | int | higher wins |
| learned | bool | created from a user override |
| hit_count | int | how often it has matched (for tuning) |
| created_at / updated_at | timestamp | |
| archived_at | timestamp null | |

### 3.12 manual_expense (ManualExpense)
Cash / out-of-band expenses, reconcilable against a `transaction`.

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| tenant_id | UUID FK → tenant | |
| txn_date | date | |
| amount | int | cents |
| currency | char(3) | default ZAR |
| category_id | UUID FK → category null | |
| note | text null | |
| reconciled_transaction_id | UUID FK → transaction null | 1:1; the matched bank txn |
| created_at / updated_at | timestamp | |
| archived_at | timestamp null | |

> Reconciliation is a **1:1 link** on both sides (`transaction.reconciled_expense_id` ↔ `manual_expense.reconciled_transaction_id`) so a reconciled pair is counted once in totals (PRD F6).

### 3.13 goal (Goal)
A savings goal. Feasibility is **computed**, not stored (§4.4).

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| tenant_id | UUID FK → tenant | |
| goal_type | text | `house` \| `car` \| `vacation` \| `emergency` \| `custom` |
| name | text | |
| target_amount | int | cents |
| target_date | date null | |
| priority | int | ordering when multiple goals compete |
| linked_account_id | UUID FK → account null | savings account for auto-detection |
| status | text | `active` \| `achieved` \| `paused` \| `archived` |
| created_at / updated_at | timestamp | |
| archived_at | timestamp null | |

### 3.14 goal_contribution
Individual contributions toward a goal (manual or auto-detected transfers).

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| tenant_id | UUID FK → tenant | |
| goal_id | UUID FK → goal | |
| amount | int | cents |
| contributed_at | date | |
| source | text | `manual` \| `auto_detected` |
| source_transaction_id | UUID FK → transaction null | if auto-detected |
| created_at / updated_at | timestamp | |

### 3.15 issue_log (IssueLog)
Data-quality problems and user-reported bugs (PRD F7). Links polymorphically to any entity.

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| tenant_id | UUID FK → tenant | |
| source | text | `system` \| `user` |
| kind | text | `parse_fail` \| `partial_parse` \| `balance_mismatch` \| `possible_duplicate` \| `reconcile_gap` \| `uncategorized_volume` \| `slip_mismatch` \| `bug` |
| severity | text | `info` \| `warning` \| `error` |
| entity_type | text null | e.g. `transaction`, `document` |
| entity_id | UUID null | polymorphic target |
| status | text | `open` \| `resolved` \| `dismissed` |
| detail | json | context, suggested fix |
| created_at / updated_at | timestamp | |
| resolved_at | timestamp null | |

> Issues are **archived, not deleted** on resolution (PRD F7).

### 3.16 audit_log (AuditLog)
Append-only trail of sensitive actions (security §5). **No `updated_at`, no `archived_at`** — it is immutable.

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| tenant_id | UUID FK → tenant | |
| actor | text | `user:<id>` \| `system:<engine>` |
| actor_role | text null | role at time of action |
| action | text | e.g. `auth.login.success`, `data.export`, `data.erase`, `transaction.recategorize` |
| entity_type | text null | polymorphic |
| entity_id | UUID null | |
| before | json null | minimized — never raw financial detail |
| after | json null | minimized |
| context | json null | SaaS: ip/user-agent (minimized per policy); null in pilot |
| at | timestamp | append time |

---

## 4. How the model supports each capability

### 4.1 Dynamic salary slip parsing
The header/line split (`salary_slip` + `salary_component`) is **entity-attribute style, not fixed columns**. A slip with PAYE, UIF, medical aid, pension, and three employer-specific allowances is just eight `salary_component` rows — no schema change ever needed for a new deduction type.
- `component_type` classifies each line into the breakdown buckets (gross/earning, deduction, contribution, allowance, tax) so the dynamic breakdown (PRD F1) is a `GROUP BY component_type`.
- `confidence` per line flags low-confidence parses → `issue_log`, satisfying "flag, don't silently zero."
- `salary_slip.gross_amount`/`net_amount` are cached sums; reconciliation check (`net = earnings − deductions − tax + allowances`) runs on confirm and raises a `slip_mismatch` issue if it fails.
- `is_taxable` on components feeds the Phase 2 SARS guidance without restructuring.

### 4.2 Dynamic category detection
Three cooperating pieces:
- `category` — the target buckets (system-seeded + user-created).
- `category_rule` — ordered rules (`priority` desc) matched against `transaction.description_norm`/merchant/amount. First match wins; no match → default "Uncategorized".
- **Learning loop:** a user override sets `transaction.category_id` + `category_source='manual'`, and creates/promotes a `category_rule` with `learned=true`. The correction sticks *and* generalizes to future transactions.
- `category_source` records provenance so the UI can show *why* a category was assigned and manual always outranks auto.
- The engine is pluggable (architecture §7): swapping rules for ML changes *how* `category_id` is chosen, not the schema.

### 4.3 Deduplication across multiple uploads
Layered defense (architecture §6):
1. **File level:** `document.file_hash` — re-uploading the identical file short-circuits to "0 new."
2. **Exact transaction:** `transaction.dedup_hash` = deterministic hash of `(account_id, txn_date, amount, direction, description_norm)`. A unique-ish index makes exact duplicates cheap to detect and auto-skip.
3. **Near duplicate:** same account + amount, `txn_date` within ±2 days (pending→posted drift), fuzzy `description_norm` similarity → **not auto-merged**; raises a `possible_duplicate` `issue_log` for review.
4. **Clustering:** confirmed-same rows share a `dedup_group_id`, so overlapping statements never double-count while keeping every original row (reversible).
- `description_norm` is precomputed and indexed so matching is fast and deterministic.
- Every auto-skip/merge is written to `audit_log` and is undoable — dedup never silently eats a real transaction.
- **Idempotency:** re-running an import yields zero new rows (PRD F4 acceptance criterion).

### 4.4 Goal planning & feasibility
- `goal` stores the *target* (amount, date, priority); `goal_contribution` stores *progress*. **Feasibility is computed, never stored**, so it's always current:
  - Progress % = Σ `goal_contribution.amount` ÷ `goal.target_amount`.
  - Required monthly = (target − contributed) ÷ months to `target_date`.
  - Feasibility = required monthly vs. current savings rate, where savings rate is derived from the ledger (income from `salary_slip`/credit transactions − expenses from debit transactions & `manual_expense`).
  - Emergency-fund target derives from average monthly expenses computed over `transaction` history.
- `priority` lets the advisor allocate surplus across competing goals.
- `linked_account_id` + `goal_contribution.source_transaction_id` enable **auto-detected** contributions (transfers into a savings account), while manual contributions cover the rest.

### 4.5 Security & compliance
- **Tenant isolation:** `tenant_id` on every business row. Repository layer filters by the *session's* tenant, never user input (security §2.6); Postgres RLS adds a backstop in SaaS (§6.2). UUID PKs blunt IDOR.
- **Audit:** `audit_log` is append-only and immutable (no update/archive columns), the evidence base for POPIA/GDPR access requests and breach investigations (security §5).
- **Data minimization:** `audit_log.before/after` carry minimized diffs, not raw financial content; `context` (IP/UA) is null in the pilot.
- **Right to access:** the model is fully exportable per tenant (join everything on `tenant_id`) → JSON/CSV export (PRD portability NFR).
- **Right to erasure:** `archived_at` soft-delete for normal use; a separate hard-erasure workflow physically removes a tenant's rows (respecting legally-required retention), logged in `audit_log`.
- **Consent:** the `consent` table (security §2.2) records purpose + policy version, joined by `tenant_id`/`user_id`.
- **Provenance for trust:** every derived value (category, dedup decision, parsed component) records its source and is reversible.

---

## 5. SQLite schema (pilot)

SQLite notes: `PRAGMA foreign_keys = ON;` must be set per connection. No native UUID/BOOLEAN/DECIMAL/TIMESTAMP — use `TEXT` (UUID/ISO-8601), `INTEGER` (0/1 booleans, cents), and `TEXT` for JSON (JSON1 functions available). `STRICT` tables (SQLite ≥ 3.37) enforce column types — recommended.

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE tenant (
  id            TEXT PRIMARY KEY,
  display_name  TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','suspended')),
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
) STRICT;

CREATE TABLE role (
  id    TEXT PRIMARY KEY,
  name  TEXT NOT NULL UNIQUE
          CHECK (name IN ('user','admin','support'))
) STRICT;

CREATE TABLE "user" (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL REFERENCES tenant(id),
  email               TEXT NOT NULL,
  email_verified_at   TEXT,
  password_hash       TEXT,
  password_algo       TEXT NOT NULL DEFAULT 'argon2id',
  status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','locked','disabled')),
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
  parse_status       TEXT NOT NULL DEFAULT 'ok'
                       CHECK (parse_status IN ('ok','partial','failed')),
  parse_meta         TEXT,   -- JSON
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
  component_type  TEXT NOT NULL
                    CHECK (component_type IN ('earning','deduction','contribution','allowance','tax')),
  code            TEXT,
  label           TEXT NOT NULL,
  amount          INTEGER NOT NULL,
  is_taxable      INTEGER CHECK (is_taxable IN (0,1)),
  confidence      REAL NOT NULL DEFAULT 1.0,
  display_order   INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
) STRICT;

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
  match_type   TEXT NOT NULL
                 CHECK (match_type IN ('contains','regex','merchant','amount_range')),
  pattern      TEXT NOT NULL,
  category_id  TEXT NOT NULL REFERENCES category(id),
  priority     INTEGER NOT NULL DEFAULT 100,
  learned      INTEGER NOT NULL DEFAULT 0 CHECK (learned IN (0,1)),
  hit_count    INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  archived_at  TEXT
) STRICT;

CREATE TABLE manual_expense (
  id                        TEXT PRIMARY KEY,
  tenant_id                 TEXT NOT NULL REFERENCES tenant(id),
  txn_date                  TEXT NOT NULL,
  amount                    INTEGER NOT NULL,
  currency                  TEXT NOT NULL DEFAULT 'ZAR',
  category_id               TEXT REFERENCES category(id),
  note                      TEXT,
  reconciled_transaction_id TEXT,   -- FK added after transaction table (circular)
  created_at                TEXT NOT NULL,
  updated_at                TEXT NOT NULL,
  archived_at               TEXT
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
  category_id            TEXT REFERENCES category(id),
  category_source        TEXT NOT NULL DEFAULT 'default'
                           CHECK (category_source IN ('rule','manual','auto','default')),
  dedup_group_id         TEXT,
  dedup_hash             TEXT NOT NULL,
  reconciled_expense_id  TEXT REFERENCES manual_expense(id),
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL,
  archived_at            TEXT
) STRICT;

CREATE TABLE goal (
  id                 TEXT PRIMARY KEY,
  tenant_id          TEXT NOT NULL REFERENCES tenant(id),
  goal_type          TEXT NOT NULL
                       CHECK (goal_type IN ('house','car','vacation','emergency','custom')),
  name               TEXT NOT NULL,
  target_amount      INTEGER NOT NULL,
  target_date        TEXT,
  priority           INTEGER NOT NULL DEFAULT 100,
  linked_account_id  TEXT REFERENCES account(id),
  status             TEXT NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active','achieved','paused','archived')),
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  archived_at        TEXT
) STRICT;

CREATE TABLE goal_contribution (
  id                     TEXT PRIMARY KEY,
  tenant_id              TEXT NOT NULL REFERENCES tenant(id),
  goal_id                TEXT NOT NULL REFERENCES goal(id),
  amount                 INTEGER NOT NULL,
  contributed_at         TEXT NOT NULL,
  source                 TEXT NOT NULL DEFAULT 'manual'
                           CHECK (source IN ('manual','auto_detected')),
  source_transaction_id  TEXT REFERENCES "transaction"(id),
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL
) STRICT;

CREATE TABLE issue_log (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL REFERENCES tenant(id),
  source       TEXT NOT NULL CHECK (source IN ('system','user')),
  kind         TEXT NOT NULL,
  severity     TEXT NOT NULL DEFAULT 'warning'
                 CHECK (severity IN ('info','warning','error')),
  entity_type  TEXT,
  entity_id    TEXT,
  status       TEXT NOT NULL DEFAULT 'open'
                 CHECK (status IN ('open','resolved','dismissed')),
  detail       TEXT,   -- JSON
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
  before       TEXT,   -- JSON, minimized
  after        TEXT,   -- JSON, minimized
  context      TEXT,   -- JSON
  at           TEXT NOT NULL
) STRICT;

-- Indexes: dedup, filters, tenant scoping
CREATE INDEX idx_txn_tenant_acct_date ON "transaction"(tenant_id, account_id, txn_date);
CREATE INDEX idx_txn_dedup_hash        ON "transaction"(tenant_id, dedup_hash);
CREATE INDEX idx_txn_descnorm          ON "transaction"(description_norm);
CREATE INDEX idx_txn_category          ON "transaction"(tenant_id, category_id);
CREATE INDEX idx_component_slip        ON salary_component(salary_slip_id);
CREATE INDEX idx_rule_tenant_priority  ON category_rule(tenant_id, priority);
CREATE INDEX idx_issue_tenant_status   ON issue_log(tenant_id, status);
CREATE INDEX idx_audit_tenant_at       ON audit_log(tenant_id, at);
CREATE INDEX idx_contrib_goal          ON goal_contribution(goal_id);
```

> **Circular FK note:** `transaction.reconciled_expense_id → manual_expense` and `manual_expense.reconciled_transaction_id → transaction` are mutually referential. SQLite tolerates this because FK checks are deferred within a transaction; create both tables, then the app maintains both sides atomically. (In the DDL above `manual_expense.reconciled_transaction_id` is left without an inline `REFERENCES` to avoid an ordering problem; enforce it in application logic, or add it via a later `CREATE TRIGGER`/deferred constraint.)

---

## 6. PostgreSQL schema (SaaS)

Postgres gives us native `UUID`, `BOOLEAN`, `TIMESTAMPTZ`, `JSONB`, `BIGINT`, real deferred FK constraints, generated columns, and **Row-Level Security** for tenant isolation. Same logical model; stronger enforcement.

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid()

CREATE TABLE tenant (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name  TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','suspended')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE role (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name  TEXT NOT NULL UNIQUE CHECK (name IN ('user','admin','support'))
);

CREATE TABLE app_user (            -- 'user' is reserved-ish; name it app_user
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenant(id),
  email               TEXT NOT NULL,
  email_verified_at   TIMESTAMPTZ,
  password_hash       TEXT,
  password_algo       TEXT NOT NULL DEFAULT 'argon2id',
  status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','locked','disabled')),
  failed_login_count  INTEGER NOT NULL DEFAULT 0,
  locked_until        TIMESTAMPTZ,
  mfa_enabled         BOOLEAN NOT NULL DEFAULT false,
  last_login_at       TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at         TIMESTAMPTZ,
  UNIQUE (tenant_id, email)
);

CREATE TABLE user_role (
  user_id    UUID NOT NULL REFERENCES app_user(id),
  role_id    UUID NOT NULL REFERENCES role(id),
  tenant_id  UUID NOT NULL REFERENCES tenant(id),
  PRIMARY KEY (user_id, role_id, tenant_id)
);

CREATE TABLE account (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenant(id),
  kind         TEXT NOT NULL CHECK (kind IN ('bank','income_source')),
  name         TEXT NOT NULL,
  institution  TEXT,
  currency     CHAR(3) NOT NULL DEFAULT 'ZAR',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at  TIMESTAMPTZ
);

CREATE TABLE document (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES tenant(id),
  account_id         UUID REFERENCES account(id),
  doc_type           TEXT NOT NULL CHECK (doc_type IN ('bank_statement','payslip')),
  file_path          TEXT NOT NULL,
  file_hash          TEXT NOT NULL,
  mime_type          TEXT NOT NULL,
  byte_size          BIGINT NOT NULL,
  parser_id          TEXT,
  parse_status       TEXT NOT NULL DEFAULT 'ok'
                       CHECK (parse_status IN ('ok','partial','failed')),
  parse_meta         JSONB,
  uploaded_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at        TIMESTAMPTZ,
  UNIQUE (tenant_id, file_hash)
);

CREATE TABLE salary_slip (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenant(id),
  account_id          UUID NOT NULL REFERENCES account(id),
  source_document_id  UUID NOT NULL REFERENCES document(id),
  period_start        DATE NOT NULL,
  period_end          DATE NOT NULL,
  pay_date            DATE,
  gross_amount        BIGINT NOT NULL,
  net_amount          BIGINT NOT NULL,
  currency            CHAR(3) NOT NULL DEFAULT 'ZAR',
  confirmed           BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at         TIMESTAMPTZ
);

CREATE TABLE salary_component (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenant(id),
  salary_slip_id  UUID NOT NULL REFERENCES salary_slip(id) ON DELETE CASCADE,
  component_type  TEXT NOT NULL
                    CHECK (component_type IN ('earning','deduction','contribution','allowance','tax')),
  code            TEXT,
  label           TEXT NOT NULL,
  amount          BIGINT NOT NULL,
  is_taxable      BOOLEAN,
  confidence      REAL NOT NULL DEFAULT 1.0,
  display_order   INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE bank_statement (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenant(id),
  account_id          UUID NOT NULL REFERENCES account(id),
  source_document_id  UUID NOT NULL REFERENCES document(id),
  period_start        DATE,
  period_end          DATE,
  opening_balance     BIGINT,
  closing_balance     BIGINT,
  currency            CHAR(3) NOT NULL DEFAULT 'ZAR',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at         TIMESTAMPTZ
);

CREATE TABLE category (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenant(id),
  name         TEXT NOT NULL,
  parent_id    UUID REFERENCES category(id),
  is_system    BOOLEAN NOT NULL DEFAULT false,
  color        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at  TIMESTAMPTZ
);

CREATE TABLE category_rule (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenant(id),
  match_type   TEXT NOT NULL
                 CHECK (match_type IN ('contains','regex','merchant','amount_range')),
  pattern      TEXT NOT NULL,
  category_id  UUID NOT NULL REFERENCES category(id),
  priority     INTEGER NOT NULL DEFAULT 100,
  learned      BOOLEAN NOT NULL DEFAULT false,
  hit_count    INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at  TIMESTAMPTZ
);

CREATE TABLE manual_expense (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID NOT NULL REFERENCES tenant(id),
  txn_date                  DATE NOT NULL,
  amount                    BIGINT NOT NULL,
  currency                  CHAR(3) NOT NULL DEFAULT 'ZAR',
  category_id               UUID REFERENCES category(id),
  note                      TEXT,
  reconciled_transaction_id UUID,   -- FK added post-hoc (circular); DEFERRABLE
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at               TIMESTAMPTZ
);

CREATE TABLE "transaction" (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID NOT NULL REFERENCES tenant(id),
  account_id             UUID NOT NULL REFERENCES account(id),
  bank_statement_id      UUID REFERENCES bank_statement(id),
  source_document_id     UUID NOT NULL REFERENCES document(id),
  source_row             INTEGER,
  txn_date               DATE NOT NULL,
  description_raw        TEXT NOT NULL,
  description_norm       TEXT NOT NULL,
  amount                 BIGINT NOT NULL,
  direction              TEXT NOT NULL CHECK (direction IN ('debit','credit')),
  balance_after          BIGINT,
  currency               CHAR(3) NOT NULL DEFAULT 'ZAR',
  category_id            UUID REFERENCES category(id),
  category_source        TEXT NOT NULL DEFAULT 'default'
                           CHECK (category_source IN ('rule','manual','auto','default')),
  dedup_group_id         UUID,
  dedup_hash             TEXT NOT NULL,
  reconciled_expense_id  UUID REFERENCES manual_expense(id) DEFERRABLE INITIALLY DEFERRED,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at            TIMESTAMPTZ
);

ALTER TABLE manual_expense
  ADD CONSTRAINT fk_me_txn FOREIGN KEY (reconciled_transaction_id)
  REFERENCES "transaction"(id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE goal (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES tenant(id),
  goal_type          TEXT NOT NULL
                       CHECK (goal_type IN ('house','car','vacation','emergency','custom')),
  name               TEXT NOT NULL,
  target_amount      BIGINT NOT NULL,
  target_date        DATE,
  priority           INTEGER NOT NULL DEFAULT 100,
  linked_account_id  UUID REFERENCES account(id),
  status             TEXT NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active','achieved','paused','archived')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at        TIMESTAMPTZ
);

CREATE TABLE goal_contribution (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID NOT NULL REFERENCES tenant(id),
  goal_id                UUID NOT NULL REFERENCES goal(id) ON DELETE CASCADE,
  amount                 BIGINT NOT NULL,
  contributed_at         DATE NOT NULL,
  source                 TEXT NOT NULL DEFAULT 'manual'
                           CHECK (source IN ('manual','auto_detected')),
  source_transaction_id  UUID REFERENCES "transaction"(id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE issue_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenant(id),
  source       TEXT NOT NULL CHECK (source IN ('system','user')),
  kind         TEXT NOT NULL,
  severity     TEXT NOT NULL DEFAULT 'warning'
                 CHECK (severity IN ('info','warning','error')),
  entity_type  TEXT,
  entity_id    UUID,
  status       TEXT NOT NULL DEFAULT 'open'
                 CHECK (status IN ('open','resolved','dismissed')),
  detail       JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at  TIMESTAMPTZ
);

CREATE TABLE audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenant(id),
  actor        TEXT NOT NULL,
  actor_role   TEXT,
  action       TEXT NOT NULL,
  entity_type  TEXT,
  entity_id    UUID,
  before       JSONB,
  after        JSONB,
  context      JSONB,
  at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_txn_tenant_acct_date ON "transaction"(tenant_id, account_id, txn_date);
CREATE INDEX idx_txn_dedup_hash        ON "transaction"(tenant_id, dedup_hash);
CREATE INDEX idx_txn_descnorm_trgm     ON "transaction" USING gin (description_norm gin_trgm_ops); -- needs pg_trgm; fuzzy match
CREATE INDEX idx_txn_category          ON "transaction"(tenant_id, category_id);
CREATE INDEX idx_component_slip        ON salary_component(salary_slip_id);
CREATE INDEX idx_rule_tenant_priority  ON category_rule(tenant_id, priority DESC);
CREATE INDEX idx_issue_tenant_status   ON issue_log(tenant_id, status);
CREATE INDEX idx_audit_tenant_at       ON audit_log(tenant_id, at DESC);
CREATE INDEX idx_contrib_goal          ON goal_contribution(goal_id);
```

### 6.1 Append-only audit log enforcement
In Postgres, back the immutability with a rule/trigger and privileges (the app role gets `INSERT`/`SELECT` only):

```sql
REVOKE UPDATE, DELETE ON audit_log FROM app_role;
CREATE RULE audit_log_no_update AS ON UPDATE TO audit_log DO INSTEAD NOTHING;
CREATE RULE audit_log_no_delete AS ON DELETE TO audit_log DO INSTEAD NOTHING;
```

### 6.2 Row-Level Security (tenant isolation backstop)
Belt-and-suspenders on top of repository-layer scoping (security §2.6). The app sets `SET app.tenant_id = '<uuid>'` per request/transaction:

```sql
ALTER TABLE "transaction" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "transaction"
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
-- repeat per tenant-scoped table
```

Even a buggy query missing a `WHERE tenant_id = …` cannot cross tenants.

---

## 7. SQLite → PostgreSQL migration

The two schemas are **the same logical model by design**, so migration is a data move, not a redesign. The differences are mechanical and enumerable.

### 7.1 Type mapping

| Concept | SQLite | PostgreSQL | Migration action |
|---|---|---|---|
| UUID PK/FK | `TEXT` | `UUID` | Cast `text → uuid` (values are already valid UUID strings) |
| Boolean | `INTEGER` 0/1 | `BOOLEAN` | `0→false, 1→true` |
| Money | `INTEGER` | `BIGINT` | Direct (widen) |
| Timestamp | `TEXT` ISO-8601 | `TIMESTAMPTZ` | Parse ISO-8601 → timestamptz (already UTC) |
| Date | `TEXT` | `DATE` | Parse |
| JSON | `TEXT` | `JSONB` | `text → jsonb` cast |
| Enums | `CHECK` on TEXT | `CHECK` on TEXT | Identical — no change |
| `"user"` table | `user` | `app_user` | Rename during load |

### 7.2 Strategy
1. **Schema parity is maintained continuously.** Keep the two DDL files in lock-step; every migration is authored for both dialects (or generated by an ORM that targets both — Drizzle/Prisma/SQLAlchemy).
2. **Migrations are versioned from day one** (architecture §3.1). The pilot runs migrations `0001..000N` against SQLite. The SaaS Postgres starts from the *same* migration history re-expressed in Postgres DDL — same version numbers, same logical steps.
3. **One-time data transfer** when a user (or you) moves from pilot to cloud:
   - Export each table from SQLite (ordered to respect FKs: `tenant → role → user → account → document → salary_slip → salary_component → bank_statement → category → category_rule → manual_expense → transaction → goal → goal_contribution → issue_log → audit_log`).
   - Transform per the type-mapping table (a small ETL script, or an ORM-level dump/load).
   - Load into Postgres inside a single transaction with FK checks deferred; then `ANALYZE`.
   - Enable RLS and the audit-log immutability rules **after** load.
4. **Verify:** row counts per table match; spot-check money/timestamp casts; re-run the dedup idempotency check (importing nothing new yields zero rows); validate FK integrity.

### 7.3 What makes this cheap (recap of the design bets)
- `tenant_id` everywhere → no structural change for multi-tenancy.
- UUID PKs → IDs are portable across engines with no re-keying.
- Integer-cents money → no float/decimal precision drift on transfer.
- UTC ISO-8601 timestamps → unambiguous parse to `TIMESTAMPTZ`.
- `CHECK`-based enums → identical constraints in both engines.
- Same migration history → the ORM/tooling replays the same logical steps.

### 7.4 Practical recommendation
Use an ORM/migration tool that targets **both** SQLite and Postgres from one schema definition (e.g. **Drizzle** or **Prisma** for TS, **SQLAlchemy/Alembic** for Python). Author the model once; let the tool emit dialect-appropriate DDL. This removes the risk of the two schemas drifting apart and turns "SQLite → Postgres" into "point the same app at a different connection string + run the ETL once." Keep the hand-written DDL in this doc as the **reference/spec**; the ORM is the executable source of truth.

---

## 8. Open data-model decisions

1. **UUID v4 vs. v7:** v7 is time-ordered → better index locality for `transaction`. Recommend **v7** if tooling supports it.
2. **Reconciliation cardinality:** strictly 1:1 (current design) vs. allowing a manual expense to match multiple partial transactions — confirm 1:1 is sufficient.
3. **Balance validation storage:** compute-on-the-fly from `opening_balance` + Σtransactions, or persist a running reconciled balance? (Current: compute; `balance_after` is provenance only.)
4. **Category hierarchy depth:** allow arbitrary nesting (`parent_id` self-ref) or cap at two levels for UI simplicity?
5. **Audit-log integrity:** plain append-only (current) vs. hash-chained entries for tamper-evidence (security §9 open item).
6. **Multi-currency:** the model carries `currency` per row but the engine assumes ZAR — decide when/if to activate FX handling.

---

*Canonical data model for the app. One logical schema, two dialects, tenant-scoped and compliance-ready from the first row — so the pilot's SQLite file and the SaaS's Postgres cluster are the same model at two scales, and the move between them is an ETL, not a rewrite.*
