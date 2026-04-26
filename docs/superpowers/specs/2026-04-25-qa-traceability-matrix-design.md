# QA Traceability Matrix — Design Spec

**Date:** 2026-04-25
**Author:** Claude (brainstormed with toc-am)
**Status:** Draft for implementation
**Repos affected:** `amtocbot-site` (primary), `amtocsoft-content` (Python check suite + GH Actions)

---

## 1. Goal

Give testers a single page on `/dashboard` that:

1. Renders a **traceability matrix** of every published content piece against 12 publish/QA gates.
2. Surfaces a **risk-weighted prioritized todo list** of items that need attention.
3. Provides **historical analytics** so testers can spot patterns over time.
4. Requires a **weekly human sign-off** that all gates are green / all reds are addressed, with explicit regression detection.

The system must answer four questions at a glance:

- *What's broken right now?* → Matrix.
- *What should I fix first?* → Todo list.
- *Did anything regress since last week?* → Sign-off dialog.
- *Which checks fail most often, on which content kinds?* → History tab.

---

## 2. Scope

### In scope

- New `Tester` tab on the existing `/dashboard` route in `amtocbot-site`.
- Four new D1 tables: `qa_runs`, `qa_check_results`, `qa_acknowledgements`, `qa_weekly_signoffs`.
- 16 new Pages Functions endpoints under `/api/dashboard/qa/` (plus a Cloudflare Cron monitor endpoint).
- New permission map entries: `qa.view`, `qa.acknowledge`, `qa.signoff`, `qa.refresh`.
- New Python orchestrator `scripts/qa-suite.py` + per-check modules in `amtocsoft-content`.
- New GitHub Actions workflow `.github/workflows/qa-suite.yml`.
- Tester-facing docs (`docs/qa-traceability.md`) + ops runbook (`docs/qa-runbook.md`).
- Cloudflare Cron monitor for missed runs / ingest errors / stale blockers.

### Out of scope

- Retroactive backfill of pre-rollout check states (history starts at first run).
- Modifying the existing `content` table schema or content registration flow.
- New roles or auth changes beyond the four new permissions.
- Email digests of weekly sign-offs (deferrable; can be added post-launch).
- Test-case authoring tools (this is content QA, not software QA).

---

## 3. Architecture

### 3.1 High-level flow

```
amtocsoft-content repo (Python)
   scripts/qa-suite.py + scripts/qa-checks/*.py
        │
        │ runs on schedule via
        ▼
GitHub Actions: .github/workflows/qa-suite.yml
   - cron '0 6 * * *'
   - workflow_dispatch (UI Refresh button)
   POSTs JSON results → /api/dashboard/qa/ingest
        │
        │ HTTPS + bearer token
        ▼
amtocbot-site (Cloudflare Pages Functions + D1)
   ingest, matrix, todos, history, acknowledge, signoff endpoints
   D1: qa_runs, qa_check_results, qa_acknowledgements, qa_weekly_signoffs
        │
        │ Angular HttpClient
        ▼
/dashboard → Tester tab
   ├ Live Matrix · Todos · History (heatmap | trend | sign-off log)
   └ Sign Off Week button (gated on eligibility)
```

### 3.2 Key design decisions

- **GitHub Actions, not Cloudflare Cron, runs the checks.** 4 of 12 checks need filesystem access to `amtocsoft-content` (tracker.md, watermark EXIF on image/video bytes). Pages Functions cannot reach those. Reusing existing Python scripts is a 10-line YAML vs porting 1000+ lines.
- **Pages Functions = view layer + write layer**, not check executor. The site stores snapshots, serves the matrix, and accepts tester writes (acks, sign-offs, manual issue filings).
- **Loose coupling via `content_code`**, no FK to `content` table. The amtocsoft-content repo is the canonical content registry; D1 stores only the codes the GH Actions side reports. No content sync layer needed.
- **Snapshots forever.** Each run writes ~7,200 rows to `qa_check_results`; ~400 MB/year. D1 free tier covers 25 years. No retention policy in v1.
- **First run = backfill.** No retroactive scoring — would produce inferred data, not measured data. History accumulates from day 1 of phase 4.

### 3.3 Trust boundaries

| Boundary | Auth |
|---|---|
| GitHub Actions → `/api/dashboard/qa/ingest` | Bearer token `QA_INGEST_TOKEN` (Cloudflare env + GH Actions secret) |
| Browser → `/api/dashboard/qa/*` | Existing session cookie + permission check (`qa.view` etc.) |
| `/api/dashboard/qa/refresh` → GitHub `repository_dispatch` API | Cloudflare-side PAT `GH_REPOSITORY_DISPATCH_TOKEN` (repo scope) |
| Python scripts → external APIs (YouTube, Blogger, Spotify HTTP) | Per-API tokens loaded from GH Actions secrets at workflow runtime |

