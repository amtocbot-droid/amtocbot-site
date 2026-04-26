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

-- ── Content Data ───────────────────────────────────────────────
INSERT OR IGNORE INTO schema_version (version, description) VALUES (2, 'Content tables: content, metrics_history, milestones, platforms, summaries');

CREATE TABLE IF NOT EXISTS content (
  id           TEXT PRIMARY KEY,
  type         TEXT NOT NULL,
  title        TEXT NOT NULL,
  date         TEXT NOT NULL,
  level        TEXT,
  status       TEXT DEFAULT 'Published',
  topic        TEXT,
  tags         TEXT,
  blog_url     TEXT,
  youtube_url  TEXT,
  youtube_id   TEXT,
  linkedin_url TEXT,
  twitter_url  TEXT,
  spotify_url  TEXT,
  duration     TEXT,
  description  TEXT,
  views        INTEGER DEFAULT 0,
  likes        INTEGER DEFAULT 0,
  comments     INTEGER DEFAULT 0,
  last_scraped TEXT,
  created_at   TEXT DEFAULT (datetime('now')),
  updated_at   TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_content_type ON content(type);
CREATE INDEX IF NOT EXISTS idx_content_date ON content(date DESC);
CREATE INDEX IF NOT EXISTS idx_content_type_date ON content(type, date DESC);

CREATE TABLE IF NOT EXISTS metrics_history (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  content_id   TEXT NOT NULL REFERENCES content(id),
  scraped_date TEXT NOT NULL,
  views        INTEGER DEFAULT 0,
  likes        INTEGER DEFAULT 0,
  comments     INTEGER DEFAULT 0,
  UNIQUE(content_id, scraped_date)
);

CREATE INDEX IF NOT EXISTS idx_metrics_content ON metrics_history(content_id, scraped_date DESC);

CREATE TABLE IF NOT EXISTS milestones (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  name    TEXT NOT NULL,
  target  INTEGER NOT NULL,
  current INTEGER DEFAULT 0,
  status  TEXT DEFAULT 'in-progress'
);

CREATE TABLE IF NOT EXISTS platforms (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  handle   TEXT NOT NULL,
  url      TEXT,
  icon     TEXT
);

CREATE TABLE IF NOT EXISTS summaries (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  period       TEXT NOT NULL,
  label        TEXT NOT NULL,
  blogs        INTEGER DEFAULT 0,
  videos       INTEGER DEFAULT 0,
  shorts       INTEGER DEFAULT 0,
  podcasts     INTEGER DEFAULT 0,
  social_posts INTEGER DEFAULT 0
);

-- ── Calendar Planner ──────────────────────────────────────────
INSERT OR IGNORE INTO schema_version (version, description) VALUES (3, 'Calendar planner: calendar_proposals, calendar_items');

CREATE TABLE IF NOT EXISTS calendar_proposals (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  week_start          TEXT NOT NULL,
  status              TEXT DEFAULT 'draft',
  generated_at        TEXT,
  trigger_type        TEXT DEFAULT 'cron',
  trend_sources       TEXT,
  performance_summary TEXT,
  created_at          TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_proposals_week ON calendar_proposals(week_start DESC);

CREATE TABLE IF NOT EXISTS calendar_items (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  proposal_id     INTEGER NOT NULL REFERENCES calendar_proposals(id),
  day             TEXT NOT NULL,
  slot            INTEGER DEFAULT 0,
  type            TEXT NOT NULL,
  title           TEXT NOT NULL,
  topic           TEXT,
  level           TEXT,
  reasoning       TEXT,
  status          TEXT DEFAULT 'proposed',
  content_id      TEXT,
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_items_proposal ON calendar_items(proposal_id);
CREATE INDEX IF NOT EXISTS idx_items_day ON calendar_items(day);

-- Seed calendar automation flags
INSERT OR IGNORE INTO site_config (key, value) VALUES ('automation.calendar-generate.paused', 'false');
INSERT OR IGNORE INTO site_config (key, value) VALUES ('automation.calendar-generate.trigger_requested', 'false');

-- Seed scalar config values
INSERT OR IGNORE INTO site_config (key, value) VALUES ('tiktok_count', '0');
INSERT OR IGNORE INTO site_config (key, value) VALUES ('platform_count', '8');

-- ── Dashboard: QA Pipeline + Issue Tracker ────────────────────
INSERT OR IGNORE INTO schema_version (version, description) VALUES (4, 'Dashboard: issues, issue_comments, content.qa_status');

-- QA columns on content (applied via ALTER in migration 004)
-- content.qa_status TEXT DEFAULT 'draft'
-- content.qa_updated_at TEXT
-- content.qa_updated_by INTEGER

-- Issues
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

-- ── Public Feedback + Issue Reports ───────────────────────────
INSERT OR IGNORE INTO schema_version (version, description)
VALUES (10, 'Public feedback + issue reports: /feedback and /report-issue pages');

-- Suggestions and general comments from any visitor (no login required)
CREATE TABLE IF NOT EXISTS public_feedback (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  category    TEXT NOT NULL DEFAULT 'general',    -- general | suggestion | improvement | ux | content | other
  subject     TEXT NOT NULL,
  message     TEXT NOT NULL,
  name        TEXT,
  email       TEXT,
  user_id     INTEGER REFERENCES users(id),
  username    TEXT,
  status      TEXT NOT NULL DEFAULT 'new',        -- new | reviewed | actioned | dismissed
  ip_address  TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pfeedback_status   ON public_feedback(status);
CREATE INDEX IF NOT EXISTS idx_pfeedback_created  ON public_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pfeedback_category ON public_feedback(category);

-- Bug / image / video issue reports from any visitor or tester
CREATE TABLE IF NOT EXISTS public_reports (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  report_type  TEXT NOT NULL DEFAULT 'bug',       -- bug | image_issue | video_issue | content_error | performance | other
  title        TEXT NOT NULL,
  description  TEXT NOT NULL,
  page_url     TEXT,
  content_type TEXT,                              -- video | image | blog | general
  content_ref  TEXT,
  severity     TEXT NOT NULL DEFAULT 'medium',    -- low | medium | high | critical
  name         TEXT,
  email        TEXT,
  user_id      INTEGER REFERENCES users(id),
  username     TEXT,
  status       TEXT NOT NULL DEFAULT 'new',       -- new | acknowledged | in_progress | resolved | dismissed
  ip_address   TEXT,
  assigned_to  INTEGER REFERENCES users(id),
  resolved_at  TEXT,
  resolution   TEXT,
  created_at   TEXT DEFAULT (datetime('now')),
  updated_at   TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_preports_status   ON public_reports(status);
CREATE INDEX IF NOT EXISTS idx_preports_type     ON public_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_preports_created  ON public_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_preports_assigned ON public_reports(assigned_to);

-- ── QA Traceability Matrix ────────────────────────────────────
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS qa_runs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  client_run_id   TEXT UNIQUE,    -- nullable: internal runs have no client ID; SQLite UNIQUE allows multiple NULLs
  started_at      TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at     TEXT,
  source          TEXT NOT NULL,
  triggered_by    INTEGER REFERENCES users(id),
  total_checks    INTEGER DEFAULT 0,
  total_pass      INTEGER DEFAULT 0,
  total_fail      INTEGER DEFAULT 0,
  total_na        INTEGER DEFAULT 0,
  notes           TEXT
);
CREATE INDEX IF NOT EXISTS idx_qa_runs_started ON qa_runs(started_at DESC);

-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS qa_check_results (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id          INTEGER NOT NULL REFERENCES qa_runs(id),
  content_code    TEXT NOT NULL,
  content_kind    TEXT NOT NULL,
  content_title   TEXT,
  check_type      TEXT NOT NULL,
  status          TEXT NOT NULL,
  error_detail    TEXT,
  checked_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_qa_results_latest
  ON qa_check_results(content_code, check_type, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_results_run    ON qa_check_results(run_id);
CREATE INDEX IF NOT EXISTS idx_qa_results_status ON qa_check_results(status, checked_at DESC);

-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS qa_acknowledgements (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  content_code      TEXT NOT NULL,
  check_type        TEXT NOT NULL,
  acknowledged_by   INTEGER NOT NULL REFERENCES users(id),
  acknowledged_at   TEXT NOT NULL DEFAULT (datetime('now')),
  reason            TEXT NOT NULL,
  expires_at        TEXT NOT NULL,
  cleared_at        TEXT,
  cleared_reason    TEXT
);
CREATE INDEX IF NOT EXISTS idx_qa_ack_active
  ON qa_acknowledgements(content_code, check_type, expires_at)
  WHERE cleared_at IS NULL;

-- ─────────────────────────────────────────────────────────────
-- NOTE: ALTER TABLE is not idempotent. Running this migration twice will
-- error on duplicate column. Run via wrangler once; do not replay manually.
ALTER TABLE issues ADD COLUMN qa_content_code TEXT;
ALTER TABLE issues ADD COLUMN qa_check_type   TEXT;
CREATE INDEX IF NOT EXISTS idx_issues_qa_link
  ON issues(qa_content_code, qa_check_type, status);

-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS qa_weekly_signoffs (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  week_start_date     TEXT NOT NULL UNIQUE,
  signed_by           INTEGER NOT NULL REFERENCES users(id),
  signed_at           TEXT NOT NULL DEFAULT (datetime('now')),
  based_on_run_id     INTEGER NOT NULL REFERENCES qa_runs(id),
  count_regressions   INTEGER NOT NULL DEFAULT 0,
  count_persistent    INTEGER NOT NULL DEFAULT 0,
  count_new_green     INTEGER NOT NULL DEFAULT 0,
  count_steady_green  INTEGER NOT NULL DEFAULT 0,
  notes               TEXT
);
CREATE INDEX IF NOT EXISTS idx_qa_signoffs_week ON qa_weekly_signoffs(week_start_date DESC);
