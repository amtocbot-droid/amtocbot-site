-- Migration 004: Dashboard — QA pipeline + Issue tracker
-- Apply: npx wrangler d1 execute engage-db --file=migrations/004-dashboard-qa-issues.sql

-- Add QA columns to content
ALTER TABLE content ADD COLUMN qa_status TEXT DEFAULT 'draft';
ALTER TABLE content ADD COLUMN qa_updated_at TEXT;
ALTER TABLE content ADD COLUMN qa_updated_by INTEGER;

-- Backfill: existing published content → qa_status = 'published'
UPDATE content SET qa_status = 'published' WHERE status = 'Published';

-- Issues table
CREATE TABLE IF NOT EXISTS issues (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT NOT NULL,
  description  TEXT,
  type         TEXT NOT NULL DEFAULT 'bug',
  severity     TEXT NOT NULL DEFAULT 'medium',
  status       TEXT NOT NULL DEFAULT 'open',
  content_id   TEXT REFERENCES content(id),
  created_by   INTEGER NOT NULL REFERENCES users(id),
  assigned_to  INTEGER REFERENCES users(id),
  closed_by    INTEGER REFERENCES users(id),
  closed_at    TEXT,
  created_at   TEXT DEFAULT (datetime('now')),
  updated_at   TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_content ON issues(content_id);
CREATE INDEX IF NOT EXISTS idx_issues_assigned ON issues(assigned_to);
CREATE INDEX IF NOT EXISTS idx_issues_created ON issues(created_at DESC);

-- Issue comments
CREATE TABLE IF NOT EXISTS issue_comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id   INTEGER NOT NULL REFERENCES issues(id),
  user_id    INTEGER NOT NULL REFERENCES users(id),
  username   TEXT NOT NULL,
  body       TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_comments_issue ON issue_comments(issue_id, created_at);

-- Version stamp
INSERT OR IGNORE INTO schema_version (version, description)
VALUES (4, 'Dashboard: issues, issue_comments, content.qa_status');