Token rotation: quarterly for `QA_INGEST_TOKEN` and `GH_REPOSITORY_DISPATCH_TOKEN`. YouTube/Blogger tokens rotate when OAuth refresh fails.

---

## 4. Data Model

New migration: `migrations/011-qa-traceability.sql`.

### 4.1 `qa_runs`

One row per execution of the check suite (cron, manual, or single-cell dispatch).

```sql
CREATE TABLE IF NOT EXISTS qa_runs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  client_run_id   TEXT UNIQUE,                    -- idempotency key (nullable for legacy)
  started_at      TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at     TEXT,
  source          TEXT NOT NULL,            -- 'cron' | 'manual' | 'dispatch'
  triggered_by    INTEGER REFERENCES users(id),  -- nullable (cron has no user)
  total_checks    INTEGER DEFAULT 0,
  total_pass      INTEGER DEFAULT 0,
  total_fail      INTEGER DEFAULT 0,
  total_na        INTEGER DEFAULT 0,
  notes           TEXT
);
CREATE INDEX IF NOT EXISTS idx_qa_runs_started ON qa_runs(started_at DESC);
```

### 4.2 `qa_check_results`

One row per (content_code × check_type × run). Append-only.

```sql
CREATE TABLE IF NOT EXISTS qa_check_results (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id          INTEGER NOT NULL REFERENCES qa_runs(id),
  content_code    TEXT NOT NULL,            -- 'T014', 'P022', '042', 'V029', 'LA-007'
  content_kind    TEXT NOT NULL,            -- enum below
  content_title   TEXT,                     -- denormalized for display
  check_type      TEXT NOT NULL,            -- enum below
  status          TEXT NOT NULL,            -- 'pass' | 'fail' | 'na' | 'unknown'
  error_detail    TEXT,                     -- nullable; explains failure
  checked_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_qa_results_latest
  ON qa_check_results(content_code, check_type, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_results_run    ON qa_check_results(run_id);
CREATE INDEX IF NOT EXISTS idx_qa_results_status ON qa_check_results(status, checked_at DESC);
```

**`content_kind` enum** (covers everything separately registered in `metrics/content-tracker.md`):
```
tale | podcast | video | blog | tutorial | linkedin_article
```

YouTube Shorts are not a separate content_kind — they are a distribution channel of their parent video/podcast/tale and would be tracked as a 13th `check_type` column if/when we add `shorts_published` (deferred to v2).

**`content_code` conventions** (set by tracker.md, used as primary identifier here):
- `TNNN` — tale (e.g. `T014`)
- `PNNN` — podcast (e.g. `P022`)
- `VNNN` — video (e.g. `V029`)
- `LA-NNN` — LinkedIn article (e.g. `LA-007`)
- bare `NNN` zero-padded — blog/tutorial (e.g. `042`)

Codes are unique without coordination because of the prefix discipline.

**`check_type` enum** (the 12 columns):
```
in_tracker          — row exists in tracker.md, status = Published
tracker_url_valid   — passes scripts/check-tracker.py (no profile URLs)
live_url_200        — passes scripts/check-links.py (URL HEAD = 200)
watermarked         — final asset has amtocsoft:watermarked=v1 marker
youtube_uploaded    — for video/podcast/tale: video ID exists & is public
youtube_thumbnail   — custom thumbnail set (not auto-generated frame)
youtube_playlist    — added to correct playlist
spotify_live        — for podcast: real episode URL alive
blogger_live        — for blog: real post URL, post-publish image scan clean
linkedin_crosspost  — at least one LinkedIn post URL recorded
x_crosspost         — at least one tweet URL recorded
companion_repo      — for tutorial blogs (post 126+): matching dir in amtocbot-examples
```

`status` semantics: `pass` = check succeeded; `fail` = check ran and the gate is not satisfied; `na` = check doesn't apply to this content_kind; `unknown` = check couldn't be evaluated (network error, API quota, etc.).

### 4.3 `qa_acknowledgements`

Tester ack of a known failure with a reason and expiry.

```sql
CREATE TABLE IF NOT EXISTS qa_acknowledgements (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  content_code      TEXT NOT NULL,
  check_type        TEXT NOT NULL,
  acknowledged_by   INTEGER NOT NULL REFERENCES users(id),
  acknowledged_at   TEXT NOT NULL DEFAULT (datetime('now')),
  reason            TEXT NOT NULL,
  expires_at        TEXT NOT NULL,          -- default ack_at + 14 days
  cleared_at        TEXT,                   -- when superseded or manually cleared
  cleared_reason    TEXT
);
CREATE INDEX IF NOT EXISTS idx_qa_ack_active
  ON qa_acknowledgements(content_code, check_type, expires_at)
  WHERE cleared_at IS NULL;
```

An ack is "active" iff `cleared_at IS NULL AND expires_at > datetime('now')`. The eligibility query treats active acks as resolving the failure.

### 4.4 Extend existing `issues` table

Two new nullable columns let an issue link back to a specific QA cell. Existing issues unaffected.

