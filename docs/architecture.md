# DollarMind — Technical Architecture

**Status:** Draft v1
**Owner:** Dehandro
**Last updated:** 2026-07-17
**Companion to:** [requirements.md](requirements.md)

---

## 1. Architectural goals

This architecture serves one strategic constraint above all: **build offline-first now, but never make a decision that forces an offline→SaaS rewrite later.** Everything below is chosen so the cloud/multi-tenant move is *additive*, not a teardown.

Three load-bearing principles:

1. **Engine ≠ Storage ≠ Transport.** Business logic (parsing, dedup, categorization, advice) knows nothing about *where* data lives or *how* it's synced. This separation is the whole ballgame for the SaaS transition.
2. **Tenant-scoped from record #1.** Every row carries a `tenant_id` even though there's exactly one tenant today. Multi-tenancy becomes a filter, not a migration.
3. **Provenance + reversibility everywhere.** Every derived value (category, dedup decision, parsed field) stores where it came from and can be undone. This is both a trust feature and an audit/compliance foundation.

---

## 2. High-level shape

```
┌─────────────────────────────────────────────────────────┐
│                        UI Layer                          │
│   (screens, import previews, dashboard, issues, goals)   │
└───────────────────────────┬─────────────────────────────┘
                            │ calls use-cases only
┌───────────────────────────▼─────────────────────────────┐
│                    Application Layer                      │
│   Use-cases / services: ImportStatement, IngestPayslip,  │
│   Categorize, Deduplicate, Reconcile, ProjectGoal        │
└───────────────────────────┬─────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼──────┐   ┌────────▼────────┐  ┌───────▼────────┐
│    Engine    │   │   Repositories   │  │   Adapters     │
│ (pure logic) │   │ (storage ports)  │  │ (parsers, I/O) │
│              │   │                  │  │                │
│ • Parsers*   │   │  interface only  │  │ • Bank parsers │
│ • Dedup      │   │  ↓ implemented   │  │ • Slip parsers │
│ • Categorize │   │    by storage    │  │ • File readers │
│ • Advisor    │   │                  │  │                │
│ • Goals      │   └────────┬─────────┘  └────────────────┘
└──────────────┘            │
                  ┌─────────▼──────────┐
                  │   Storage Layer     │
                  │  Local: SQLite/     │
                  │  embedded DB        │
                  │  (later: + cloud    │
                  │   sync adapter)     │
                  └─────────────────────┘
```

\*Parser *orchestration* is engine logic; the format-specific extraction lives in swappable adapters (§5).

**The key rule:** dependencies point inward. UI → Application → Engine. Engine depends on *nothing* concrete — it talks to storage through repository interfaces (ports) and to the outside world through adapter interfaces. Swapping SQLite for a cloud DB, or a rules categorizer for an ML one, means writing a new adapter, not touching the engine.

---

## 3. Technology recommendation

I'll recommend a concrete stack, but the architecture above survives most substitutions. Pick based on what you'll enjoy maintaining.

### 3.1 Recommended: local-first web/desktop app

| Concern | Recommendation | Why |
|---|---|---|
| **App shell** | **Tauri** (or Electron) desktop app, web-tech UI | True offline, local filesystem access for uploads, cross-platform. Tauri = smaller/faster than Electron; Rust backend is a bonus for parsing perf. |
| **UI** | React + TypeScript | Ecosystem, and it ports directly to a future web SaaS frontend. |
| **Local DB** | **SQLite** (via `better-sqlite3`, or SQLx/rusqlite under Tauri) | Battle-tested, embedded, transactional, SQL you already know, trivial to back up (one file), and there's a clean managed-Postgres upgrade path for SaaS. |
| **Migrations** | A migration tool from day one (e.g. `drizzle`/`knex`, or `sqlx migrate`) | Schema *will* evolve; never hand-edit the DB. |
| **Encryption at rest** | SQLCipher, or OS keychain-managed key + encrypted DB file | Sensitive financial data encrypted even locally (NFR requirement). |

### 3.2 Why SQLite over the alternatives
- **vs. IndexedDB/local browser storage:** SQLite gives real SQL, transactions, and the exact same query model you'll use in Postgres later. IndexedDB would mean rewriting the data layer for SaaS.
- **vs. a document store:** your data is deeply relational (transactions ↔ accounts ↔ documents ↔ categories ↔ issues). Relational is the right fit and the right teacher for the eventual multi-tenant Postgres.
- **vs. starting on cloud Postgres now:** violates offline-first and adds infra you don't need for a single user.

