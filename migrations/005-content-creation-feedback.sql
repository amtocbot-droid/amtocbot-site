-- Migration 005: Content Creation + Inline Review Feedback
-- Apply: npx wrangler d1 execute engage-db --file=migrations/005-content-creation-feedback.sql

ALTER TABLE content ADD COLUMN reviewer_instructions TEXT;
ALTER TABLE content ADD COLUMN external_url TEXT;

CREATE TABLE IF NOT EXISTS content_feedback (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  content_id    TEXT NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  username      TEXT NOT NULL,
  body          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'open',
  resolved_by   INTEGER REFERENCES users(id),
  resolved_at   TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cf_content ON content_feedback(content_id, created_at);
CREATE INDEX IF NOT EXISTS idx_cf_status  ON content_feedback(status);

INSERT OR IGNORE INTO schema_version (version, description)
VALUES (5, 'Content creation + inline review feedback');