```sql
ALTER TABLE issues ADD COLUMN qa_content_code TEXT;
ALTER TABLE issues ADD COLUMN qa_check_type   TEXT;
CREATE INDEX IF NOT EXISTS idx_issues_qa_link
  ON issues(qa_content_code, qa_check_type, status);
```

A "linked open issue" for a failing cell is `WHERE qa_content_code = :code AND qa_check_type = :check AND status IN ('open','in_progress')`.

### 4.5 `qa_weekly_signoffs`

The human gate. Unique on `week_start_date` (one signoff per ISO Monday).

```sql
CREATE TABLE IF NOT EXISTS qa_weekly_signoffs (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  week_start_date     TEXT NOT NULL UNIQUE,    -- ISO Monday: '2026-04-27'
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
  VALUES (11, 'QA traceability matrix: runs, check_results, acknowledgements, weekly_signoffs');
```

### 4.6 Storage estimate

- 600 content rows × 12 checks × 365 daily runs = 2.6M rows/year
- ~150 bytes/row → ~400 MB/year
- D1 limit 10 GB → 25 years headroom
- No retention policy in v1

---

## 5. Backend API

15 endpoints under `functions/api/dashboard/qa/`. All session-authenticated except `/ingest` which uses bearer token.

### 5.1 Endpoint table

| Method | Path | Permission | Purpose |
|---|---|---|---|
| POST | `/api/dashboard/qa/ingest` | bearer `QA_INGEST_TOKEN` | GH Actions writes a full run |
| GET | `/api/dashboard/qa/matrix` | `qa.view` | Latest snapshot. Filters: `?kind=tale&status=fail&since=...` |
| GET | `/api/dashboard/qa/todos` | `qa.view` | Risk-weighted priority list (server-computed) |
| POST | `/api/dashboard/qa/refresh` | `qa.refresh` | Triggers GH `workflow_dispatch`; returns 202 + run-tracking timestamp |
| GET | `/api/dashboard/qa/runs` | `qa.view` | List runs. `?since=...&limit=20` for polling after refresh |
| GET | `/api/dashboard/qa/runs/[id]` | `qa.view` | Single run summary |
| POST | `/api/dashboard/qa/acknowledge` | `qa.acknowledge` | Body: `{content_code, check_type, reason, expires_in_days?}` (default 14) |
| POST | `/api/dashboard/qa/acknowledge/bulk` | `qa.acknowledge` | Body: `{cells: [...], reason, expires_in_days?}` — multi-select bulk ack |
| DELETE | `/api/dashboard/qa/acknowledge/[id]` | `qa.acknowledge` | Clear an ack early |
| POST | `/api/dashboard/qa/issue-from-cell` | `qa.acknowledge` | Pre-fills `issues` row from a failed cell, returns issue id |
| GET | `/api/dashboard/qa/history/heatmap` | `qa.view` | `?days=90` → `(content_code, check_type, pct_green, sample_count)` |
| GET | `/api/dashboard/qa/history/trend` | `qa.view` | `?weeks=26` → weekly fail counts per check_type |
| GET | `/api/dashboard/qa/history/signoffs` | `qa.view` | All weekly sign-offs, newest first |
| GET | `/api/dashboard/qa/history/signoffs/[id]` | `qa.view` | The matrix snapshot as of that sign-off |
| GET | `/api/dashboard/qa/signoff/eligibility` | `qa.view` | Preflight: `{eligible: bool, blockers: [...]}` |
| POST | `/api/dashboard/qa/signoff` | `qa.signoff` | Body: `{week_start_date, notes?}`; 409 if not eligible |

### 5.2 Ingest payload contract

```json
POST /api/dashboard/qa/ingest
Authorization: Bearer <QA_INGEST_TOKEN>
Content-Type: application/json

{
  "run": {
    "started_at": "2026-04-26T06:00:00Z",
    "finished_at": "2026-04-26T06:03:42Z",
    "source": "cron",
    "notes": "612 items scanned, 7344 checks executed",
    "client_run_id": "gh-actions-run-12345"
  },
  "results": [
    {
      "content_code": "T014",
      "content_kind": "tale",
      "content_title": "The Fisherman and His Wife",
      "checks": {
        "in_tracker":         {"status": "pass"},
        "tracker_url_valid":  {"status": "pass"},
        "live_url_200":       {"status": "pass"},
        "watermarked":        {"status": "pass"},
        "youtube_uploaded":   {"status": "pass"},
        "youtube_thumbnail":  {"status": "pass"},
        "youtube_playlist":   {"status": "pass"},
        "spotify_live":       {"status": "na"},
        "blogger_live":       {"status": "na"},
        "linkedin_crosspost": {"status": "fail", "error_detail": "no LinkedIn URL recorded"},
        "x_crosspost":        {"status": "fail", "error_detail": "no X URL recorded"},
        "companion_repo":     {"status": "na"}
      }
    }
  ]
}
```

