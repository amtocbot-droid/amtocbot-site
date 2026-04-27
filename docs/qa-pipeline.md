# QA Pipeline Documentation

> **Repo:** `amtocbot-site` (dashboard + backend)  
> **Content repo:** `amtocsoft-content` (Python QA suite + GitHub Actions)  
> Last updated: 2026-04-26

---

## Overview

The QA Traceability pipeline runs automated checks across all published content, stores results in Cloudflare D1, exposes them through a real-time dashboard, and alerts when the suite goes stale.

```
amtocsoft-content (content repo)
  └── scripts/qa-suite.py         ← runs checks against real URLs
        │
        └── POST /api/dashboard/qa/ingest   ← pushes results to D1 (bearer token)

amtocbot-site (dashboard)
  ├── D1: qa_runs + qa_check_results + qa_acknowledgements + qa_weekly_signoffs
  ├── /api/dashboard/qa/*         ← read endpoints (session auth)
  ├── /api/dashboard/qa/monitor   ← public health check (no auth)
  └── /api/dashboard/qa/alert     ← staleness alert email (bearer token)

GitHub Actions (amtocsoft-content)
  ├── qa-suite.yml                ← runs the suite daily at 06:00 UTC
  └── qa-monitor.yml              ← polls /monitor every 6h; sends alert on 503
```

---

## Database Schema

Four tables in the `engage-db` D1 database (created in migration `004`):

| Table | Purpose |
|---|---|
| `qa_runs` | One row per QA suite execution |
| `qa_check_results` | One row per (run × content item × check type) |
| `qa_acknowledgements` | Active "known issue" acknowledgements |
| `qa_weekly_signoffs` | Approved weekly QA sign-offs |

### Check types

| Check type | What it tests |
|---|---|
| `in_tracker` | Content row exists in `content-tracker.md` |
| `tracker_url_valid` | Tracker URL is a real post URL (not a profile link) |
| `live_url_200` | Published URL returns HTTP 200 |
| `watermarked` | Final asset has the `amtocbot.com • amtocsoft.com` watermark |
| `youtube_uploaded` | YouTube video exists for the content |
| `youtube_thumbnail` | Custom thumbnail is set |
| `youtube_playlist` | Video is in the correct playlist |
| `spotify_live` | Spotify episode is live |
| `blogger_live` | Blogger post is published and accessible |
| `linkedin_crosspost` | LinkedIn post URL is recorded |
| `x_crosspost` | X/Twitter post URL is recorded |
| `companion_repo` | Tutorial has a matching directory in `amtocbot-examples` |

---

## Running the QA Suite

### Automatic (daily)

`qa-suite.yml` runs at **06:00 UTC** every day via a scheduled cron trigger. Results are
automatically ingested to the dashboard.

### Manual trigger (GitHub Actions)

1. Go to **amtocsoft-content** → Actions → **QA Suite** → **Run workflow**
2. Optional inputs:
   - `kind` — filter to one content kind (e.g. `tale`, `blog`)
   - `code` — run against a single content code (e.g. `T001`, `V042`)
   - `check_only` — run a single check type (e.g. `live_url_200`)

### Local run

```bash
cd /Users/amtoc/amtocsoft-content

# Full suite
QA_INGEST_URL=https://amtocbot.com/api/dashboard/qa/ingest \
QA_INGEST_TOKEN=<from .dev.vars> \
python3 scripts/qa-suite.py

# Single content item
python3 scripts/qa-suite.py --code T001

# Single check type
python3 scripts/qa-suite.py --check-only live_url_200
```

---

## Dashboard UI

Route: `/dashboard` → **QA Traceability** tab

### Sub-tabs

| Tab | Content |
|---|---|
| **Matrix** | Full check-type × content-item grid. Colour-coded by status. Click any cell to view error detail or file an acknowledgement. |
| **Priority Fixes** | Left: tiered todo list of failing checks. Right: weekly sign-off panel. |
| **History** | Line chart of pass/fail/n-a trend (last 30 runs). Heatmap of fail density by check type × week (last 8 weeks). |

### Run selector

The **Run** dropdown at the top lets you view any of the last 20 completed runs. Select "Latest" (default) to always show the most recent run.

### Kind filter

Filter the matrix to a single content kind (tale, podcast, video, blog, tutorial, linkedin_article).

---

## Acknowledgements

An acknowledgement marks a known failing check as "handled" so it stops appearing in the Priority Fixes todo list.

**Who can acknowledge:** users with the `qa.acknowledge` permission (admin, approver roles).

**How to file:**
1. In the Matrix tab, click on a red/amber cell.
2. The acknowledgement dialog shows the current error, any existing ack, and a form.
3. Enter a reason and choose an expiry (7 / 14 / 30 / 90 days).
4. Click **Acknowledge**.

