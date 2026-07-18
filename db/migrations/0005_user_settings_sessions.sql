-- =====================================================================
-- Migration 0005_user_settings_sessions  (pilot / SQLite)
-- =====================================================================
-- User preferences + server-side sessions (refresh-token rotation).
-- See docs/security.md §2.2, §2.4.
-- =====================================================================

CREATE TABLE user_settings (
  user_id       TEXT PRIMARY KEY REFERENCES "user"(id),
  tenant_id     TEXT NOT NULL REFERENCES tenant(id),
  display_name  TEXT,
  theme         TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('light','dark','system')),
  currency      TEXT NOT NULL DEFAULT 'ZAR',
  chart_type    TEXT NOT NULL DEFAULT 'bar' CHECK (chart_type IN ('bar','line')),
  default_month TEXT NOT NULL DEFAULT 'current',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
) STRICT;

CREATE TABLE user_session (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL REFERENCES tenant(id),
  user_id             TEXT NOT NULL REFERENCES "user"(id),
  refresh_token_hash  TEXT NOT NULL,
  user_agent          TEXT,
  ip                  TEXT,
  created_at          TEXT NOT NULL,
  last_used_at        TEXT NOT NULL,
  expires_at          TEXT NOT NULL,
  revoked_at          TEXT
) STRICT;

CREATE INDEX idx_session_user    ON user_session(user_id);
CREATE INDEX idx_session_refresh ON user_session(refresh_token_hash);
