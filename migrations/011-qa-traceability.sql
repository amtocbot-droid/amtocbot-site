-- Migration 011: QA Traceability Matrix
-- Adds: qa_runs, qa_check_results, qa_acknowledgements, qa_weekly_signoffs
-- Modifies: issues (adds qa_content_code, qa_check_type)

-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS qa_runs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  client_run_id   TEXT UNIQUE,
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

INSERT OR IGNORE INTO schema_version (version, description)
  VALUES (11, 'QA traceability matrix: runs, check_results, acknowledgements, weekly_signoffs, issues.qa_*');
