-- =====================================================================
-- Migration 0008_flag_merchant_slipfields  (pilot / SQLite)
-- =====================================================================
-- Phase 15:
--  - transaction.flagged  : low-confidence categorization needing review (orange)
--  - transaction.merchant : detected merchant name
--  - salary_slip.employer_name / employee_name : full slip reflection
-- =====================================================================

ALTER TABLE "transaction" ADD COLUMN flagged INTEGER NOT NULL DEFAULT 0 CHECK (flagged IN (0,1));
ALTER TABLE "transaction" ADD COLUMN merchant TEXT;

ALTER TABLE salary_slip ADD COLUMN employer_name TEXT;
ALTER TABLE salary_slip ADD COLUMN employee_name TEXT;

CREATE INDEX idx_txn_flagged ON "transaction"(tenant_id, flagged);