**Atomicity:** D1 `db.batch([...])` has a per-call statement cap (~50). To insert ~7,200 results, the ingest endpoint chunks into multi-row INSERT statements (`VALUES (...), (...), ...` with up to 100 rows per statement → ~75 statements → 2 batches). The `qa_runs` row is inserted first in its own batch and its `id` referenced by subsequent batches; if any subsequent batch fails, the run is marked `finished_at = NULL` and the orchestrator retries. **Idempotency:** `qa_runs.client_run_id` is added as a UNIQUE column; duplicate POSTs return 200 with the existing `run_id` and skip result inserts.

**Validation rules:**
- `run.source` ∈ `{cron, manual, dispatch}`; reject 422 otherwise
- Every `check_type` in `checks` must be in the 12-value enum
- Every `status` must be in `{pass, fail, na, unknown}`
- `content_kind` must be in the 7-value enum
- `error_detail` required when `status` ∈ `{fail, unknown}`; ignored otherwise

### 5.3 Permission additions

Modify `functions/api/_shared/auth.ts` PERMISSION_MAP:

```typescript
const PERMISSION_MAP = {
  // ...existing entries unchanged...
  'qa.view':        ['admin', 'superadmin', 'tester', 'approver', 'reviewer'],
  'qa.acknowledge': ['admin', 'superadmin', 'tester'],
  'qa.signoff':     ['admin', 'superadmin', 'tester'],
  'qa.refresh':     ['admin', 'superadmin', 'tester'],
};
```

### 5.4 Risk-weighted todo list (priority logic)

8 tiers, returned as a single sorted list (max 200 items):

1. **Regressions** — was ✓ in last sign-off snapshot, ✗ in latest run
2. **Live URL 404s** on published items
3. **Tracker URL violations** on rows marked Published
4. **Missing watermarks** on published assets
5. **Missing primary-platform listings** (no YouTube for tale/podcast/video; no Blogger for blog)
6. **Missing secondary-platform cross-posts** (LinkedIn, X)
7. **Acknowledged-but-stale** (active ack > 14 days old, still red)
8. **Never-been-green > 7 days old**

Each todo: `{priority_tier, content_code, content_kind, content_title, check_type, last_error, last_known_good_at, suggested_action, existing_ack_id?, existing_issue_id?}`.

### 5.5 Sign-off eligibility

A signoff is **eligible** iff ALL of the following hold for the latest run:

1. **Every `fail` row is addressed** — for each `qa_check_results` row in the latest run with `status='fail'`, there exists at least one of:
   - An active `qa_acknowledgements` entry (`cleared_at IS NULL AND expires_at > now`), OR
   - A linked open `issues` row (`qa_content_code` and `qa_check_type` match, `status IN ('open','in_progress')`).

2. **Every regression is freshly addressed** — for each cell that was `pass` in the previous sign-off's `based_on_run_id` snapshot but is `fail` in the latest run, the addressing record (ack or issue) must have been created **after** the previous sign-off's `signed_at`. This forces the tester to take a new action on each regression rather than relying on a pre-existing ack.

3. **`unknown` rows do not block** — `unknown` is treated as "check skipped" and does not require addressing. (If they pile up, the monitoring alerts will surface a stuck check.)

`POST /qa/signoff` re-runs eligibility server-side and returns 409 with the blocker list if anything slipped between page-load and click.

### 5.6 Bulk acknowledgement

Because the first run will surface every pre-existing failure (potentially 100+), the matrix view supports multi-select + bulk-ack: select rows by checkbox, click "Acknowledge selected" → one reason text + one expiry applies to all. Server endpoint: `POST /api/dashboard/qa/acknowledge/bulk` body `{cells: [{content_code, check_type}], reason, expires_in_days}`. Same permission as single-cell ack. Audit log gets one event per cell.

---

## 6. Frontend (Tester tab)

New component tree under `src/app/features/dashboard/qa-tab/`:

```
qa-tab/
├── qa-tab.component.ts          ← shell, 3 sub-tabs
├── qa-tab.service.ts            ← HttpClient client for /api/dashboard/qa/*
├── qa-matrix-view/
│   ├── qa-matrix-view.component.ts
│   └── qa-cell-popover.component.ts
├── qa-todos-view/
│   └── qa-todos-view.component.ts
├── qa-history-view/
│   ├── qa-history-view.component.ts
│   ├── qa-heatmap.component.ts
│   ├── qa-trend-chart.component.ts
│   └── qa-signoff-log.component.ts
└── qa-signoff-dialog.component.ts
```

### 6.1 Sub-tab 1 — Live Matrix (default)

Sticky-row Material table. Columns: 12 checks. Rows: every content piece with at least one check result in latest run.

**Cell encoding:**
- ✓ green / ✗ red / – grey (N/A) / ? amber (unknown)
- `✗!` red border + bold = regression vs last sign-off
- ✗ with ⓘ = acknowledged (hover shows reason + expiry)
- ✗ with 🔗 = linked to open issue (click jumps to issue)

