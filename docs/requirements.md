# DollarMind — Product Requirements Document (PRD)

**Status:** Draft v1
**Owner:** Dehandro
**Last updated:** 2026-07-17
**Region focus:** South Africa (ZAR, SARS tax context)

---

## 1. Overview

### 1.1 Problem statement
Personal financial data is fragmented across bank statements, payslips, and manual habits. It's hard to answer basic questions: *Where does my money actually go? Am I overspending? Am I on track for my goals? Am I handling tax correctly?* Existing tools are either cloud-locked (privacy concerns), region-generic (no SARS context), or require tedious manual entry.

### 1.2 Product vision
An **offline-first personal finance brain** that ingests your payslips and bank statements, automatically categorizes and de-duplicates transactions, tracks goals, and acts as an advisor — surfacing overspend, hidden costs, and savings opportunities, plus general SARS tax guidance grounded in *your* data.

**Long-term:** evolve from a single-user offline app into a secure, compliant, multi-tenant SaaS.

### 1.3 Goals & non-goals

**Goals**
- Turn raw documents (slips, statements) into structured, trustworthy financial data with minimal manual effort.
- Give a clear, always-current picture of income, spending, and goal progress.
- Provide actionable, data-grounded suggestions — not generic tips.
- Keep data private and under user control (offline-first).

**Non-goals (explicitly out of scope)**
- **Not** a licensed financial advisor or tax practitioner. All advice is *informational/educational*, not personalized regulated advice.
- **Not** a bank aggregator with live account connections (at MVP — see Phase 2/3).
- **Not** executing any transactions, transfers, or trades on the user's behalf — ever.
- **Not** a tax-filing/submission tool. SARS guidance is explanatory only.

### 1.4 Target users
- **MVP:** the builder (single user, technical, SA-based, wants control + privacy).
- **Phase 2/3:** privacy-conscious SA individuals, freelancers/contractors with irregular income, and eventually small businesses/sole proprietors.

---

## 2. Guiding principles

1. **Offline-first, local-owned data.** Nothing leaves the device without explicit action. Architecture should not assume the cloud.
2. **Trust through transparency.** Every derived number (category, net pay, dedup match) must be explainable and correctable by the user.
3. **Assist, never act.** The app advises and informs; it never moves money or files anything.
4. **Correctness over cleverness.** A wrong auto-category or a missed duplicate erodes trust fast. Favor "flag for review" over silent guesses.
5. **Compliance-ready by design.** Even offline, structure data so the eventual SaaS transition (POPIA, multi-tenancy, encryption) isn't a rewrite.

---

## 3. Personas & core jobs-to-be-done

| Persona | Job-to-be-done |
|---|---|
| **The Owner (you)** | "Show me the truth about my money without me typing everything in." |
| **The Planner** | "Tell me if I can afford my house/car/vacation goals and when." |
| **The Worried Spender** | "Warn me when I'm overspending or paying for things I forgot about." |
| **The Taxpayer** | "Help me understand my SARS situation from my actual income data." |

---

## 4. Feature requirements

### 4.1 Feature summary & phasing

| # | Feature | Phase | Priority |
|---|---|---|---|
| F1 | Salary slip ingestion & dynamic breakdown | **MVP** | P0 |
| F2 | Bank statement ingestion & transaction history | **MVP** | P0 |
| F3 | Date-range filters & search | **MVP** | P0 |
| F4 | Transaction deduplication across uploads | **MVP** | P0 |
| F5 | Category detection & trend analysis | **MVP** | P0 |
| F6 | Manual expenses + reconciliation | **MVP** | P1 |
| F7 | Issues / error reporting section | **MVP** | P1 |
| F8 | Goals engine | **Phase 2** | P1 |
| F9 | Advisor dashboard | **Phase 2** | P1 |
| F10 | SARS guidance page | **Phase 2** | P2 |
| F11 | Multi-tenant SaaS, accounts, sync | **Phase 3** | P1 |
| F12 | Live bank feeds / open banking | **Phase 3** | P2 |

---

### 4.2 MVP features (detailed)

#### F1 — Salary slip ingestion & dynamic breakdown
**What:** Upload a payslip (PDF/image). Parse into structured fields and render a dynamic breakdown.
- **Inputs:** PDF, PNG/JPG. Manual entry/override always available.
- **Extracted fields:** employer, pay period, gross pay, net pay, and itemized lines for deductions (PAYE, UIF, medical aid, pension/RA) and contributions/allowances.
- **Dynamic breakdown:** gross → deductions → contributions → net, with each line editable and totals that reconcile (net = gross − deductions + non-taxable allowances, validated).
- **Acceptance criteria:**
  - User can upload a slip and see a structured breakdown within one screen.
  - Any field the parser couldn't read confidently is flagged, not silently zeroed.
  - Totals reconcile; a mismatch raises a warning (feeds into F7).
  - Historical slips are stored and comparable month-over-month.

