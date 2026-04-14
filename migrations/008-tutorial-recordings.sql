-- Migration 008: tutorial recordings — user video explanations per lesson
-- Apply (remote): npx wrangler d1 execute engage-db --remote --file=migrations/008-tutorial-recordings.sql

CREATE TABLE IF NOT EXISTS tutorial_recordings (
  id           TEXT PRIMARY KEY,
  language     TEXT NOT NULL,
  level        TEXT NOT NULL,
  slug         TEXT NOT NULL,
  display_name TEXT NOT NULL,
  r2_key       TEXT NOT NULL UNIQUE,
  public_url   TEXT NOT NULL,
  duration_ms  INTEGER,
  status       TEXT NOT NULL DEFAULT 'active',
  created_at   TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tr_lesson
  ON tutorial_recordings(language, level, slug, status, created_at);

INSERT OR IGNORE INTO schema_version (version, description)
VALUES (8, 'Tutorial recordings: user video explanations per lesson');