**Filter bar:**
- Content kind chips (multi-select): `tale`, `podcast`, `video`, `blog`, `tutorial`, `linkedin_article`, `short`
- Status: `All` / `Failures only` / `Regressions only` / `N/A only`
- Date range (last run vs. specific past run via dropdown)

**Header bar:**
- "Refresh" button (calls `/qa/refresh`, polls until new run lands)
- Last-run summary: `06:00 · 612 items · 7,344 checks · 23 fail`
- "Sign Off Week" button (gated on eligibility)
- Selection toolbar (when ≥1 row checkbox selected): "Acknowledge selected" + count badge

**Cell click → popover:**
```
T013 · live_url_200
Last error: 503 Service Unavailable (checked 06:01)
Last known good: 2026-04-19 06:00 (7 days ago)

[ Acknowledge → reason: ___ for ___ days ]
[ File Issue → pre-fill content_id=T013, type=quality, severity=high ]
[ Re-run check just for this cell ]
[ View 90-day history → ]
```

### 6.2 Sub-tab 2 — Todo List

Risk-weighted, refreshes when matrix refreshes. 8 collapsible tiers; empty tiers hidden. Each row has one-click `Ack`, `Issue`, `Re-run`.

```
⚠ REGRESSIONS (3)
   T013  live_url_200  was ✓ 2026-04-19 → ✗ today
         503 Service Unavailable                  [Ack][Issue][Re-run]
   ...

🔴 LIVE URL 404s (1)
   V015  live_url_200  YouTube URL returns 404
                                                  [Ack][Issue][Re-run]
... (8 tiers total)
```

### 6.3 Sub-tab 3 — History

Three sub-sub-tabs:

**(a) Heatmap** — `Content × Check_type` grid. Cell color = % green over last 90 days (red = 0%, green = 100%). Click cell → 90-day timeline modal (line: pass=1, fail=0, na=null gap, unknown=amber dot).

**(b) Trend Chart** — Line chart, x-axis = week (last 26 weeks), one line per `check_type`, y-axis = fail count. Hover lists failing content_codes for that week. Powered by `ngx-charts`.

**(c) Sign-off Log** — Material table:

```
Week         Signed by    Regressions  Persistent  New Green  Actions
2026-04-21   tester01     0            2           1          [View snapshot]
2026-04-14   tester01     1            3           0          [View snapshot]
```

Drill-through "View snapshot" loads the matrix as of `based_on_run_id` (read-only banner: *"Snapshot: week of 2026-04-14"*).

### 6.4 Sign-off Week dialog

**Eligible state:**
```
Sign off week of 2026-04-27?

Summary (latest run, 06:00):
  Steady green:     584
  New green:          3   (regressions resolved since last week)
  Persistent fail:    2   (acknowledged)
  Regressions:        0

Notes (optional): ___________________________

[ Confirm sign-off ]  [ Cancel ]
```

**Blocked state:**
```
Cannot sign off — 4 items need attention:

  ✗ T013  live_url_200    regression — not addressed
  ✗ V015  live_url_200    fail — no ack, no linked issue
  ✗ 042   watermarked     regression — not addressed
  ✗ P022  spotify_live    fail — no ack, no linked issue

[ Go to Todo list ]  [ Cancel ]
```

### 6.5 Refresh flow (UI)

1. User clicks "Refresh"
2. UI POSTs `/api/dashboard/qa/refresh` → 202 `{tracking_run_after: "2026-04-26T14:30:00Z"}`
3. UI shows progress: *"Running checks via GitHub Actions… ~2-3 min"*
4. UI polls `/api/dashboard/qa/runs?since=<tracking_run_after>` every 5s
5. New run with `finished_at` not null appears → stop polling, refetch matrix
6. After 5 min: progress message changes to *"Still running, this is taking longer than usual…"*
7. After 16 min (matches GH Actions workflow timeout 15 min + 1 min slack): show *"GH Actions check timed out — see [Actions tab](https://github.com/amtocbot-droid/amtocsoft-content/actions)"* with a "Try again" button

### 6.6 Permission gating

```typescript
canAck     = computed(() => this.auth.hasPermission('qa.acknowledge'));
canSignoff = computed(() => this.auth.hasPermission('qa.signoff'));
canRefresh = computed(() => this.auth.hasPermission('qa.refresh'));
```

Buttons hidden / disabled when permission false. Approver and reviewer see read-only matrix + history.

---

## 7. Check execution (Python suite + GH Actions)

### 7.1 Files added to `amtocsoft-content/`