> **Note on parsing:** SA payslips vary wildly by employer/payroll system. MVP should support **template-assisted + manual correction**; do not promise 100% auto-extraction. Every parse is a *draft* the user confirms.

#### F2 — Bank statement ingestion & transaction history
**What:** Upload statements (PDF/CSV) and build a unified transaction ledger.
- **Inputs:** CSV (preferred, reliable), PDF (best-effort parse). Support common SA banks (FNB, Standard Bank, Absa, Nedbank, Capitec, TymeBank, Discovery).
- **Per transaction:** date, description (raw), amount, direction (debit/credit), balance (if present), source account, source file.
- **Ledger:** unified, sortable, searchable list across all uploaded statements/accounts.
- **Acceptance criteria:**
  - Each imported transaction retains provenance (which file, which row) for auditability.
  - Amounts and running balances are validated against statement opening/closing balances where available; discrepancies flagged (feeds F7).
  - Multiple accounts supported; each transaction tagged to its account.

#### F3 — Date-range filters & search
**What:** Filter and search the ledger.
- Date range (presets: this month, last month, tax year Mar–Feb, custom).
- Filter by account, category, direction, amount range, text search on description.
- **Acceptance criteria:** filters compose; the active period drives all totals shown on screen (trends, category sums, etc.).

#### F4 — Transaction deduplication across uploads
**What:** Detect and merge/skip duplicate transactions when overlapping statements are uploaded.
- **Why it matters:** re-uploading an overlapping period must not double-count spending.
- **Matching strategy:** composite key on (account, date, normalized amount, normalized description) with fuzzy tolerance for description and ±1–2 day date drift for pending→posted shifts.
- **Behavior:** exact matches auto-skipped; near-matches surfaced for user confirmation ("possible duplicate — merge / keep both").
- **Acceptance criteria:**
  - Uploading the same statement twice adds **zero** new transactions.
  - Overlapping ranges import only the genuinely new transactions.
  - User can review and undo any auto-dedup decision (transparency principle).

#### F5 — Category detection & trend analysis
**What:** Assign categories to transactions and show spend trends.
- **Categorization:** rules/keyword-based at MVP (e.g. "Woolworths/Checkers → Groceries", "Uber → Transport"), with user-defined rules and per-transaction overrides. Learn from overrides (a corrected merchant sticks).
- **Trends:** category totals over the selected period (e.g. *Food = R3,000 this month*), month-over-month comparison, top merchants, income vs. expense.
- **Acceptance criteria:**
  - Every transaction has a category (default "Uncategorized"); uncategorized volume is visible and reducible.
  - Category totals recompute with the active date filter.
  - User-created rules and overrides persist and take precedence over auto-detection.

#### F6 — Manual expenses + reconciliation
**What:** Log cash/manual expenses and reconcile them against bank transactions.
- Add a manual expense (date, amount, category, note).
- **Reconciliation:** match a manual entry to a bank transaction (e.g. you logged "lunch R120" and it later appears on the statement) so it isn't double-counted.
- **Acceptance criteria:**
  - Manual entries are visually distinct from imported ones.
  - Reconciled pairs count once in totals.
  - Unreconciled manual expenses (true cash) still count toward spend.

#### F7 — Issues / error reporting section
**What:** A central place surfacing data-quality problems and letting the user report app bugs.
- **System-flagged issues:** failed/partial parses, balance mismatches, unresolved possible-duplicates, large uncategorized volume, reconciliation gaps.
- **User-reported issues:** free-form bug/feedback log (local at MVP).
- **Acceptance criteria:** each issue links directly to the affected record and offers a resolution action; resolved issues are archived, not deleted.

---

### 4.3 Phase 2 features

#### F8 — Goals engine
- Define goals: **house, car, vacation, emergency fund** (target amount, target date, priority).
- Track contributions (manual, or auto-detected transfers to a savings account).
- Projections: "at current savings rate you reach X by date Y"; shortfall/surplus vs. plan.
- Emergency fund uses a rule-of-thumb target (e.g. N months of average expenses, derived from F5).
- **Framing:** projections are informational, clearly labelled as estimates, not guarantees.

#### F9 — Advisor dashboard
- **Overspend detection:** categories trending above the user's own baseline/budget.
- **Savings suggestions:** data-grounded (e.g. "dining out up 40% vs. your 3-month average").
- **Hidden costs:** recurring subscriptions/debit orders auto-detected from repeating transactions; flag duplicate or unused-looking ones.
- **Cashflow view:** income vs. spend vs. savings over time.
- **Framing:** suggestions are educational; never phrased as personalized regulated financial advice.

