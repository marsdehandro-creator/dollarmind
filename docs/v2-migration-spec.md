# DollarMind — V2 Migration Spec: Cloud Sync & Scale-Out

**Status:** Draft v1 (forward-looking — not scheduled)
**Owner:** Dehandro
**Audience:** Engineering reference for when V1 offline is live and a cloud transition is greenlit
**Companion to:** [v1-offline-product-spec.md](v1-offline-product-spec.md), [architecture.md](architecture.md), [data-model.md](data-model.md), [security.md](security.md)

---

## 1. Purpose and scope

This document specifies how DollarMind moves from **V1 (offline, on-device only)** to **V2 (hosted, multi-device, scaled to many users)** without a rewrite. It assumes V1 shipped per [v1-offline-product-spec.md](v1-offline-product-spec.md) and the on-device repository implementations described there are in production.

The core claim this spec depends on: **the existing backend (Phases 6–18) is not legacy to be replaced — it is the V2 sync target.** Auth, sessions, ingestion, categorization, dashboard aggregation, goals, and settings already exist as a tested Express service. V2 work is *sync + scale infrastructure around that service*, not a reimplementation of it.

---

## 2. Core migration principle

> **Repository interfaces stay fixed. Only the implementation behind them swaps.**

This is the same port/adapter boundary `architecture.md` establishes (`backend/src/repositories/*Repository.ts` interfaces, e.g. `SalarySlipRepository`, `TransactionRepository`, `GoalRepository`). Three configurations of the same interfaces exist across the product's life:

| Stage | Interface implementation | Where logic runs |
|---|---|---|
| **Pre-V1 (as originally built)** | `Sqlite*Repository` against `node:sqlite` | Server |
| **V1 (offline)** | `Local*Repository` against on-device SQLite (`@capacitor-community/sqlite` on Android, IndexedDB/`wa-sqlite` on web) | Device |
| **V2 (online)** | `Remote*Repository` against `apiClient.ts`-style `fetch` calls | Device ↔ existing Express backend |

Because V1 and pre-V1 both implement the *same* interface shapes, the existing Express backend, controllers, and services from Phases 6–18 remain valid as the V2 remote target with minimal change. V2 engineering work is: (a) add sync endpoints, (b) reintroduce the remote repository implementations on the client, (c) add a sync/reconciliation layer between local and remote. It is explicitly **not**: rewriting `services/*`, redesigning the schema, or re-doing ingestion/categorization.

---

## 3. Data model readiness already in place

No schema redesign is required for sync. The existing model (`db/schema.sql`, `db/migrations/*`) already carries the fields sync needs:

- **UUID primary keys** — device-generated IDs merge across devices without collision (no auto-increment ID clashes to resolve).
- **`tenant_id` on every row** — currently pinned to `DEFAULT_TENANT_ID` (single-tenant pilot). V2 promotes this to one real `tenant_id` per signed-up account; every existing query is already tenant-scoped, so this is a value change, not a query rewrite.
- **`updated_at` / `archived_at` (soft delete) on every row** — enables timestamp-based delta sync and last-write-wins reconciliation without new columns.
- **`dedup_hash` / `dedup_group_id` on transactions** — already designed for merge-safe re-ingestion (Phase 8); directly reusable for resolving duplicate transactions arriving from two devices instead of two re-uploaded statements.
- **`categorySource` / `confidence` / `flagged` on transactions** — the existing categorization-provenance fields double as sync conflict signals (a low-confidence local categorization shouldn't silently overwrite a high-confidence remote one).

---

## 4. Sync strategy

**New local table required:** a `sync_queue` (or equivalent outbox) recording `{table, row_id, op, updated_at, synced}` for every local write since the last successful sync. This is the one genuinely new piece of local storage V2 needs.

**Sync flow:**

1. **First login (local → cloud bootstrap).** On account creation/login from a device with existing local data, bulk-upload the local dataset via a resumable batch endpoint (thin wrapper over the existing `services/*.create()` calls — no new business logic, just batching).
2. **Steady state (delta sync).** Push rows changed since the last synced watermark; pull rows changed remotely since the same watermark, per table, using `updated_at`.
3. **Conflict resolution.** Default: **last-write-wins by `updated_at`.** True conflicts (the same row edited on two devices between syncs) are not silently overwritten — they're written into the existing `IssueRepository` / issue-flagging mechanism (Phase 15) for user review, reusing infrastructure that already exists rather than inventing a new conflict-review UI from scratch.
4. **Offline-while-synced.** Once an account is linked, the device keeps working offline exactly as in V1 (local read/write always available); writes simply queue in `sync_queue` until connectivity returns. V1's offline behavior is not lost by adopting sync — it becomes the fallback mode.

---

## 5. Auth migration

- **V1:** local PIN, no server identity, no `tenant_id` beyond the shared default.
- **V2:** reintroduce the JWT + refresh-token rotation + `UserSession` model already built in Phase 11 (`LocalAuthService`, `LocalSecurityService`, `sessions` routes) as the real account layer. This code exists and is tested — V2 activates it, it doesn't build it.
- **Linking flow:** user creates/logs into a DollarMind account → local DB's rows are re-tagged from `DEFAULT_TENANT_ID` to the new real `tenant_id` → one-time bulk sync (§4.1) runs → device transitions to dual-write (local cache + remote source of truth).
- **Additional devices:** log into the same account, pull the full remote dataset into a fresh local store, then behave identically to the originating device.

---

## 6. Backend readiness inventory

**Already built and reusable as-is** (Phases 6–18, all currently passing their test suites):
Auth, sessions/refresh rotation, salary-slip ingestion (PDF/OCR/TXT), bank-statement ingestion + deduplication, merchant-based categorization engine (rules + adaptive learning + confidence + flagging), manual expense/cash tracking, goals, dashboard aggregation (time-range-driven, resilient), user settings, business-error mapping, audit logging, all 10 schema migrations.

**Net-new for V2:**
- Sync endpoints (delta pull/push, bulk bootstrap, watermark tracking).
- Device registration (so a `UserSession` can represent "this phone" vs. "that browser").
- Conflict surfacing into the sync layer (routing genuine conflicts into `IssueRepository` rather than resolving them client-side).
- Promoting `DEFAULT_TENANT_ID` to real per-signup tenancy (a value/config change to `config/index.ts`'s tenant resolution, not a schema change).
- Production infrastructure: hosting, database-at-scale decision (§7), backups, monitoring, CORS, rate limiting.
- Subscription/billing layer, if the product requires one at this stage.
- Admin/ops tooling (currently none exists — appropriately, since there's no hosted deployment yet).

---

## 7. Infrastructure decisions to make at V2 kickoff

These are flagged as open decisions, deliberately not resolved here — they're cost- and scale-dependent and should be made when V2 is actually greenlit, not speculatively now:

- **Database engine.** `node:sqlite` is fine for a pilot; at real scale, Postgres (or a hosted-SQLite service like Turso/LiteFS) is the likely target. Because storage sits behind repository interfaces, this is a contained adapter swap, not an application rewrite.
- **Hosting target.** A managed Node host with persistent storage/managed DB (Render, Railway, Fly, AWS, etc.) — deferred, cost-dependent.
- **Uploaded-document storage.** Move from local disk (`backend/uploads/`) to object storage (S3-compatible) so the backend can scale horizontally without a shared filesystem.
- **Observability.** Structured logging + error tracking becomes necessary once the team can no longer see a user's local device state directly.

---

## 8. Security hardening required before opening to a larger user base

- Password hashing (`bcryptjs`) already in place — verify the work factor is set for production, not development, before launch.
- Rate limiting / brute-force protection on auth endpoints — **net-new**.
- Encryption at rest for the cloud database and uploaded documents — **net-new**.
- CORS restricted to known origins (the native app's webview origin + the hosted web app) — **net-new, small**.
- Audit logging (`AuditRepository` / `LocalAuditService`) already exists — extend its coverage to sync events specifically (who synced what, from which device, when).

Full detail lives in [security.md](security.md); this section only calls out what changes when moving from single-tenant-pilot to multi-tenant-hosted.

---

## 9. Migration rollout sequence (safe, reversible)

1. **Dark-launch.** Ship V2 backend sync endpoints behind a feature flag; no user-facing change yet.
2. **Opt-in beta.** Offer a small subset of V1 users "Create an account to sync across devices" — strictly additive, V1 offline mode keeps working for everyone who declines.
3. **Shadow validation.** Run bulk-upload + dual-write with the local device treated as source of truth; compare cloud state against local state without cutting reads over yet.
4. **Cut over reads.** Once parity is confirmed per user, the device starts reading from the synced cloud copy (with local cache as offline fallback).
5. **General availability.** V1 offline-only mode remains a supported, permanent option for privacy-preferring users — not just a migration stepping stone. (This is a product decision to confirm at V2 kickoff, not an engineering default.)

---

## 10. Non-negotiable regression gate

- Every existing backend test (79+ at last count) and every new sync-specific test must pass before any rollout step in §9 proceeds.
- **Offline must keep working.** Linking a device to a cloud account must never make the app *require* connectivity — local read/write stays available at every stage, with sync as an enhancement layered on top, not a replacement.