```
scripts/
├── qa-suite.py                ← orchestrator
└── qa-checks/
    ├── __init__.py
    ├── content_inventory.py   ← parse tracker.md → list of content rows
    ├── tracker_checks.py      ← in_tracker, tracker_url_valid, live_url_200
    ├── watermark_checks.py    ← watermarked
    ├── youtube_checks.py      ← youtube_uploaded, youtube_thumbnail, youtube_playlist
    ├── spotify_checks.py      ← spotify_live
    ├── blogger_checks.py      ← blogger_live
    ├── linkedin_checks.py     ← linkedin_crosspost
    ├── x_checks.py            ← x_crosspost
    └── github_checks.py       ← companion_repo

.github/workflows/
└── qa-suite.yml               ← cron + workflow_dispatch
```

### 7.2 Each check module returns a uniform shape

```python
def check_live(item: dict) -> dict:
    """Returns:
        {'status': 'pass'}
        {'status': 'fail', 'error_detail': 'why'}
        {'status': 'na'}
        {'status': 'unknown', 'error_detail': 'why we couldn't evaluate'}
    """
```

Mirrors the ingest API contract exactly — orchestrator just wraps them in the cell map.

### 7.3 `qa-suite.py` CLI

```bash
python3 scripts/qa-suite.py                       # run all, post to dashboard
python3 scripts/qa-suite.py --dry-run             # print payload, don't post
python3 scripts/qa-suite.py --kind tale           # filter by content kind
python3 scripts/qa-suite.py --code T014           # single content piece
python3 scripts/qa-suite.py --check-only live_url_200 --code T014  # single cell
python3 scripts/qa-suite.py --offline             # skip network checks (CI smoke)
```

Env vars: `QA_INGEST_URL`, `QA_INGEST_TOKEN`, `QA_SOURCE` (set by workflow).

### 7.4 GH Actions workflow

```yaml
name: QA Suite

on:
  schedule:
    - cron: '0 6 * * *'      # 06:00 UTC daily
  workflow_dispatch:
    inputs:
      kind:        { required: false }
      code:        { required: false }
      check_only:  { required: false }

jobs:
  run-suite:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.11', cache: 'pip' }
      - run: pip install -r scripts/requirements.txt
      - name: Decrypt OAuth tokens
        run: |
          mkdir -p ~/.config/amtocsoft
          echo "$YOUTUBE_TOKEN_JSON" > ~/.config/amtocsoft/youtube_token.json
          echo "$BLOGGER_TOKEN_JSON" > ~/.config/amtocsoft/blogger_token.json
          echo "$YT_CLIENT_SECRETS"  > ~/.config/amtocsoft/client_secrets.json
        env:
          YOUTUBE_TOKEN_JSON: ${{ secrets.YOUTUBE_TOKEN_JSON }}
          BLOGGER_TOKEN_JSON: ${{ secrets.BLOGGER_TOKEN_JSON }}
          YT_CLIENT_SECRETS:  ${{ secrets.YT_CLIENT_SECRETS }}
      - name: Run QA suite
        env:
          QA_INGEST_URL:   ${{ secrets.QA_INGEST_URL }}
          QA_INGEST_TOKEN: ${{ secrets.QA_INGEST_TOKEN }}
          QA_SOURCE:       ${{ github.event_name == 'schedule' && 'cron' || 'dispatch' }}
        run: |
          python3 scripts/qa-suite.py \
            ${{ inputs.kind && format('--kind {0}', inputs.kind) || '' }} \
            ${{ inputs.code && format('--code {0}', inputs.code) || '' }} \
            ${{ inputs.check_only && format('--check-only {0}', inputs.check_only) || '' }}
      - if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: qa-suite-debug-${{ github.run_id }}
          path: /tmp/qa-suite-*.log
```

### 7.5 Secrets

| Secret | Lives in | Used by | Rotation |
|---|---|---|---|
| `QA_INGEST_TOKEN` | GH Actions + Cloudflare Pages env | both | quarterly |
| `QA_INGEST_URL` | GH Actions | qa-suite.py | n/a |
| `YOUTUBE_TOKEN_JSON` | GH Actions | youtube_checks.py | on OAuth expiry |
| `BLOGGER_TOKEN_JSON` | GH Actions | blogger_checks.py | on OAuth expiry |
| `YT_CLIENT_SECRETS` | GH Actions | OAuth refresh | on client rotation |
| `GH_REPOSITORY_DISPATCH_TOKEN` | Cloudflare Pages env | `/qa/refresh` endpoint | quarterly |

### 7.6 Failure handling in orchestrator

| Scenario | Behavior |
|---|---|
| YouTube API quota exceeded mid-run | `status: 'unknown'` for remaining yt checks; run continues |
| Single content row malformed in tracker | Item skipped with warning; not reported as failure |
| Network outage during entire run | All HTTP checks → `unknown`; orchestrator still posts (with notes describing) |
| Ingest endpoint 5xx | Retry 3× with exponential backoff; on final failure, dump payload to artifact, exit 1 |

---

## 8. Operations & Rollout

### 8.1 Phased rollout