#### F10 — SARS guidance page
- General, educational tax context grounded in the user's income/deduction data.
- Examples: estimated tax bracket, PAYE sanity-check, tax-year (Mar–Feb) income summary, awareness of deductible categories (RA, medical aid credits), provisional-tax awareness for irregular/freelance income.
- **Hard guardrails:**
  - Prominent, persistent disclaimer: *"General information, not tax or legal advice. Consult a registered tax practitioner / SARS."*
  - No filing, no submission, no calculation presented as an official/binding figure.
  - Cite the concept, not a promise (rates/thresholds change per tax year — make the tax-year explicit and version the rules).

---

### 4.4 Phase 3 features

- **F11 — Multi-tenant SaaS:** user accounts, authentication, per-tenant data isolation, encrypted cloud storage, optional sync across devices, role model.
- **F12 — Live bank feeds / open banking:** replace manual uploads with API-based feeds where available in SA; still keep manual upload as a fallback.
- **Collaboration:** shared household/partner views; accountant read-only access.
- **Advanced advisor:** ML-based categorization and anomaly/fraud detection; scenario planning ("what if I cut R500/month?").

---

## 5. Key user flows

### 5.1 Upload a salary slip
1. User selects **Upload Slip** → picks PDF/image.
2. App parses → shows a **draft breakdown** (gross, deductions, contributions, net) with low-confidence fields flagged.
3. User reviews, corrects any flagged field, confirms.
4. App validates totals reconcile → saves slip to income history.
5. If totals don't reconcile → warning raised and logged to **Issues (F7)**.

### 5.2 Upload a bank statement
1. User selects **Upload Statement** → picks CSV/PDF → selects/creates the target account.
2. App parses transactions → runs **deduplication (F4)** against existing ledger.
3. App shows an **import preview**: *N new, M duplicates auto-skipped, K possible duplicates to review*.
4. User resolves possible-duplicates (merge / keep both).
5. App runs **auto-categorization (F5)**; balance validated against statement.
6. Import committed; provenance stored; any mismatch → **Issues (F7)**.

### 5.3 View the dashboard
1. User lands on dashboard with a default period (this month) — changeable via **date filter (F3)**.
2. Sees: income vs. expense, category breakdown & trends, top merchants, goal progress (Phase 2), advisor alerts (Phase 2).
3. Clicks any category/number to drill into the underlying transactions.
4. Corrects a category → the change persists and updates all totals (and can create a learning rule).

### 5.4 Set & track a goal (Phase 2)
1. User selects **New Goal** → chooses type (house/car/vacation/emergency), target amount, target date, priority.
2. App suggests a required monthly contribution and shows feasibility vs. current savings rate.
3. User links a savings account or logs contributions.
4. Dashboard shows progress %, projected completion date, and shortfall/surplus.

### 5.5 Report / resolve an issue
1. User opens **Issues** → sees system-flagged and self-reported items.
2. Selects an issue → jumps to the affected record → applies the suggested fix (re-categorize, merge duplicate, correct parse, reconcile).
3. Issue marked resolved and archived.

---

## 6. Data model (conceptual)

Core entities (design now, even offline, to ease the SaaS transition):

- **User / Tenant** (single at MVP; make it a first-class entity anyway so multi-tenancy is a scaling, not a rewrite).
- **Account** (bank account, employer/income source).
- **Document** (uploaded slip/statement; stores raw file + parse metadata + provenance).
- **Payslip** (structured slip → line items: gross, deductions, contributions, net; links to Document).
- **Transaction** (date, raw + normalized description, amount, direction, balance, account, source Document+row, category, dedup group, reconciliation link).
- **ManualExpense** (links optionally to a Transaction via reconciliation).
- **Category** + **CategoryRule** (user-defined and learned).
- **Goal** + **Contribution** (Phase 2).
- **Issue** (system- or user-generated; links to any entity).
- **AuditLog** (who/what changed — essential for trust now and compliance later).

**Design guidance:** every derived value stores enough provenance to explain and reverse it. Prefer soft-delete + archive over hard delete (also aligns with never permanently destroying financial records without intent).

---

## 7. Non-functional requirements

| Area | Requirement |
|---|---|
| **Privacy** | Offline-first; all data stored locally. No third-party analytics on financial data. Explicit user action required for any export/upload. |
| **Security** | Encrypt sensitive data at rest even locally. Design auth boundaries now (even if single-user) so SaaS adds a layer, not a rewrite. |
| **Reliability** | Imports are transactional — a failed parse never corrupts the ledger. Every import is previewable and reversible. |
| **Transparency** | Every derived figure is explainable and user-correctable. Full audit log. |
| **Performance** | Ledger and filters remain responsive at years of history (tens of thousands of transactions). |
| **Portability** | Full data export (e.g. JSON/CSV) — user owns and can leave with their data. |
| **Localization** | ZAR currency, SA date formats, SA tax year (1 Mar – 28/29 Feb), SA bank formats. |

