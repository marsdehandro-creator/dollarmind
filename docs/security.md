# DollarMind — Security & Authentication Design

**Status:** Draft v1
**Owner:** Dehandro
**Last updated:** 2026-07-17
**Companion to:** [requirements.md](requirements.md), [architecture.md](architecture.md)

---

## 1. Security posture & principles

This app handles some of the most sensitive personal data there is — bank transactions, salary, tax context. Security is a product feature, not an afterthought, and it's a differentiator (see PRD §8.2, "your data stays yours").

Guiding principles:

1. **Least privilege, always.** Every actor (user, role, service) gets the minimum access needed. Default deny.
2. **Defense in depth.** No single control is trusted alone — hashing *and* rate limiting *and* audit logs *and* encryption.
3. **Secure by default, offline or cloud.** The pilot is encrypted and authenticated even though it's single-user, so nothing has to be retrofitted for SaaS.
4. **Auth logic behind a stable interface.** Like storage and parsers (architecture §2), authentication sits behind a port so the pilot's local implementation and the SaaS implementation are swappable, not a rewrite.
5. **Compliance is built-in, not bolted-on.** Data minimization, consent, access/delete, and audit logging are wired into the data model from day one.

---

## 2. Auth model

### 2.1 The evolution strategy (the key idea)

Everything in this document is arranged so the pilot and the SaaS share **the same entities and the same interface** — the SaaS phase *populates* fields and *adds implementations*, it does not restructure.

```
              ┌────────────────────────────────────────┐
   UI / API   │   AuthService (interface / port)        │
   ──────────▶│   authenticate() issueSession()          │
              │   verifyMfa() authorize(action)          │
              └───────────────┬────────────────────────┘
                              │
          ┌───────────────────┼─────────────────────────┐
          │                                             │
 ┌────────▼─────────┐                        ┌──────────▼──────────┐
 │ LocalAuthProvider │   (pilot)              │  SaaSAuthProvider    │  (Phase 3)
 │ • local password  │                        │ • email/password     │
 │ • local session   │                        │ • MFA (TOTP/WebAuthn)│
 │ • single tenant   │                        │ • OAuth2/OIDC        │
 └───────────────────┘                        │ • RBAC, multi-tenant │
                                              └─────────────────────┘
```

The **same schema** underpins both. The pilot simply has one `tenant`, one `user`, one role, and unused columns (MFA, OAuth) sitting dormant.

### 2.2 Core entities

Building on the schema in [architecture.md](architecture.md) §4 (every row already carries `tenant_id`):