| Phase | Lands | Gate to next phase |
|---|---|---|
| 1. Schema | migration 011 applied to D1 prod (4 new tables + 2 issues columns) | `.schema qa_check_results` returns table; `PRAGMA table_info(issues)` shows new columns |
| 2. Backend read-path | permission map updated; `/qa/ingest`, `/qa/matrix`, `/qa/runs`, `/qa/runs/[id]` deployed; bearer token in env | curl POST to `/qa/ingest` writes 1 run + N results; GET `/qa/matrix` returns them |
| 3. Backend write-path | `/qa/acknowledge*`, `/qa/issue-from-cell`, `/qa/signoff*`, `/qa/history/*`, `/qa/refresh`, `/api/cron/qa-monitors` | All endpoints respond with permission-correct responses for tester / approver / reviewer |
| 4. Python suite local | `qa-suite.py` + per-check modules in amtocsoft-content | `python3 scripts/qa-suite.py` from a laptop posts real run; matrix endpoint returns sane data; verified by reading 3-5 rows |
| 5. GH Actions cron | `.github/workflows/qa-suite.yml` enabled; secrets configured | Two consecutive 06:00 UTC runs land without intervention (gate takes 2 days — acceptable; phase 6 can prep in parallel) |
| 6. Frontend Tester tab | Angular components shipped behind `qa.view` permission | Tester logs in, sees matrix populated, ack works, sign-off gates correctly, history populated for at least 1 run |

Each phase independently revertible. Schema migration is forward-only but tables can be left empty (and `issues.qa_*` columns left NULL) if phases 2-6 are reverted. Phases 5 and 6 may proceed in parallel since the frontend can be developed against fixture data.

### 8.2 Backfill strategy

**No retroactive backfill.** First GH Actions run = the backfill. Reasons:

- Reconstructing pre-rollout state from old commits is high-effort, low-value (inferred, not measured)
- History view starts accumulating from day 1 of phase 4; after 90 days the heatmap is fully meaningful
- Pre-existing failures surface as `fail` on first run, get acknowledged with reason "pre-existing" or filed as issues — correct behavior

### 8.3 Monitoring & alerting

New endpoint `/api/cron/qa-monitors` triggered by Cloudflare Cron Trigger every 6h. Uses existing Brevo email integration.

| Alert | Condition | Action |
|---|---|---|
| **No run in 36h** | latest `qa_runs.finished_at` > 36h ago | Email `hello@amtocbot.com` |
| **Ingest 5xx errors** | >3 ingest 5xx in audit_logs in 24h | Same |
| **Stale blockers** | eligibility query returns >10 blockers for >7 days | Same |

### 8.4 Performance budget

| Metric | Budget | Measurement |
|---|---|---|
| Full GH Actions run | <10 min | Workflow timeout 15 min |
| Single ingest POST | <5s | CF Worker p95 on `/qa/ingest` |
| Matrix render (612×12) | <300ms | Angular OnPush + virtual scroll |
| History heatmap query | <1s | Indexed `GROUP BY` on 90-day window |
| Trend chart query | <1s | Indexed weekly aggregation |

### 8.5 Cost

**Net new: $0/month.**

- D1: 400 MB/year < 5 GB free tier
- D1 reads: 360K/day < 5M/day free tier
- GH Actions: 150 min/month < 2000 min/month free tier (public) or 3000 min/month (Pro)
- Brevo: <10 emails/month (existing tier)

### 8.6 Rollback playbook

| Phase | Rollback |
|---|---|
| 1 | Drop 4 tables; remove `qa_*` columns from `issues`; remove version 11 from `schema_version` |
| 2 | Deploy previous commit; bearer env can stay (harmless without endpoint) |
| 3 | Deploy previous commit (write endpoints removed); read-path stays functional |
| 4 | Stop running the script (no remote impact) |
| 5 | Disable workflow in GH Actions UI; cron stops; no Pages-side impact |
| 6 | Flip `qa.view` permission off in DB → tab disappears for all users until re-enabled |

### 8.7 Documentation deliverables

| File | Purpose |
|---|---|
| `docs/qa-traceability.md` (amtocbot-site) | Tester-facing: how to use the matrix, what each check means |
| `docs/qa-runbook.md` (amtocbot-site) | Ops-facing: debug failed runs, rotate tokens, add a new check_type |
| `CLAUDE.md` (amtocbot-site) | Add "QA Traceability Matrix" section |
| `CLAUDE.md` (amtocsoft-content) | Add `qa-suite.py --dry-run` to publishing checklist |

### 8.8 Audit logging

Every write writes to existing `audit_logs`:

- `qa.acknowledge` — `detail: {content_code, check_type, reason, expires_at}`
- `qa.acknowledge_clear` — `detail: {acknowledgement_id, reason}`
- `qa.signoff` — `detail: {week_start_date, run_id, counts}`
- `qa.refresh_triggered` — `detail: {dispatch_id}`
- `qa.ingest` — `detail: {run_id, total_checks, total_fail}` (system actor, user_id sentinel)

The existing Audit Log tab automatically surfaces QA activity — no new audit infra.

---

## 9. Critical files summary

