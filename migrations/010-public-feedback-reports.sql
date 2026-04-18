-- Migration 010: Public Feedback + Issue Reports
-- Backs the /feedback and /report-issue public pages.
-- Apply: npx wrangler d1 execute engage-db --remote --file=migrations/010-public-feedback-reports.sql

-- ── Public Feedback ───────────────────────────────────────────
-- Stores suggestion / improvement submissions from any visitor.
CREATE TABLE IF NOT EXISTS public_feedback (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  category    TEXT NOT NULL DEFAULT 'general',    -- general | suggestion | improvement | ux | content | other
  subject     TEXT NOT NULL,
  message     TEXT NOT NULL,
  name        TEXT,                               -- optional — visitor may leave blank
  email       TEXT,                               -- optional — for follow-up
  user_id     INTEGER REFERENCES users(id),       -- set if the visitor is logged in
  username    TEXT,
  status      TEXT NOT NULL DEFAULT 'new',        -- new | reviewed | actioned | dismissed
  ip_address  TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pfeedback_status   ON public_feedback(status);
CREATE INDEX IF NOT EXISTS idx_pfeedback_created  ON public_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pfeedback_category ON public_feedback(category);

-- ── Public Issue Reports ──────────────────────────────────────
-- Stores bug / image / video issue reports from any visitor or tester.
CREATE TABLE IF NOT EXISTS public_reports (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  report_type  TEXT NOT NULL DEFAULT 'bug',       -- bug | image_issue | video_issue | content_error | performance | other
  title        TEXT NOT NULL,
  description  TEXT NOT NULL,
  page_url     TEXT,                              -- URL where the issue was observed
  content_type TEXT,                              -- video | image | blog | general
  content_ref  TEXT,                              -- content ID or URL fragment
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

INSERT OR IGNORE INTO schema_version (version, description)
VALUES (10, 'Public feedback + issue reports: /feedback and /report-issue pages');
