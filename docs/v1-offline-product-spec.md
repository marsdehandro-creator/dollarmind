# DollarMind — V1 Product Spec: Offline-First Release

**Status:** Draft v1
**Owner:** Dehandro
**Audience:** Executive review
**Companion to:** [architecture.md](architecture.md), [requirements.md](requirements.md), [v2-migration-spec.md](v2-migration-spec.md)

---

## The pitch, in one line

**DollarMind V1 is a finance app that works entirely on the user's own device — no servers, no accounts, no hosting bill, and no internet connection required after install.** Everything the app already does — reading payslips, reading bank statements, categorizing spending, showing a dashboard, tracking goals — keeps working. It just happens on the phone or in the browser instead of on a server we have to run.

This is not a step backward. It's a return to the original design brief: `architecture.md` was written to keep local (offline) and cloud (synced) as two configurations of the same engine, not two different products. V1 collects on that promise. V2 (a separate spec, see below) is what turns the sync back on when we're ready to scale.

---

## Why this, why now

Right now, DollarMind's backend and frontend are both built and tested — but they only run when someone is hosting the backend on a server. Before we get a single real user, that means committing to infrastructure spend, uptime, backups, and security operations for a product that hasn't yet proven anyone wants it.

Going offline-first for V1 removes that dependency entirely:

- **We can ship today.** A finished app is a link and an install file — no deployment, no ops rotation, no server to keep alive.
- **Zero hosting cost** until there's a reason to spend it.
- **The strongest privacy story available.** A user's payslip and bank data never leave their device. For a finance app, that's a genuine selling point, not just a technical compromise.

---

## What this feels like for a user

- **Install and go.** On Android, install the app like any other. On the web, open a link — it behaves like an installed app and keeps working after the tab is closed.
- **No account, no password.** Instead of creating a login, the user sets a simple on-device PIN or passcode to keep the app locked when they're not using it.
- **No internet required.** Once installed, uploading a payslip, reading a bank statement, and checking the dashboard all work with the phone in airplane mode.
- **Their data stays theirs.** It lives in a private, on-device database. Nothing is transmitted anywhere.

---

## What ships in V1

Everything already built and tested carries forward — it's being relocated, not rebuilt:

| Capability | What the user experiences |
|---|---|
| **Document upload** | Upload a payslip or bank statement (PDF, scanned photo, or CSV) and have it read automatically. |
| **On-device text reading (OCR)** | Scanned/photographed documents are read directly on the phone — no server round-trip. |
| **Smart categorization** | Spending is automatically sorted into categories (groceries, transport, etc.), and the app learns from corrections the user makes. |
| **Duplicate protection** | The same transaction is never counted twice, even if a statement is uploaded again. |
| **Dashboard** | Income vs. expenses, savings rate, spend-by-category, and cash flow over any date range the user picks. |
| **Manual entries** | Cash spending and manual expenses the user logs themselves. |
| **Goals** | Savings goals with visual progress tracking. |
| **Branding & polish** | Full DollarMind visual identity, dark/light theme, and a layout that adapts from phone to desktop. |
| **Backup, on the user's terms** | A manual export/import of their data, so they can move it to a new phone or keep a copy somewhere safe. *(New for V1 — see Risks below.)* |

---

## What's intentionally deferred to V2

Being direct about the trade-off matters more than glossing over it. Deferring these is a deliberate sequencing choice, not a limitation we discovered too late:

| Deferred | What it means in V1 | Why it's safe to defer |
|---|---|---|
| **Multi-device sync** | Data lives on one device only — a phone and a laptop won't share a dashboard. | No users yet to sync between; single-device is a complete, useful product on its own. |
| **Cloud backup** | If a phone is lost, stolen, or reset without the user exporting first, that data is gone. | Mitigated by the built-in export feature — the risk is real but bounded, not unmanaged (see Risks below). |
| **Account recovery** | A local PIN has no "forgot password" flow. | There's no account to recover — the trade-off comes bundled with going account-less. |
| **Sharing / advisor access** | One person, one device, one dataset. | Not needed to validate the core product. |
| **Remotely updating the rules** | Changing how spending gets categorized requires a new app version, not a config push. | Rules changes are infrequent enough today to ship with normal app updates. |
| **Notifications/reminders** | No push reminders about spending or goals. | Requires a server to deliver them; not core to proving the product. |

---

## Risks and how we're covering them

| Risk | Mitigation |
|---|---|
| **Device loss = data loss.** No server means no automatic backup. | Ship export/import as a first-class V1 feature, not an afterthought — prompt users periodically, and make it a one-tap action. |
| **Browsers can clear site storage under pressure.** The web version's data isn't guaranteed forever if a user never installs it. | Encourage installing the web app (installed PWAs get storage protection browsers don't give ordinary tabs); same export/import safety net applies. |
| **On-device processing is slower than a server.** Reading a scanned statement takes real phone CPU time. | Show clear progress indicators; test against real mid-range Android devices, not just high-end ones, before launch. |
| **Weaker lock than a real login.** A PIN is not bank-grade authentication. | Set expectations correctly: V1's security promise is *privacy* (data never leaves the device), not *account security*. V2 adds real authentication when there's an account to protect. |

---

## What doesn't change under the hood

The parsing, deduplication, categorization, and dashboard logic — the actual "brain" of DollarMind — isn't being rewritten. It's pure logic that already sits behind clean interfaces (a deliberate choice made in the original architecture). V1 relocates *where that logic runs* — from a server to the device — without touching *what it does*. The existing automated test suite is the regression gate: nothing ships that breaks it.

---

## Rollout plan

A sequential build-out — each phase depends on the one before it:

1. **On-device database** — Swap the server database for an on-device one, using the exact same data structure already designed (same fields, same IDs, same categories). Nothing about *what* is stored changes, only *where*.
2. **Relocate the business logic** — Move the parsing/categorization/dashboard logic to run inside the app itself instead of being called over the network.
3. **On-device document reading** — Move PDF reading and OCR (scanned document text extraction) to run in the browser/app instead of on a server.
4. **Local security** — Add the PIN lock and the export/import backup feature.
5. **Packaging** — Produce an installable web app (works like an app from a browser) and an installable Android app.
6. **Testing & launch** — Full regression pass, including on real mid-range Android hardware, offline end-to-end.

*(Timeline intentionally omitted — sizing depends on team capacity, not scope uncertainty. Each phase is independently shippable and testable.)*

---

## What "done" looks like

- A full user journey — install, upload a payslip, upload a statement, view the dashboard, set a goal — completes with the device's network connection **off**.
- **$0** ongoing hosting or infrastructure cost.
- No user financial data is ever transmitted or stored outside the user's own device.
- Every automated test that passes today still passes.

---

## The bridge to V2

Because the underlying engine was already designed to not care where its data lives, V2 — cloud sync, multi-device, real accounts, and scale — is an **extension** of this build, not a rewrite of it. The full technical plan for that transition is in [v2-migration-spec.md](v2-migration-spec.md).