### `amtocbot-site` (Angular + Pages Functions)

```
migrations/011-qa-traceability.sql                                       (new — 4 new tables + 2 issues columns)
schema.sql                                                              (update — mirror migration)
functions/api/_shared/auth.ts                                           (update — add 4 perms)
functions/api/dashboard/qa/_shared.ts                                    (new — types)
functions/api/dashboard/qa/ingest.ts                                     (new)
functions/api/dashboard/qa/matrix.ts                                     (new)
functions/api/dashboard/qa/todos.ts                                      (new)
functions/api/dashboard/qa/refresh.ts                                    (new)
functions/api/dashboard/qa/runs/index.ts                                 (new)
functions/api/dashboard/qa/runs/[id].ts                                  (new)
functions/api/dashboard/qa/acknowledge/index.ts                          (new)
functions/api/dashboard/qa/acknowledge/bulk.ts                           (new)
functions/api/dashboard/qa/acknowledge/[id].ts                           (new)
functions/api/dashboard/qa/issue-from-cell.ts                            (new)
functions/api/dashboard/qa/history/heatmap.ts                            (new)
functions/api/dashboard/qa/history/trend.ts                              (new)
functions/api/dashboard/qa/history/signoffs/index.ts                     (new)
functions/api/dashboard/qa/history/signoffs/[id].ts                      (new)
functions/api/dashboard/qa/signoff/eligibility.ts                        (new)
functions/api/dashboard/qa/signoff/index.ts                              (new)
functions/api/cron/qa-monitors.ts                                        (new)
src/app/features/dashboard/dashboard.component.ts                        (update — add tab)
src/app/features/dashboard/qa-tab/qa-tab.component.ts                    (new)
src/app/features/dashboard/qa-tab/qa-tab.service.ts                      (new)
src/app/features/dashboard/qa-tab/qa-matrix-view/*                       (new — 2 files)
src/app/features/dashboard/qa-tab/qa-todos-view/*                        (new — 1 file)
src/app/features/dashboard/qa-tab/qa-history-view/*                      (new — 4 files)
src/app/features/dashboard/qa-tab/qa-signoff-dialog.component.ts         (new)
docs/qa-traceability.md                                                  (new)
docs/qa-runbook.md                                                       (new)
CLAUDE.md                                                                (update)
wrangler.toml                                                            (update — cron trigger)
```

### `amtocsoft-content` (Python + GH Actions)

```
scripts/qa-suite.py                                                      (new)
scripts/qa-checks/__init__.py                                            (new)
scripts/qa-checks/content_inventory.py                                   (new)
scripts/qa-checks/tracker_checks.py                                      (new)
scripts/qa-checks/watermark_checks.py                                    (new)
scripts/qa-checks/youtube_checks.py                                      (new)
scripts/qa-checks/spotify_checks.py                                      (new)
scripts/qa-checks/blogger_checks.py                                      (new)
scripts/qa-checks/linkedin_checks.py                                     (new)
scripts/qa-checks/x_checks.py                                            (new)
scripts/qa-checks/github_checks.py                                       (new)
scripts/requirements.txt                                                 (update — add deps)
.github/workflows/qa-suite.yml                                           (new)
CLAUDE.md                                                                (update)
```

---

## 10. Acceptance criteria

The feature is **done** when:

1. Migration 011 is applied to D1 prod and verified (4 new tables + 2 columns on `issues`).
2. A tester logged in to `/dashboard` sees the **Tester** tab.
3. The matrix populates from a successful GH Actions cron run within 24h of phase 5 going live.
4. The tester can:
   - Acknowledge a failed cell with a reason and 14-day default expiry.
   - File an issue from a failed cell, populated with content + error context.
   - View the prioritized todo list in 8 risk tiers.
   - View the 90-day heatmap, 26-week trend chart, and sign-off log.
   - Click "Refresh" → see a new run land within 5 min.
   - Click "Sign Off Week" → confirm dialog shows correct counts → record persisted in `qa_weekly_signoffs`.
5. Sign-off is **blocked** when any latest-run failure lacks an active ack and an open issue, OR when any regression vs. previous sign-off is unaddressed.
6. An approver or reviewer logged in sees the matrix read-only — no write buttons visible.
7. The Audit Log tab shows a row for every ack, sign-off, refresh, and ingest event.
8. Two consecutive 06:00 UTC GH Actions runs land without manual intervention.
9. Cloudflare Cron monitor fires an email on a simulated 36h-no-run condition.
10. `python3 scripts/qa-suite.py --dry-run --code T014` from amtocsoft-content prints a valid ingest payload locally (CI smoke test).
11. Bulk acknowledge: tester selects 5 rows, applies one ack reason; 5 audit-log rows recorded; eligibility query treats all 5 as addressed.
12. UI refresh from a tester's browser triggers a `workflow_dispatch` and the new run appears within 5 minutes (or shows the long-running message after 5 min, then the timeout state at 16 min).
