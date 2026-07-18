-- =====================================================================
-- Migration 0006_layout_pref  (pilot / SQLite)
-- =====================================================================
-- Adds a navigation layout preference: 'auto' (sidebar on desktop, bottom nav
-- on mobile), 'sidebar' (always), or 'bottomnav' (always).
-- =====================================================================

ALTER TABLE user_settings
  ADD COLUMN layout TEXT NOT NULL DEFAULT 'auto'
  CHECK (layout IN ('auto','sidebar','bottomnav'));