### 3.3 The SaaS upgrade path (Phase 3)
SQLite → **Postgres** is the least-surprising migration in software. Same SQL dialect family, same relational model, `tenant_id` already present. The sync layer becomes a new adapter behind the existing repository interfaces. **No engine code changes.**

> If you'd rather not build a desktop shell, a **local-first PWA with SQLite-WASM + OPFS** is a viable alternative that shares even more code with the future web SaaS — at the cost of trickier filesystem/upload ergonomics today. Recommendation stands with Tauri for MVP simplicity; note this as an open trade.

---

## 4. Data schema (concrete)

SQL-ish sketch. Every table carries `tenant_id`, `created_at`, `updated_at`, and soft-delete (`archived_at`) unless noted. IDs are UUIDs (safe for future distributed/synced world).

```sql
-- Identity (single row today; first-class for multi-tenancy)
tenant (
  id            UUID PK,
  display_name  TEXT,
  created_at    TIMESTAMP
)

account (
  id            UUID PK,
  tenant_id     UUID FK,
  kind          TEXT,        -- 'bank' | 'income_source'
  name          TEXT,        -- e.g. "FNB Cheque", "Employer X"
  institution   TEXT,        -- bank/employer name
  currency      TEXT DEFAULT 'ZAR',
  archived_at   TIMESTAMP NULL
)

-- Every uploaded file. Raw bytes referenced, never lost.
document (
  id            UUID PK,
  tenant_id     UUID FK,
  account_id    UUID FK NULL,
  doc_type      TEXT,        -- 'bank_statement' | 'payslip'
  file_path     TEXT,        -- local path / blob ref
  file_hash     TEXT,        -- dedup at file level
  parser_id     TEXT,        -- which adapter+version parsed it
  parse_status  TEXT,        -- 'ok' | 'partial' | 'failed'
  parse_meta    JSON,        -- confidence, warnings, raw extract
  uploaded_at   TIMESTAMP
)

transaction (
  id                UUID PK,
  tenant_id         UUID FK,
  account_id        UUID FK,
  source_document_id UUID FK,
  source_row        INT,      -- provenance: which line of the file
  txn_date          DATE,
  description_raw   TEXT,
  description_norm  TEXT,      -- normalized for dedup/matching
  amount            DECIMAL,   -- store as integer cents in practice
  direction         TEXT,      -- 'debit' | 'credit'
  balance_after     DECIMAL NULL,
  category_id       UUID FK NULL,
  category_source   TEXT,      -- 'rule' | 'manual' | 'auto' | 'default'
  dedup_group_id    UUID NULL, -- transactions judged "the same"
  reconciled_with   UUID NULL, -- FK to manual_expense
  archived_at       TIMESTAMP NULL
)

payslip (
  id            UUID PK,
  tenant_id     UUID FK,
  account_id    UUID FK,       -- income source
  source_document_id UUID FK,
  period_start  DATE,
  period_end    DATE,
  gross         DECIMAL,
  net           DECIMAL,
  confirmed     BOOLEAN,       -- user reviewed the draft
  archived_at   TIMESTAMP NULL
)

payslip_line (
  id            UUID PK,
  payslip_id    UUID FK,
  line_type     TEXT,          -- 'deduction' | 'contribution' | 'allowance' | 'earning'
  label         TEXT,          -- 'PAYE', 'UIF', 'Medical Aid', 'Pension'
  amount        DECIMAL,
  confidence    REAL           -- flags low-confidence parses
)

manual_expense (
  id            UUID PK,
  tenant_id     UUID FK,
  txn_date      DATE,
  amount        DECIMAL,
  category_id   UUID FK NULL,
  note          TEXT,
  reconciled_with UUID NULL,   -- FK to transaction
  archived_at   TIMESTAMP NULL
)

category (
  id            UUID PK,
  tenant_id     UUID FK,
  name          TEXT,
  parent_id     UUID NULL      -- optional hierarchy
)

category_rule (
  id            UUID PK,
  tenant_id     UUID FK,
  match_type    TEXT,          -- 'contains' | 'regex' | 'merchant'
  pattern       TEXT,
  category_id   UUID FK,
  priority      INT,           -- higher wins
  learned       BOOLEAN        -- created from a user override
)

goal (                         -- Phase 2
  id            UUID PK,
  tenant_id     UUID FK,
  goal_type     TEXT,          -- 'house'|'car'|'vacation'|'emergency'
  target_amount DECIMAL,
  target_date   DATE NULL,
  priority      INT,
  linked_account_id UUID NULL
)

goal_contribution (            -- Phase 2
  id            UUID PK,
  goal_id       UUID FK,
  amount        DECIMAL,
  contributed_at DATE,
  source        TEXT           -- 'manual' | 'auto_detected'
)

issue (
  id            UUID PK,
  tenant_id     UUID FK,
  source        TEXT,          -- 'system' | 'user'
  kind          TEXT,          -- 'parse_fail'|'balance_mismatch'|'possible_dup'|'reconcile_gap'|'bug'
  entity_type   TEXT,          -- links to any record
  entity_id     UUID NULL,
  status        TEXT,          -- 'open' | 'resolved'
  detail        JSON,
  created_at    TIMESTAMP
)

audit_log (                    -- append-only, no soft-delete
  id            UUID PK,
  tenant_id     UUID FK,
  actor         TEXT,          -- 'user' | 'system:<engine>'
  action        TEXT,
  entity_type   TEXT,
  entity_id     UUID,
  before        JSON NULL,
  after         JSON NULL,
  at            TIMESTAMP
)
```

