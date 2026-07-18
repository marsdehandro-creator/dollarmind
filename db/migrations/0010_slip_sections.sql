-- =====================================================================
-- Migration 0010_slip_sections  (pilot / SQLite)
-- =====================================================================
-- Phase 17: dynamic salary-slip rendering. Store the detected section title on
-- each component (preserving document grouping/order) plus slip metadata
-- (period label + notes) so the UI mirrors the uploaded document exactly.
-- =====================================================================

ALTER TABLE salary_component ADD COLUMN section TEXT;
ALTER TABLE salary_slip ADD COLUMN period_label TEXT;
ALTER TABLE salary_slip ADD COLUMN notes TEXT;
