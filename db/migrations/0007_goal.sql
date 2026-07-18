-- =====================================================================
-- Migration 0007_goal  (pilot / SQLite)
-- =====================================================================
-- Financial goals (Phase 13). Extends the goal entity from docs/data-model.md
-- with current_savings, monthly_contribution, icon, and category_id so the
-- goals engine can compute progress + insights without a separate
-- contributions table for the pilot.
-- =====================================================================

CREATE TABLE goal (
  id                    TEXT PRIMARY KEY,
  tenant_id             TEXT NOT NULL REFERENCES tenant(id),
  name                  TEXT NOT NULL,
  goal_type             TEXT NOT NULL DEFAULT 'custom'
                          CHECK (goal_type IN ('house','car','vacation','emergency','custom')),
  target_amount         INTEGER NOT NULL,
  current_savings       INTEGER NOT NULL DEFAULT 0,
  monthly_contribution  INTEGER NOT NULL DEFAULT 0,
  target_date           TEXT,
  category_id           TEXT,
  icon                  TEXT,
  priority              INTEGER NOT NULL DEFAULT 100,
  status                TEXT NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','achieved','paused','archived')),
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  archived_at           TEXT
) STRICT;

CREATE INDEX idx_goal_tenant ON goal(tenant_id, status);
