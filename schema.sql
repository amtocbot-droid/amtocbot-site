-- AmtocSoft Engage Hub — D1 Database Schema
-- Database: engage-db (e3ba9916-844b-47f1-9c43-8ed761dbf753)
--
-- Apply:  npx wrangler d1 execute engage-db --file=schema.sql
-- Verify: npx wrangler d1 execute engage-db --command ".schema"

-- Schema versioning
CREATE TABLE IF NOT EXISTS schema_version (
  version    INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now')),
  description TEXT
);
INSERT OR IGNORE INTO schema_version (version, description) VALUES (1, 'Initial schema: users, sessions, audit_logs, site_config');

-- Users (invite-only)
CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  username   TEXT NOT NULL UNIQUE,
  email      TEXT NOT NULL UNIQUE,
  role       TEXT NOT NULL DEFAULT 'member',
  invited_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sessions (magic link auth)
CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  token      TEXT,
  token_exp  TEXT,
  verified   INTEGER NOT NULL DEFAULT 0,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  username   TEXT NOT NULL,
  action     TEXT NOT NULL,
  detail     TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);

-- Site config overrides (admin-editable stats that supersede GitHub sync)
CREATE TABLE IF NOT EXISTS site_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_by TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ── Automation Control ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automation_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_name TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  summary TEXT,
  trigger_type TEXT DEFAULT 'cron',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_automation_job_date ON automation_runs(job_name, started_at DESC);

-- Seed automation control flags
INSERT OR IGNORE INTO site_config (key, value) VALUES ('automation.metrics-scrape.paused', 'false');
INSERT OR IGNORE INTO site_config (key, value) VALUES ('automation.metrics-scrape.trigger_requested', 'false');
INSERT OR IGNORE INTO site_config (key, value) VALUES ('automation.engage-refresh.paused', 'false');
INSERT OR IGNORE INTO site_config (key, value) VALUES ('automation.engage-refresh.trigger_requested', 'false');