```sql
tenant (
  id            UUID PK,
  display_name  TEXT,
  status        TEXT,          -- 'active' | 'suspended'
  created_at    TIMESTAMP
)

user (
  id                 UUID PK,
  tenant_id          UUID FK,
  email              TEXT,               -- unique per tenant; the login id
  email_verified_at  TIMESTAMP NULL,
  password_hash      TEXT NULL,          -- Argon2id; NULL if OAuth-only
  password_algo      TEXT,               -- 'argon2id' — enables seamless rehash/upgrade
  status             TEXT,               -- 'active'|'locked'|'disabled'
  failed_login_count INT DEFAULT 0,
  locked_until       TIMESTAMP NULL,
  mfa_enabled        BOOLEAN DEFAULT false,
  last_login_at      TIMESTAMP NULL,
  created_at         TIMESTAMP,
  archived_at        TIMESTAMP NULL      -- soft-delete
)

-- Roles: RBAC. Pilot seeds exactly one ('user'/owner).
role (
  id     UUID PK,
  name   TEXT              -- 'user' | 'admin' | 'support'
)

user_role (
  user_id  UUID FK,
  role_id  UUID FK,
  tenant_id UUID FK,       -- role is scoped to a tenant
  PRIMARY KEY (user_id, role_id, tenant_id)
)

-- Sessions: server-side session records (see §2.4 on why).
session (
  id            UUID PK,          -- opaque session id (the cookie value is a hash of this)
  user_id       UUID FK,
  tenant_id     UUID FK,
  created_at    TIMESTAMP,
  last_seen_at  TIMESTAMP,
  expires_at    TIMESTAMP,
  revoked_at    TIMESTAMP NULL,
  ip            TEXT NULL,        -- SaaS only; minimized/omitted in pilot
  user_agent    TEXT NULL,        -- SaaS only
  mfa_satisfied BOOLEAN DEFAULT false
)

-- MFA factors (dormant in pilot, active in SaaS)
mfa_factor (
  id            UUID PK,
  user_id       UUID FK,
  type          TEXT,             -- 'totp' | 'webauthn' | 'recovery_code'
  secret_enc    TEXT,             -- encrypted TOTP secret / credential
  confirmed_at  TIMESTAMP NULL,
  created_at    TIMESTAMP
)

-- Federated identities (SaaS)
oauth_identity (
  id            UUID PK,
  user_id       UUID FK,
  provider      TEXT,             -- 'google' | 'microsoft' | 'apple' ...
  subject       TEXT,             -- provider's stable user id (sub)
  created_at    TIMESTAMP,
  UNIQUE (provider, subject)
)

-- Consent records (compliance §6)
consent (
  id            UUID PK,
  tenant_id     UUID FK,
  user_id       UUID FK,
  purpose       TEXT,             -- 'processing' | 'marketing' | ...
  policy_version TEXT,
  granted       BOOLEAN,
  at            TIMESTAMP
)

-- Reused from architecture.md §4 — append-only
audit_log ( ... )                 -- see §5
```

**Permissions model:** roles map to permissions in code (not necessarily a DB table at pilot). Keep a single source of truth:

| Role | Capabilities |
|---|---|
| **user** | Full CRUD over *their own tenant's* financial data. The pilot's only role. |
| **admin** | Tenant/user lifecycle, billing, system config. **No default read access to tenant financial data** (see §2.6). |
| **support** | Read-only, scoped, time-boxed access to *operational* metadata to help a user — **not** their raw financial data without explicit, logged, consented elevation. |

### 2.3 Password handling

- **Algorithm: Argon2id** (preferred) — memory-hard, resistant to GPU cracking. bcrypt (cost ≥ 12) is an acceptable fallback if Argon2 tooling is unavailable in your stack.
- **Parameters (tune to hardware, OWASP baseline):** Argon2id with memory ≥ 19 MiB, iterations ≥ 2, parallelism 1 — benchmark to ~250–500ms per hash on target hardware.
- **`password_algo` column** records the algorithm/params so you can **transparently rehash on next login** when you raise parameters — no forced reset.
- **Never** log, store, or transmit the plaintext password. Hash server-side (or in the local backend for the pilot); never in the browser.
- **Peppering (SaaS):** consider an application-level secret ("pepper") stored outside the DB (KMS/secret manager) in addition to the per-hash salt.

### 2.4 Session vs. JWT — the decision

| | Server-side sessions | Stateless JWT |
|---|---|---|
| Revocation | Immediate (delete the row) | Hard (tokens valid until expiry) |
| Statefulness | Needs a session store | None |
| Fit for finance app | **Strong — instant logout/kill** | Weaker for sensitive data |

**Recommendation: server-side sessions with an opaque cookie**, for both pilot and SaaS.

- Financial apps need **instant revocation** (lost device, suspicious activity, "log out everywhere"). Stateless JWTs can't do that cleanly.
- Cookie is opaque (a random session id); the DB `session` row is the source of truth.
- **Cookie flags:** `HttpOnly` (no JS access → blunts XSS token theft), `Secure` (HTTPS only, SaaS), `SameSite=Lax` (or `Strict` for the sensitive session; CSRF defense — see §4).
- **If you later need JWTs** for service-to-service or mobile, use **short-lived access tokens (5–15 min) + a revocable refresh token** backed by the `session` table — keep the revocation anchor server-side.

> Pilot note: even a local desktop app benefits from this model — a session gates access to the decrypted DB, and "lock the app" = revoke session + drop the in-memory key.

