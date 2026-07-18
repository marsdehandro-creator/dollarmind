-- =====================================================================
-- Migration 0009_merchant_rules_confidence  (pilot / SQLite)
-- =====================================================================
-- Phase 16: dedicated merchant → category store with confidence + source,
-- plus a confidence score persisted on each transaction.
-- =====================================================================

ALTER TABLE "transaction" ADD COLUMN confidence REAL NOT NULL DEFAULT 1.0;

CREATE TABLE merchant_rule (
  tenant_id     TEXT NOT NULL REFERENCES tenant(id),
  merchant      TEXT NOT NULL,
  category      TEXT NOT NULL,
  source        TEXT NOT NULL DEFAULT 'system' CHECK (source IN ('system','user_override')),
  confidence    REAL NOT NULL DEFAULT 1.0,
  last_updated  TEXT NOT NULL,
  PRIMARY KEY (tenant_id, merchant)
) STRICT;