**Money:** store as integer **cents** (`BIGINT`), not `DECIMAL`/float — avoid rounding bugs entirely. The `DECIMAL` above is conceptual; implement as minor units.

**Indexing for dedup & filters:** composite index on `transaction(tenant_id, account_id, txn_date, amount)` and an index on `description_norm`. These back both the dedup matcher (§6) and the date/category filters.

---

## 5. Parser adapter design

Bank and payslip formats vary by institution and **drift without notice**. Parsers are therefore the most volatile part of the system and are isolated behind a stable interface.

```ts
interface StatementParser {
  id: string;                    // "fnb-csv-v2"
  canParse(file: FileMeta): boolean | number;   // 0..1 confidence
  parse(file: FileBytes): ParseResult<RawTransaction>;
}

interface PayslipParser {
  id: string;                    // "sage-payslip-pdf-v1"
  canParse(file: FileMeta): boolean | number;
  parse(file: FileBytes): ParseResult<RawPayslip>;
}

type ParseResult<T> = {
  status: 'ok' | 'partial' | 'failed';
  data: T | null;
  warnings: Warning[];           // feed the Issues section
  confidence: number;            // overall
};
```

**Design rules:**
- **Registry + auto-detect.** A `ParserRegistry` picks the highest-confidence `canParse` adapter. CSV parsers per bank; a generic PDF-table fallback; manual-mapping fallback when all else fails.
- **Versioned IDs** (`fnb-csv-v2`). When a bank changes format, add `-v3` — old documents remember which parser produced them (`document.parser_id`) for reproducibility.
- **Parsers never touch the DB.** They return plain data. The `ImportStatement` use-case runs parse → normalize → dedup → categorize → preview → commit as a single transaction.
- **Never silently fail.** `partial`/`failed` always produces an Issue (F7) linked to the document.
- **CSV first, PDF best-effort.** CSV is deterministic; invest there first (per your open question #2). PDF parsing is a known time-sink — a generic table extractor plus manual correction beats per-bank PDF fragility at MVP.

---

## 6. Deduplication engine

Pure function over candidate transactions + existing ledger. No side effects.

```
For each incoming transaction:
  1. Exact match?  (account, txn_date, amount, description_norm)
        → auto-skip, tag existing dedup_group_id
  2. Near match?   same account & amount,
                   date within ±2 days (pending→posted drift),
                   description similarity ≥ threshold (fuzzy)
        → do NOT auto-merge; raise a 'possible_dup' Issue for review
  3. No match?     → import as new
```

- **File-level shortcut:** `document.file_hash` — re-uploading the identical file short-circuits to "0 new."
- **Normalization** (`description_norm`): lowercase, strip card-auth codes/reference noise, collapse whitespace. Store it so matching is cheap and indexable.
- **Reversibility:** every auto-skip and merge is logged to `audit_log` and undoable — dedup false-positives must never silently eat a real transaction.
- **Idempotency guarantee:** re-running an import produces zero new rows (acceptance criterion F4).

---

## 7. Categorization engine

Pluggable behind one interface so rules today can become ML later with no ledger changes.

```ts
interface Categorizer {
  categorize(txn: NormalizedTransaction, rules: CategoryRule[]): CategoryDecision;
}
```

- **MVP implementation:** rule-based. Ordered by `priority`; first match wins; default → "Uncategorized".
- **Learning loop:** a user override creates/upgrades a `learned` rule (e.g. merchant→category), so the correction sticks and generalizes. Manual overrides always outrank auto.
- **Future:** an `MLCategorizer` implementing the same interface; the app can even run both and only auto-apply high-confidence predictions, routing the rest to review.

The advisor (Phase 2) and goals engine are likewise pure services reading the ledger — no new storage concepts, just computed views over transactions, categories, and payslips.

---

## 8. Offline → SaaS transition plan

What changes, and (more importantly) what doesn't.

| Layer | MVP (offline) | SaaS (Phase 3) | Rewrite? |
|---|---|---|---|
| Engine (parse/dedup/categorize/advisor) | Local | Identical | **No** |
| Repository interfaces (ports) | Local impl | Cloud impl | Interface unchanged |
| Storage | SQLite file | Postgres, per-tenant isolation | New adapter only |
| Sync | none | Sync adapter behind repo ports | New, additive |
| Auth | implicit single user | Real authn/authz layer | New, additive |
| `tenant_id` | present, single value | populated per user | **No schema change** |
| UI | Desktop (Tauri) | + Web SPA (shares React components) | Reuse |

**Sequence when the time comes:** stand up Postgres with the same schema → implement cloud repositories → add auth + tenant resolution → add a sync adapter (local acts as cache/offline buffer) → ship web frontend reusing components. Each step is independent and testable.

**Compliance hooks already in place** (from requirements §8): `audit_log`, soft-delete/archive, full export capability, and encryption-at-rest — so POPIA obligations (access, deletion, breach traceability) are wiring-up, not building-from-scratch.

---

## 9. Cross-cutting concerns

- **Import transactionality:** every import commits atomically. Parse failure → nothing written except an Issue. No half-imported ledgers.
- **Backups:** the whole DB is one file — scheduled local backup + user-triggered export (JSON/CSV) satisfy portability and disaster recovery.
- **Testing strategy:** the pure engine (dedup, categorize, parse-normalize, goal projection) is trivially unit-testable with fixture files — build a corpus of real (anonymized) statement/slip samples as regression fixtures, especially per bank/parser version.
- **Observability (SaaS phase):** structured logs + error tracking, but **never** ship financial data to third-party analytics.
- **Secrets/keys:** DB encryption key in OS keychain, never in the DB or source.

---

## 10. Build order (suggested)

1. **Skeleton:** app shell + SQLite + migrations + schema + `tenant_id` plumbing.
2. **Statement import (CSV):** parser registry → one real bank CSV adapter → import preview → commit. Ledger + provenance.
3. **Dedup engine** with review queue (unlocks safe re-uploads).
4. **Filters & ledger UI** (date range, search, account).
5. **Categorization** (rules + learning) and **trends**.
6. **Payslip ingestion** (CSV/manual first, PDF best-effort) + dynamic breakdown.
7. **Manual expenses + reconciliation.**
8. **Issues section** (wire in the warnings already being generated).
9. *(Phase 2)* Goals → Advisor → SARS guidance.

Each step is shippable and independently useful — you get a trustworthy ledger before you build advice on top of it.

---

## 11. Open technical decisions

1. **Shell:** Tauri desktop (recommended) vs. SQLite-WASM PWA (more SaaS code reuse, trickier file I/O)?
2. **PDF investment:** how much per-bank PDF parsing at MVP vs. CSV-only + manual mapping?
3. **Encryption approach:** SQLCipher whole-DB vs. field-level encryption for sensitive columns?
4. **First bank adapter(s):** which of your actual accounts to target first?
5. **Fuzzy-match threshold** for near-duplicate detection — tune against your real overlapping statements.

---

*Companion to the PRD. The architecture optimizes for one thing: never having to rewrite the engine. Everything volatile — parsers, storage, sync, UI — sits behind a stable interface so it can be swapped as the product grows from your single offline app into a compliant SaaS.*