### 2.5 Authentication flows

**Registration (SaaS)**
1. Email + password submitted over TLS.
2. Validate password against policy (§2.7); reject weak/breached.
3. Hash with Argon2id; create `user` (`status='active'`, `email_verified_at=NULL`).
4. Send verification email (signed, single-use, expiring token).
5. Record `consent` for processing + policy version.
6. Audit: `user.registered`.

**Login**
1. Look up user by (tenant, email). Always run a dummy hash if not found → **constant-time**, no user enumeration.
2. Verify password. On failure: increment `failed_login_count`, apply **rate limiting + exponential backoff**; lock after N attempts (`locked_until`).
3. On success and `mfa_enabled` → issue a **pending** session (`mfa_satisfied=false`), prompt for MFA.
4. Verify MFA (TOTP/WebAuthn) → mark `mfa_satisfied=true`.
5. Issue session cookie; reset failed counters; set `last_login_at`.
6. Audit: `auth.login.success` / `auth.login.failure` / `auth.mfa.challenge`.

**MFA enrollment**
1. Generate TOTP secret (or WebAuthn credential); store **encrypted** (`mfa_factor.secret_enc`).
2. User confirms with a valid code → `confirmed_at` set, `mfa_enabled=true`.
3. Issue **recovery codes** (hashed like passwords), shown once.
4. Audit: `mfa.enrolled`.

**OAuth2/OIDC (SaaS)**
1. Authorization Code flow **with PKCE**. Never implicit flow.
2. Validate `state` (CSRF for the OAuth handshake) and `nonce`.
3. On callback, verify ID token signature/issuer/audience; extract `sub`.
4. Link or create `oauth_identity`; provision/attach `user`.
5. Enforce tenant mapping (enterprise SSO → specific tenant).
6. Audit: `auth.oauth.login`.

**Password reset**
1. Request by email → always respond identically (no enumeration).
2. Signed, single-use, short-expiry token emailed.
3. On reset: validate token, apply password policy, rehash, **revoke all existing sessions**.
4. Audit: `auth.password.reset`.

**Logout / session kill**
- Logout revokes the current session. "Log out everywhere" revokes all sessions for the user. Immediate because sessions are server-side.

### 2.6 RBAC & tenant isolation

- **Every data query is tenant-scoped.** No query touches a table without a `tenant_id` filter derived from the authenticated session — never from user input. This is the single most important control against cross-tenant leakage.
- **Enforce at the data layer, not just the UI.** Repository/DAO methods take the authenticated tenant context; there is no "get by id" that ignores tenant. Consider **Postgres Row-Level Security (RLS)** in the SaaS phase as a belt-and-suspenders backstop so even a buggy query can't cross tenants.
- **Authorization checks are centralized** (`authorize(actor, action, resource)`), not scattered `if role == admin` checks.
- **Admin ≠ data access.** Admins manage accounts; they do **not** get a free pass to read financial data. Support access to any user data is **explicit, consented, time-boxed, and audited** (break-glass, not standing access) — critical for POPIA/GDPR trust.

### 2.7 Password & account policy

- Minimum length ≥ 12; encourage passphrases; allow full Unicode; **no forced composition rules or forced periodic rotation** (aligns with NIST 800-63B — those harm security).
- **Screen against known-breached passwords** (e.g. a k-anonymity range check against a breach corpus — never send the full password/hash).
- Account lockout with backoff after repeated failures; notify user of new-device logins (SaaS).
- MFA strongly encouraged; **required** for `admin`/`support` roles.

---

## 3. Threat model overview

Scope differs by phase — the pilot's attack surface is mostly local (device compromise, malicious file uploads), while the SaaS surface adds the network, multi-tenancy, and account takeover. Using a STRIDE lens:

| Threat (STRIDE) | Example | Primary mitigations |
|---|---|---|
| **Spoofing** | Credential stuffing, session hijack | Argon2id, MFA, rate limiting, constant-time login, HttpOnly/Secure cookies |
| **Tampering** | Modifying transactions/roles, request tampering | Server-side authz, tenant scoping, audit log, input validation |
| **Repudiation** | "I didn't delete that" | Append-only audit log (§5), signed/immutable trail |
| **Information disclosure** | Cross-tenant leak, data at rest theft | Tenant scoping + RLS, encryption at rest, least privilege, data minimization |
| **Denial of service** | Upload bombs, login flooding | Rate limits, upload size/type caps, resource quotas |
| **Elevation of privilege** | user→admin, IDOR | Centralized RBAC, deny-by-default, no client-trusted roles, object-level authz |

---

## 4. Specific vulnerabilities & mitigations

### 4.1 SQL injection
- **Parameterized queries / prepared statements only.** No string-concatenated SQL, ever. Use the query builder/ORM's binding.
- Validate and type-coerce all inputs at the boundary.
- DB account runs with least privilege (app can't `DROP`/alter schema at runtime in SaaS).

### 4.2 Cross-site scripting (XSS)
- **Output-encode by default** — rely on the UI framework's auto-escaping (React escapes by default); never `dangerouslySetInnerHTML` with user/statement-derived content (merchant descriptions are attacker-influenced!).
- **Content Security Policy (CSP):** strict, no inline scripts, nonce-based. Blocks injected script execution even if something slips through.
- Session cookie is **HttpOnly** so a successful XSS still can't read the session token.
- Sanitize any rendered rich content; treat *all* parsed statement/payslip text as untrusted.

### 4.3 Cross-site request forgery (CSRF)
- `SameSite=Lax`/`Strict` cookies as the first line.
- **Anti-CSRF tokens** (synchronizer or double-submit) on all state-changing requests in the SaaS web app.
- Prefer a **custom header requirement** for API calls (browsers won't send it cross-origin without CORS approval).
- OAuth handshake protected by `state` parameter.

### 4.4 File upload abuse (high-priority — this app is upload-centric)
Statements/payslips are the core input **and** the biggest attack surface.
- **Validate type by content, not extension** (magic-byte/MIME sniffing). Accept only PDF/CSV/known image types.
- **Hard size limits** and row/record caps → defends against zip/CSV bombs and memory exhaustion.
- **Never execute or trust file contents.** Parse in a sandboxed/least-privilege context; PDF/CSV parsers are historically buggy — isolate them (separate process; resource-limited).
- **CSV injection / formula injection:** a cell like `=CMD()` can attack spreadsheet software on *export*. Neutralize on export by prefixing risky leading chars (`=,+,-,@`) — and never `eval` cell contents on import.
- **Store outside the web root** (SaaS); reference by opaque id; serve via authorized, tenant-scoped endpoints only — never a guessable path.
- **Malware scanning** on uploads in the SaaS phase.
- Strip/ignore embedded active content in PDFs (JavaScript in PDFs is a thing).
- Every parse failure → an Issue (F7), not a silent crash.

### 4.5 Authentication & session attacks
- Credential stuffing / brute force → rate limiting, lockout, MFA, breached-password screening.
- Session fixation → **rotate session id on privilege change** (login, MFA completion).
- Session theft → HttpOnly/Secure/SameSite, short idle timeouts, re-auth for sensitive actions (export, delete, changing security settings).
- User enumeration → identical responses/timing on login, reset, and registration.

### 4.6 Insecure Direct Object Reference (IDOR) / broken object-level authz
- **Every object fetch checks ownership/tenant** — `getTransaction(id)` must verify the row's `tenant_id` matches the session's. This is the #1 real-world SaaS data-leak bug; enforce it in the repository layer, not the controller.
- Use UUIDs (non-enumerable) but **never** rely on unguessability as the control.

### 4.7 Transport & storage
- **TLS everywhere** in SaaS (HSTS). No sensitive data in URLs/query strings (PRD privacy rule).
- **Encryption at rest:** DB encrypted (SQLCipher locally; managed encryption + per-tenant considerations in cloud). MFA secrets and tokens encrypted with a key from a secret manager/keychain, never in the DB in plaintext.
- Secrets (keys, OAuth client secrets, pepper) in a secrets manager / OS keychain — never in source or the DB.

### 4.8 Dependency & supply chain
- Pin dependencies; automated vulnerability scanning (SCA) in CI.
- Minimize dependencies in the parsing path (largest untrusted-input surface).
- Verify integrity of third-party auth/crypto libraries; never roll your own crypto.

### 4.9 Rate limiting & abuse (SaaS)
- Per-IP and per-account limits on login, reset, MFA, and upload endpoints.
- Global quotas to contain abuse and cost.

---

## 5. Audit logging of sensitive actions

### 5.1 Design
- **Append-only.** The `audit_log` table (architecture §4) is never updated or soft-deleted. In SaaS, ship to a **write-once/tamper-evident** store (append-only stream, or hash-chained entries so tampering is detectable).
- **Separation of duties:** the app writes audit entries but cannot rewrite them; admins who manage the app should not be able to silently alter the trail.

### 5.2 What to log (the sensitive-action set)
Authentication & account:
- login success/failure, logout, session revocation
- password change/reset, MFA enroll/disable/challenge
- role/permission changes, account lock/unlock, user create/disable/delete

Data access & change (the compliance-critical ones):
- **export** of financial data (who, what scope, when)
- **deletion / erasure** requests and executions
- support/admin access to a user's data (**break-glass**), with the justification
- bulk reads or unusual access patterns
- consent grant/withdrawal
- changes to security settings

Each entry: `actor` (user/system, with role), `action`, `entity_type` + `entity_id`, `tenant_id`, `before`/`after` (or a diff — **minimized**, never dumping raw financial detail into logs), timestamp, and request context (SaaS: IP/user-agent, minimized per policy).

### 5.3 What NOT to log
- Never log plaintext passwords, full card/account numbers, MFA secrets, session tokens, or full transaction contents. **Data minimization applies to logs too** — logs are a breach target.

### 5.4 Use
- **User-facing:** feed the security-relevant subset into a user "account activity" view (new logins, exports, security changes) — transparency builds trust and helps users spot compromise.
- **Compliance:** the audit log is the evidence base for POPIA/GDPR access requests and breach investigations.
- **Ops:** alert on anomalies (impossible-travel logins, mass export, repeated failures).

---

## 6. Compliance mechanisms (POPIA / GDPR mindset)

Built into the data model, not bolted on later.

| Requirement | How it's implemented |
|---|---|
| **Data minimization** | Collect only what a feature needs. Pilot omits IP/UA/marketing data entirely. No third-party analytics on financial data. Logs carry references, not raw financial content. |
| **Consent** | `consent` table records purpose + policy version + timestamp; separate consent for processing vs. marketing; withdrawable, and withdrawal is audited. |
| **Right to access** | Full **data export** (JSON/CSV) is a first-class feature (PRD portability NFR) — a user can retrieve everything held about them. |
| **Right to deletion / erasure** | Soft-delete (`archived_at`) for normal use + a **hard-erasure workflow** for genuine deletion requests — confirmed, audited, and mindful of the "don't destroy financial records unintentionally" nuance (offer archive vs. permanent, with confirmation). Retain only what law requires; document retention periods. |
| **Purpose limitation** | Data used only for the stated financial-management purpose; never sold or shared (PRD §8.3). |
| **Audit / accountability** | Append-only audit log (§5) evidences lawful processing and access. |
| **Breach readiness** | Audit trail + access logs enable detection, scope assessment, and the notification obligations POPIA/GDPR impose. |
| **Data residency (SaaS)** | Consider SA/region data residency for POPIA; keep storage region configurable. |

> **Legal note:** these are engineering mechanisms that *support* compliance. Actual POPIA/GDPR compliance also needs a privacy policy, a lawful basis, possibly an Information Officer (POPIA) / DPO, and legal review before public launch — see PRD §8.1. This document does not constitute legal advice.

---

## 7. Pilot → SaaS evolution (no rewrite)

The core promise: the pilot and SaaS share **one schema and one `AuthService` interface**. Growth is *filling in* and *adding providers*, never restructuring.

| Capability | Pilot | SaaS | What changes |
|---|---|---|---|
| **Interface** | `AuthService` port | Same port | Nothing |
| **Provider** | `LocalAuthProvider` | `SaaSAuthProvider` | New implementation behind the port |
| **Password hashing** | Argon2id | Argon2id | Nothing (`password_algo` enables param upgrades) |
| **Sessions** | Local server-side session | Same model + IP/UA/device | Populate dormant columns |
| **Tenancy** | One `tenant`, one `user` | Many tenants/users | Data only — `tenant_id` already everywhere |
| **RBAC** | Single `user` role seeded | user/admin/support + permissions | Seed more roles; enable central authz (already present) |
| **MFA** | Schema present, dormant | TOTP/WebAuthn active | Turn on; tables already exist |
| **OAuth/OIDC** | `oauth_identity` dormant | Google/Microsoft/Apple + enterprise SSO | Add provider integrations |
| **Tenant isolation** | Trivial (single tenant) | Repo-layer scoping + Postgres RLS | Add RLS backstop; scoping already enforced |
| **Transport** | Local (TLS if networked) | TLS/HSTS everywhere | Infra config |
| **Encryption at rest** | SQLCipher (local key) | Managed + secret manager | Swap key source |
| **Audit log** | Local append-only table | Tamper-evident/hash-chained store | Add integrity/streaming; schema unchanged |
| **Consent/erasure** | Present, minimal | Full workflows + policy versioning | Extend flows; tables already exist |

**Why nothing breaks:**
1. `tenant_id` on every row from day one → multi-tenancy is data, not migration.
2. Auth behind a port → local vs. cloud provider is a swap.
3. Server-side sessions → the revocation model is identical at both scales.
4. Dormant columns/tables (MFA, OAuth, consent, session context) → SaaS activates, never adds structural change.
5. Compliance hooks (audit, consent, export, erasure) exist from the start → POPIA/GDPR is wiring-up, not building-from-scratch.

---

## 8. Security build order (suggested)

Aligns with the build order in [architecture.md](architecture.md) §10:

1. **Foundations:** encrypted DB (SQLCipher), Argon2id hashing, `user`/`session`/`tenant` tables with `tenant_id` plumbing, parameterized-query discipline enforced in the data layer.
2. **Pilot auth:** local login, server-side session, app-lock, session revocation. Audit log wired for auth + export/delete.
3. **Upload hardening:** content-type validation, size/row caps, sandboxed parsing, CSV-injection neutralization — before ingesting real statements.
4. **Authorization layer:** centralized `authorize()`, repository-level tenant scoping (even with one tenant) so IDOR is structurally impossible.
5. **Compliance basics:** export, archive-vs-erase, consent record.
6. *(SaaS)* MFA → OAuth/OIDC → full RBAC roles → RLS backstop → rate limiting → tamper-evident audit → breach monitoring.

---

## 9. Open security decisions

1. **Encryption granularity:** whole-DB (SQLCipher) vs. additional field-level encryption for the most sensitive columns (salary, account numbers)?
2. **MFA first factor for SaaS:** TOTP (simple, ubiquitous) first, WebAuthn/passkeys later — or invest in passkeys up front?
3. **Session store for SaaS:** DB-backed vs. Redis (revocation + performance trade-off)?
4. **Audit integrity:** hash-chained entries vs. an external append-only log service — how much tamper-evidence is warranted at launch?
5. **Data residency:** commit to SA-region storage for POPIA from day one of SaaS?
6. **Break-glass support access:** exact workflow for consented, time-boxed, audited support access to user data.

---

*Companion to the PRD and architecture docs. The throughline: authenticate and encrypt from the first line of the pilot, keep auth behind a stable interface, put `tenant_id` and compliance hooks everywhere now — so the single-user offline app grows into a compliant multi-tenant SaaS by addition, never by rewrite.*