**Expiry:** When the expiry passes, the ack is no longer active. If the check is still failing, the item reappears in the todo list at tier 7 ("Acknowledged-but-stale").

**Auto-clear:** If the check passes in a subsequent run, the acknowledgement is automatically cleared.

---

## Weekly Sign-Off

The sign-off confirms that the current QA state has been reviewed by a human.

**Who can sign off:** users with the `qa.signoff` permission (admin, approver roles).

**Eligibility rules (checked server-side):**
- A completed run must exist.
- No more than 10% of checks may be failing (pass rate ≥ 90%).
- No tier-1 (regression) failures.
- No sign-off already exists based on the same run.

**Sign-off location:** Priority Fixes tab → right panel.

**Effect:** Establishes the "last known good" baseline. Future regressions are detected by comparing the next run's fails against the run that was signed off.

---

## Priority Tiers

The todo list ranks failing checks into 8 tiers:

| Tier | Label | Condition |
|---|---|---|
| 1 | Regressions | Was passing at last sign-off, now failing |
| 2 | Live URL 404s | `live_url_200` check failing |
| 3 | Tracker URL violations | `tracker_url_valid` check failing |
| 4 | Missing watermarks | `watermarked` check failing |
| 5 | Missing primary platform | Primary platform check failing for content kind |
| 6 | Missing secondary cross-posts | `linkedin_crosspost` or `x_crosspost` failing |
| 7 | Acknowledged-but-stale | Ack exists but is >14 days old |
| 8 | Never-been-green >7d | No pass ever recorded; fail older than 7 days |

Freshly-acknowledged failures (tier 7 ack <14d) and brand-new failures (<7d, never passed) are suppressed to avoid noise.

---

## Manual Refresh (Dashboard → Trigger Suite)

The **Run QA Now** button in the dashboard (requires `qa.refresh` permission) dispatches a `workflow_dispatch` event to the `QA Suite` GitHub Actions workflow via the `GH_REPOSITORY_DISPATCH_TOKEN` Cloudflare Pages secret.

Endpoint: `POST /api/dashboard/qa/refresh` (session auth, `qa.refresh` permission).

---

## Staleness Monitoring & Alerts

`qa-monitor.yml` runs every 6 hours and:
1. Calls `GET /api/dashboard/qa/monitor` (public, no auth).
2. If the response is **200** (healthy) — no action.
3. If the response is **503** (no run in 36h) — calls `POST /api/dashboard/qa/alert` with the bearer token. This sends a Brevo transactional email to `amtocbot@gmail.com`.

### Manual alert test

Trigger `qa-monitor.yml` via **Run workflow** with `force_alert = true`. This sends the alert email regardless of monitor status — useful for verifying the Brevo integration.

---

## Secrets & Environment Variables

| Secret | Where | Purpose |
|---|---|---|
| `QA_INGEST_TOKEN` | Cloudflare Pages + GitHub Actions (`amtocsoft-content`) | Authenticates ingest and alert endpoints |
| `QA_INGEST_URL` | GitHub Actions (`amtocsoft-content`) | Ingest endpoint URL |
| `GH_REPOSITORY_DISPATCH_TOKEN` | Cloudflare Pages | Dispatches GH Actions `workflow_dispatch` |
| `BREVO_API_KEY` | Cloudflare Pages | Sends alert emails via Brevo |
| `YOUTUBE_TOKEN_JSON` | GitHub Actions (`amtocsoft-content`) | YouTube credential for `youtube_uploaded` check |

---

## API Endpoints

All dashboard endpoints require the `dashboard.view` session permission unless noted.

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/dashboard/qa/ingest` | POST | Bearer | Ingest a QA suite run |
| `/api/dashboard/qa/runs` | GET | Session | List recent runs |
| `/api/dashboard/qa/matrix` | GET | Session | Matrix data for a run |
| `/api/dashboard/qa/todos` | GET | Session | Priority todo list |
| `/api/dashboard/qa/signoff/eligibility` | GET | Session | Sign-off eligibility check |
| `/api/dashboard/qa/signoff` | POST | Session (`qa.signoff`) | Create a weekly sign-off |
| `/api/dashboard/qa/acknowledge` | POST | Session (`qa.acknowledge`) | Acknowledge a failing check |
| `/api/dashboard/qa/refresh` | POST | Session (`qa.refresh`) | Trigger GH Actions suite run |
| `/api/dashboard/qa/monitor` | GET | **Public** | Health check (200/503) |
| `/api/dashboard/qa/alert` | POST | Bearer | Send staleness alert email |
| `/api/dashboard/qa/history/trend` | GET | Session | Pass/fail/n-a trend (last N runs) |
| `/api/dashboard/qa/history/heatmap` | GET | Session | Fail heatmap (last N weeks) |
