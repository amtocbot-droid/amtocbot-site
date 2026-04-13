-- Migration 006: Admin Control Center — publishing queue, social queue, production pipeline
-- Apply: npx wrangler d1 execute engage-db --file=migrations/006-admin-control-center.sql

CREATE TABLE IF NOT EXISTS content_cross_posts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  content_id   TEXT NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  platform     TEXT NOT NULL,
  posted_at    TEXT,
  posted_by    INTEGER REFERENCES users(id),
  notes        TEXT,
  created_at   TEXT DEFAULT (datetime('now')),
  UNIQUE(content_id, platform)
);
CREATE INDEX IF NOT EXISTS idx_ccp_content ON content_cross_posts(content_id);

CREATE TABLE IF NOT EXISTS social_posts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  content_id   TEXT NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  platform     TEXT NOT NULL,
  draft_body   TEXT,
  status       TEXT NOT NULL DEFAULT 'pending',
  posted_at    TEXT,
  posted_by    INTEGER REFERENCES users(id),
  created_at   TEXT DEFAULT (datetime('now')),
  updated_at   TEXT DEFAULT (datetime('now')),
  UNIQUE(content_id, platform)
);
CREATE INDEX IF NOT EXISTS idx_sp_status ON social_posts(status);

CREATE TABLE IF NOT EXISTS production_pipeline (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  content_id        TEXT NOT NULL REFERENCES content(id) ON DELETE CASCADE UNIQUE,
  stage             TEXT NOT NULL DEFAULT 'scripted',
  stage_updated_at  TEXT DEFAULT (datetime('now')),
  stage_updated_by  INTEGER REFERENCES users(id),
  notes             TEXT,
  created_at        TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pp_stage ON production_pipeline(stage);

INSERT OR IGNORE INTO schema_version (version, description)
VALUES (6, 'Admin Control Center: content_cross_posts, social_posts, production_pipeline');