---

## 8. Product & business considerations (things worth deciding early)

These are the gaps that bite later if ignored now.

### 8.1 Compliance & legal
- **POPIA (SA's data protection law):** the moment this becomes multi-user SaaS, you're a *responsible party* processing personal + financial data. Plan for lawful basis, consent, data-subject rights (access/deletion), breach notification, and a privacy policy. Building audit logs and export/delete now makes this cheaper later.
- **Financial advice licensing (FAIS / FSCA):** giving *personalized* financial/investment advice is a regulated activity in SA. Keep the product firmly on the "information & tools" side. The advisor dashboard and SARS page must be **educational**, disclaimed, and never present as regulated advice or a specific product recommendation. Get a lawyer to review this framing before going public.
- **Tax guidance liability:** same principle — general info + prominent disclaimer + explicit tax-year versioning. Never present a number as an official SARS figure.

### 8.2 Data ownership & trust
- **Ownership:** state clearly (even to yourself now) that the *user* owns their data. This becomes a marketing differentiator vs. cloud-locked competitors — lean into "your data stays yours."
- **Export/portability:** a first-class feature, not an afterthought.
- **Retention & deletion:** define how long data lives and how a user truly deletes it (with the "don't hard-delete financial records unintentionally" nuance — offer archive vs. permanent delete with confirmation).

### 8.3 Pricing & monetization (for the SaaS phase)
- Likely **freemium**: free tier (manual uploads, core categorization) → paid tier (advisor, goals, multi-account, sync, live feeds).
- **Do not** monetize by selling/sharing financial data — it contradicts the privacy positioning and invites regulatory risk.
- Consider a **local-first "own your data" one-time or self-hosted** option as a differentiator for the privacy segment.

### 8.4 Support & operations
- **Support:** even solo, you'll need a feedback/bug channel (F7 covers the seed of this). For SaaS: help docs, a support inbox, status page.
- **Bank format drift:** banks change statement formats without notice — budget ongoing maintenance for parsers. Design parsers as versioned, swappable adapters.
- **Onboarding:** the first upload experience makes or breaks trust. Invest in a smooth "first slip / first statement" flow with clear handling of parse failures.

### 8.5 Scaling & architecture foresight
- **Offline-first → SaaS is the biggest architectural bet.** Decide now: local DB with a sync-friendly schema, tenant ID on every record from day one, and a clear separation between "engine" (parsing, dedup, categorization, advisor logic) and "storage/transport." This keeps the cloud migration additive.
- **Categorization engine** should be pluggable: rules now, ML later, without reworking the ledger.
- **Multi-currency / multi-region:** you're SA-only now; if you ever expand, tax logic and currency must be modular (don't hardcode ZAR/SARS assumptions into core).

### 8.6 Key risks
| Risk | Mitigation |
|---|---|
| Parser inaccuracy erodes trust | Draft-and-confirm UX; always allow manual correction; flag low confidence. |
| Dedup false-negatives double-count spend | Conservative auto-merge + review queue; make it reversible. |
| Regulatory (advice/tax) exposure | Educational framing + disclaimers + legal review before public launch. |
| Offline→SaaS rewrite cost | Multi-tenant-ready schema + engine/storage separation from day one. |
| Bank format changes break imports | Versioned parser adapters; graceful failure into Issues. |

---

## 9. Success metrics

**MVP (personal use):**
- % of transactions auto-categorized correctly (target improves as rules learn).
- Duplicate rate after import ≈ 0.
- Time from "upload statement" to "trustworthy categorized ledger."
- Manual-correction rate trending down over time.

**SaaS phase (later):**
- Activation: % of new users who complete a first successful import.
- Retention: monthly active users; % returning to check the dashboard.
- Conversion to paid tier; support ticket volume per active user.

---

## 10. Open questions

1. Which SA banks' statement formats to support first (by your own accounts)?
2. CSV-first vs. investing early in robust PDF parsing?
3. How much auto-categorization intelligence at MVP vs. relying on user rules?
4. Emergency-fund target rule — fixed (e.g. 3 months) or user-configurable?
5. For SARS guidance, which tax-year's rates to encode first, and how to version them annually?
6. Local storage tech choice that best eases the eventual sync/multi-tenant move.

---

*This document is a living draft. MVP scope is intentionally narrow — ingest, trust, understand — with advisor/goals/tax framed as the value-add second act, and SaaS/compliance as the deliberate third.*
