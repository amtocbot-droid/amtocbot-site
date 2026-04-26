# QA Traceability Matrix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a tester-facing dashboard page that renders a traceability matrix of every published content piece against 12 publish/QA gates, with a risk-weighted prioritized todo list, weekly human sign-off, regression detection, and historical analytics.

**Architecture:** Two-repo system. `amtocbot-site` (Angular 19 + Cloudflare Pages Functions + D1) hosts the dashboard view layer + write layer. `amtocsoft-content` (Python + GitHub Actions) runs the actual checks on a daily cron + on-demand. GH Actions POSTs results via bearer-token-auth to a `/api/dashboard/qa/ingest` endpoint. D1 stores snapshots forever (~400MB/year, 25 years of headroom).

**Tech Stack:** Angular 21.2, Angular Material, Cloudflare Pages Functions (TypeScript), D1 (SQLite), Python 3.11, GitHub Actions, ngx-charts (or @swimlane/ngx-charts equivalent), Brevo for email alerts.

**Source spec:** `docs/superpowers/specs/2026-04-25-qa-traceability-matrix-design.md`

**Repos:**
- `/Users/amtoc/amtocbot-site/` — primary
- `/Users/amtoc/amtocsoft-content/` — Python check suite

---

## Phase Boundaries

The 7 phases below are commit checkpoints. After each phase, the system is independently testable:

| Phase | Tasks | Independent verification |
|---|---|---|
| 1. Schema | T1–T5 | `wrangler d1 execute --command ".schema qa_check_results"` returns table |
| 2. Backend read-path | T6–T16 | `curl -X POST .../qa/ingest` writes; `curl .../qa/matrix` reads |
| 3. Backend write-path | T17–T35 | Each write endpoint round-trips via curl; permissions correct |
| 4. Python check suite | T36–T52 | `python3 scripts/qa-suite.py --dry-run --code T014` prints valid payload |
| 5. GH Actions cron | T53–T60 | Two consecutive 06:00 UTC runs land without intervention |
| 6. Frontend Tester tab | T61–T80 | Tester logs in, sees matrix populated, full flow works |
| 7. Docs + monitoring | T81–T85 | Brevo email fires on simulated 36h-no-run; runbook usable |

Stop and review after each phase boundary.

---

## Phase 1 — Schema Migration

Adds 4 new D1 tables + 2 columns to `issues`. All idempotent (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ADD COLUMN`).

### Task 1: Write the migration SQL file

**Files:**
- Create: `/Users/amtoc/amtocbot-site/migrations/011-qa-traceability.sql`

- [ ] **Step 1: Write the migration**

Create the file with this exact content:

```sql
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
```

- [ ] **Step 2: Verify the file exists with correct content**

Run: `wc -l /Users/amtoc/amtocbot-site/migrations/011-qa-traceability.sql`
Expected: ~80 lines.

- [ ] **Step 3: Commit**

```bash
cd /Users/amtoc/amtocbot-site
git add migrations/011-qa-traceability.sql
git commit -m "feat(qa): add migration 011 for traceability matrix tables"
```

---

### Task 2: Mirror migration in schema.sql

**Files:**
- Modify: `/Users/amtoc/amtocbot-site/schema.sql` — append the new table DDL at the bottom

- [ ] **Step 1: Read current schema.sql tail**

Run: `tail -20 /Users/amtoc/amtocbot-site/schema.sql`
Expected: see existing tables; the file should end with the most recent migration's contents.

- [ ] **Step 2: Append new tables**

Append the same 4 CREATE TABLE statements + the 2 ALTER TABLE statements + indexes from `migrations/011-qa-traceability.sql` to the bottom of `schema.sql`. Do NOT include the `INSERT INTO schema_version` line (that's migration-only).

- [ ] **Step 3: Verify**

Run: `grep -c "CREATE TABLE IF NOT EXISTS qa_" /Users/amtoc/amtocbot-site/schema.sql`
Expected: `4`

- [ ] **Step 4: Commit**

```bash
git add schema.sql
git commit -m "feat(qa): mirror migration 011 in schema.sql"
```

---

### Task 3: Apply migration to local D1

**Files:** none

- [ ] **Step 1: Apply locally**

Run:
```bash
cd /Users/amtoc/amtocbot-site
npx wrangler d1 execute engage-db --local --file=migrations/011-qa-traceability.sql
```
Expected: 4 CREATE statements + 2 ALTER + 4 CREATE INDEX + 1 INSERT executed without error.

- [ ] **Step 2: Verify schema**

Run:
```bash
npx wrangler d1 execute engage-db --local --command ".schema qa_check_results"
```
Expected: prints the qa_check_results table DDL.

Run:
```bash
npx wrangler d1 execute engage-db --local --command "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'qa_%'"
```
Expected: 4 rows: `qa_acknowledgements`, `qa_check_results`, `qa_runs`, `qa_weekly_signoffs`.

- [ ] **Step 3: Verify issues columns**

Run:
```bash
npx wrangler d1 execute engage-db --local --command "PRAGMA table_info(issues)" | grep qa_
```
Expected: 2 rows with `qa_content_code` and `qa_check_type`.

---

### Task 4: Apply migration to production D1

**Files:** none

- [ ] **Step 1: Apply to prod**

Run:
```bash
cd /Users/amtoc/amtocbot-site
npx wrangler d1 execute engage-db --remote --file=migrations/011-qa-traceability.sql
```
Expected: same output as local apply, plus a confirmation prompt — answer `y`.

- [ ] **Step 2: Verify production**

Run:
```bash
npx wrangler d1 execute engage-db --remote --command "SELECT version, description FROM schema_version WHERE version = 11"
```
Expected: 1 row: `11 | QA traceability matrix: ...`.

---

### Task 5: Phase 1 commit checkpoint

- [ ] **Step 1: Confirm clean tree**

Run: `cd /Users/amtoc/amtocbot-site && git status`
Expected: working tree clean (Tasks 1–2 already committed, Tasks 3–4 had no file changes).

- [ ] **Step 2: Tag the checkpoint**

Run: `git tag qa-phase-1-complete`

**Phase 1 done. Schema is live in prod. No user-visible change yet.**

---

## Phase 2 — Backend Read-Path

Adds 4 new permissions, the QA shared types module, and the 4 read-side endpoints (`/ingest`, `/matrix`, `/runs`, `/runs/[id]`). Verified end-to-end via curl.

### Task 6: Add QA permissions to auth.ts

**Files:**
- Modify: `/Users/amtoc/amtocbot-site/functions/api/_shared/auth.ts`

- [ ] **Step 1: Open the file and locate PERMISSION_MAP**

Run: `grep -n "PERMISSION_MAP" /Users/amtoc/amtocbot-site/functions/api/_shared/auth.ts`
Expected: line numbers of PERMISSION_MAP definition and its closing brace.

- [ ] **Step 2: Add the four new entries**

Inside the PERMISSION_MAP object literal, add these four lines (preserve existing entries):

```typescript
'qa.view':        ['admin', 'superadmin', 'tester', 'approver', 'reviewer'],
'qa.acknowledge': ['admin', 'superadmin', 'tester'],
'qa.signoff':     ['admin', 'superadmin', 'tester'],
'qa.refresh':     ['admin', 'superadmin', 'tester'],
```

- [ ] **Step 3: Update the Permission type union**

Find the line `export type Permission = ...` and add `| 'qa.view' | 'qa.acknowledge' | 'qa.signoff' | 'qa.refresh'` to the union.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd /Users/amtoc/amtocbot-site && npx tsc --noEmit -p tsconfig.app.json 2>&1 | head -20`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add functions/api/_shared/auth.ts
git commit -m "feat(qa): add 4 QA permissions to auth permission map"
```

---

### Task 7: Create QA shared types module

**Files:**
- Create: `/Users/amtoc/amtocbot-site/functions/api/dashboard/qa/_shared.ts`

- [ ] **Step 1: Create directory + file**

```bash
mkdir -p /Users/amtoc/amtocbot-site/functions/api/dashboard/qa
```

- [ ] **Step 2: Write _shared.ts**

```typescript
/**
 * Shared types and helpers for QA traceability endpoints.
 */
import { Env, jsonResponse, requirePermission, getSessionUser, hasPermission } from '../../_shared/auth';

export { Env, jsonResponse, requirePermission, getSessionUser, hasPermission };
export { corsHeaders, optionsHandler, logAudit } from '../../_shared/auth';

export const QA_CHECK_TYPES = [
  'in_tracker',
  'tracker_url_valid',
  'live_url_200',
  'watermarked',
  'youtube_uploaded',
  'youtube_thumbnail',
  'youtube_playlist',
  'spotify_live',
  'blogger_live',
  'linkedin_crosspost',
  'x_crosspost',
  'companion_repo',
] as const;
export type QaCheckType = typeof QA_CHECK_TYPES[number];

export const QA_CONTENT_KINDS = [
  'tale', 'podcast', 'video', 'blog', 'tutorial', 'linkedin_article',
] as const;
export type QaContentKind = typeof QA_CONTENT_KINDS[number];

export const QA_CHECK_STATUSES = ['pass', 'fail', 'na', 'unknown'] as const;
export type QaCheckStatus = typeof QA_CHECK_STATUSES[number];

export const QA_RUN_SOURCES = ['cron', 'manual', 'dispatch'] as const;
export type QaRunSource = typeof QA_RUN_SOURCES[number];

export interface QaRunRow {
  id: number;
  client_run_id: string | null;
  started_at: string;
  finished_at: string | null;
  source: QaRunSource;
  triggered_by: number | null;
  total_checks: number;
  total_pass: number;
  total_fail: number;
  total_na: number;
  notes: string | null;
}

export interface QaCheckResultRow {
  id: number;
  run_id: number;
  content_code: string;
  content_kind: QaContentKind;
  content_title: string | null;
  check_type: QaCheckType;
  status: QaCheckStatus;
  error_detail: string | null;
  checked_at: string;
}

export interface QaAcknowledgementRow {
  id: number;
  content_code: string;
  check_type: QaCheckType;
  acknowledged_by: number;
  acknowledged_at: string;
  reason: string;
  expires_at: string;
  cleared_at: string | null;
  cleared_reason: string | null;
}

export interface QaWeeklySignoffRow {
  id: number;
  week_start_date: string;
  signed_by: number;
  signed_at: string;
  based_on_run_id: number;
  count_regressions: number;
  count_persistent: number;
  count_new_green: number;
  count_steady_green: number;
  notes: string | null;
}

export interface QaCellInput {
  status: QaCheckStatus;
  error_detail?: string;
}

export interface QaIngestPayload {
  run: {
    started_at: string;
    finished_at: string;
    source: QaRunSource;
    notes?: string;
    client_run_id?: string;
  };
  results: Array<{
    content_code: string;
    content_kind: QaContentKind;
    content_title?: string;
    checks: Partial<Record<QaCheckType, QaCellInput>>;
  }>;
}

/**
 * Bearer-token auth for the GH Actions ingest endpoint.
 * Returns null if authorized, or a Response on rejection.
 */
export async function requireIngestToken(request: Request, env: Env): Promise<Response | null> {
  const auth = request.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(\S+)$/i);
  if (!match) {
    return jsonResponse({ error: 'missing bearer token' }, 401);
  }
  const expected = (env as any).QA_INGEST_TOKEN as string | undefined;
  if (!expected) {
    return jsonResponse({ error: 'server misconfigured: QA_INGEST_TOKEN unset' }, 500);
  }
  // Constant-time compare
  if (match[1].length !== expected.length) {
    return jsonResponse({ error: 'invalid token' }, 403);
  }
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= match[1].charCodeAt(i) ^ expected.charCodeAt(i);
  }
  if (diff !== 0) {
    return jsonResponse({ error: 'invalid token' }, 403);
  }
  return null;
}

/**
 * Validate an ingest payload. Returns array of error messages (empty = valid).
 */
export function validateIngestPayload(p: any): string[] {
  const errors: string[] = [];
  if (!p || typeof p !== 'object') { errors.push('payload not an object'); return errors; }
  if (!p.run || typeof p.run !== 'object') { errors.push('run object missing'); return errors; }
  if (!QA_RUN_SOURCES.includes(p.run.source)) errors.push(`invalid run.source: ${p.run.source}`);
  if (typeof p.run.started_at !== 'string') errors.push('run.started_at must be string');
  if (typeof p.run.finished_at !== 'string') errors.push('run.finished_at must be string');
  if (!Array.isArray(p.results)) { errors.push('results must be array'); return errors; }
  for (let i = 0; i < p.results.length; i++) {
    const r = p.results[i];
    if (typeof r.content_code !== 'string' || !r.content_code) errors.push(`results[${i}].content_code missing`);
    if (!QA_CONTENT_KINDS.includes(r.content_kind)) errors.push(`results[${i}].content_kind invalid: ${r.content_kind}`);
    if (!r.checks || typeof r.checks !== 'object') errors.push(`results[${i}].checks missing`);
    else {
      for (const [ct, cell] of Object.entries(r.checks)) {
        if (!QA_CHECK_TYPES.includes(ct as QaCheckType)) {
          errors.push(`results[${i}].checks.${ct}: invalid check_type`);
        }
        const c = cell as QaCellInput;
        if (!QA_CHECK_STATUSES.includes(c.status)) {
          errors.push(`results[${i}].checks.${ct}.status invalid: ${c.status}`);
        }
        if ((c.status === 'fail' || c.status === 'unknown') && !c.error_detail) {
          errors.push(`results[${i}].checks.${ct}: error_detail required when status=${c.status}`);
        }
      }
    }
  }
  return errors;
}
```

- [ ] **Step 3: Verify TypeScript**

Run: `cd /Users/amtoc/amtocbot-site && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -E "qa/_shared" | head -10`
Expected: no errors mentioning `qa/_shared.ts`.

- [ ] **Step 4: Commit**

```bash
git add functions/api/dashboard/qa/_shared.ts
git commit -m "feat(qa): add shared types + ingest token helper"
```

---

### Task 8: Set QA_INGEST_TOKEN in Cloudflare Pages env

**Files:** none (Cloudflare dashboard)

- [ ] **Step 1: Generate a token**

Run: `python3 -c 'import secrets; print(secrets.token_urlsafe(48))'`
Expected: a 64-char token. Copy it.

- [ ] **Step 2: Set in Pages dashboard**

Go to https://dash.cloudflare.com → Pages → amtocbot-site → Settings → Environment Variables. Add:
- Variable name: `QA_INGEST_TOKEN`
- Value: the token from Step 1
- Type: encrypted
- Environment: Production AND Preview

- [ ] **Step 3: Save the token to a secure note**

Save the token in the same password manager / secrets vault as the other Cloudflare credentials. Label: `QA_INGEST_TOKEN — rotate quarterly — also lives in GH Actions secret QA_INGEST_TOKEN`.

- [ ] **Step 4: Trigger a redeploy to pick up the env var**

Run: `cd /Users/amtoc/amtocbot-site && git commit --allow-empty -m "chore: redeploy for QA_INGEST_TOKEN env" && git push`
Expected: Cloudflare Pages auto-deploys; check the dashboard until status = "Success".

---

### Task 9: Implement POST /api/dashboard/qa/ingest

**Files:**
- Create: `/Users/amtoc/amtocbot-site/functions/api/dashboard/qa/ingest.ts`

- [ ] **Step 1: Write the endpoint**

```typescript
/**
 * POST /api/dashboard/qa/ingest
 * Bearer-token authenticated. GitHub Actions writes a full run + all check results.
 * Idempotent via run.client_run_id (UNIQUE).
 */
import {
  Env, jsonResponse, optionsHandler, requireIngestToken,
  validateIngestPayload, QaIngestPayload, QA_CHECK_TYPES, logAudit,
} from './_shared';

export const onRequestOptions = optionsHandler;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const tokenErr = await requireIngestToken(request, env);
  if (tokenErr) return tokenErr;

  let payload: QaIngestPayload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid JSON' }, 400);
  }

  const errors = validateIngestPayload(payload);
  if (errors.length > 0) {
    return jsonResponse({ error: 'validation failed', details: errors }, 422);
  }

  const db = env.ENGAGE_DB;

  // Idempotency: if client_run_id already exists, return that run_id.
  if (payload.run.client_run_id) {
    const existing = await db
      .prepare('SELECT id FROM qa_runs WHERE client_run_id = ?')
      .bind(payload.run.client_run_id)
      .first<{ id: number }>();
    if (existing) {
      return jsonResponse({ run_id: existing.id, idempotent: true }, 200);
    }
  }

  // Compute totals
  let totalChecks = 0, totalPass = 0, totalFail = 0, totalNa = 0;
  for (const r of payload.results) {
    for (const ct of QA_CHECK_TYPES) {
      const cell = r.checks[ct];
      if (!cell) continue;
      totalChecks++;
      if (cell.status === 'pass') totalPass++;
      else if (cell.status === 'fail') totalFail++;
      else if (cell.status === 'na') totalNa++;
    }
  }

  // Insert qa_runs row
  const runInsert = await db.prepare(
    `INSERT INTO qa_runs (client_run_id, started_at, finished_at, source, total_checks, total_pass, total_fail, total_na, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    payload.run.client_run_id || null,
    payload.run.started_at,
    payload.run.finished_at,
    payload.run.source,
    totalChecks, totalPass, totalFail, totalNa,
    payload.run.notes || null,
  ).run();

  const runId = runInsert.meta.last_row_id as number;

  // Chunk inserts: max ~50 statements per batch, multi-row VALUES with up to 100 rows each.
  const ROWS_PER_STATEMENT = 50;
  const STATEMENTS_PER_BATCH = 25;

  const flatRows: Array<[number, string, string, string | null, string, string, string | null, string]> = [];
  for (const r of payload.results) {
    for (const ct of QA_CHECK_TYPES) {
      const cell = r.checks[ct];
      if (!cell) continue;
      flatRows.push([
        runId,
        r.content_code,
        r.content_kind,
        r.content_title || null,
        ct,
        cell.status,
        cell.error_detail || null,
        payload.run.finished_at,
      ]);
    }
  }

  // Build statements
  const statements: D1PreparedStatement[] = [];
  for (let i = 0; i < flatRows.length; i += ROWS_PER_STATEMENT) {
    const chunk = flatRows.slice(i, i + ROWS_PER_STATEMENT);
    const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const binds = chunk.flat();
    statements.push(
      db.prepare(
        `INSERT INTO qa_check_results
           (run_id, content_code, content_kind, content_title, check_type, status, error_detail, checked_at)
         VALUES ${placeholders}`
      ).bind(...binds)
    );
  }

  // Execute batches
  for (let i = 0; i < statements.length; i += STATEMENTS_PER_BATCH) {
    await db.batch(statements.slice(i, i + STATEMENTS_PER_BATCH));
  }

  // Audit log (system actor)
  await logAudit(db, 0, 'system', 'qa.ingest', JSON.stringify({
    run_id: runId, total_checks: totalChecks, total_fail: totalFail,
  }), null);

  return jsonResponse({ run_id: runId, total_checks: totalChecks, total_fail: totalFail }, 201);
};
```

- [ ] **Step 2: Verify TypeScript**

Run: `cd /Users/amtoc/amtocbot-site && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep "qa/ingest" | head`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add functions/api/dashboard/qa/ingest.ts
git commit -m "feat(qa): POST /qa/ingest endpoint (bearer-auth, batched D1 writes)"
```

---

### Task 10: Curl test the ingest endpoint locally

**Files:**
- Create: `/Users/amtoc/amtocbot-site/scripts/qa-test-fixtures/ingest-sample.json`

- [ ] **Step 1: Create fixtures dir + sample payload**

```bash
mkdir -p /Users/amtoc/amtocbot-site/scripts/qa-test-fixtures
```

Write `/Users/amtoc/amtocbot-site/scripts/qa-test-fixtures/ingest-sample.json`:

```json
{
  "run": {
    "started_at": "2026-04-26T06:00:00Z",
    "finished_at": "2026-04-26T06:03:42Z",
    "source": "manual",
    "notes": "fixture test",
    "client_run_id": "fixture-001"
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

- [ ] **Step 2: Start the local dev server**

Run (in one terminal): `cd /Users/amtoc/amtocbot-site && npx wrangler pages dev --port 8788`
Expected: server starts on http://localhost:8788, prints `[wrangler:inf] Ready on http://localhost:8788`.

- [ ] **Step 3: Set local QA_INGEST_TOKEN**

In a second terminal:
```bash
export QA_INGEST_TOKEN_LOCAL="local-dev-test-token-12345"
```

Add the same value to `/Users/amtoc/amtocbot-site/.dev.vars` (creating it if absent — this file is gitignored):
```
QA_INGEST_TOKEN=local-dev-test-token-12345
```

Restart the wrangler dev server so it picks up `.dev.vars`.

- [ ] **Step 4: POST the fixture**

```bash
curl -i -X POST http://localhost:8788/api/dashboard/qa/ingest \
  -H "Authorization: Bearer $QA_INGEST_TOKEN_LOCAL" \
  -H "Content-Type: application/json" \
  --data @/Users/amtoc/amtocbot-site/scripts/qa-test-fixtures/ingest-sample.json
```
Expected: HTTP 201, body like `{"run_id":1,"total_checks":12,"total_fail":2}`.

- [ ] **Step 5: Verify D1**

```bash
cd /Users/amtoc/amtocbot-site
npx wrangler d1 execute engage-db --local \
  --command "SELECT id, source, total_checks, total_fail FROM qa_runs ORDER BY id DESC LIMIT 1"
```
Expected: 1 row matching what was POSTed.

- [ ] **Step 6: Verify idempotency**

Re-POST the same fixture (same `client_run_id`):
```bash
curl -i -X POST http://localhost:8788/api/dashboard/qa/ingest \
  -H "Authorization: Bearer $QA_INGEST_TOKEN_LOCAL" \
  -H "Content-Type: application/json" \
  --data @/Users/amtoc/amtocbot-site/scripts/qa-test-fixtures/ingest-sample.json
```
Expected: HTTP 200, body has `"idempotent":true` and same `run_id` as Step 4.

- [ ] **Step 7: Verify auth rejection**

```bash
curl -i -X POST http://localhost:8788/api/dashboard/qa/ingest \
  -H "Authorization: Bearer wrong-token" \
  -H "Content-Type: application/json" \
  --data @/Users/amtoc/amtocbot-site/scripts/qa-test-fixtures/ingest-sample.json
```
Expected: HTTP 403, body `{"error":"invalid token"}`.

- [ ] **Step 8: Commit fixtures**

```bash
git add scripts/qa-test-fixtures/ingest-sample.json
git commit -m "test(qa): add ingest endpoint fixture"
```

---

### Task 11: Implement GET /api/dashboard/qa/matrix

**Files:**
- Create: `/Users/amtoc/amtocbot-site/functions/api/dashboard/qa/matrix.ts`

- [ ] **Step 1: Write the endpoint**

```typescript
/**
 * GET /api/dashboard/qa/matrix
 * Returns the latest snapshot: one row per content piece with all check_type cells.
 * Filters: ?kind=tale,podcast (csv) | ?status=fail | ?run_id=N (specific run)
 */
import {
  Env, jsonResponse, optionsHandler, requirePermission,
  QA_CHECK_TYPES, QA_CONTENT_KINDS, QaCheckType, QaContentKind, QaCheckStatus,
} from './_shared';

export const onRequestOptions = optionsHandler;

interface MatrixCell { status: QaCheckStatus; error_detail: string | null; checked_at: string; }
interface MatrixRow {
  content_code: string;
  content_kind: QaContentKind;
  content_title: string | null;
  cells: Partial<Record<QaCheckType, MatrixCell>>;
  has_failure: boolean;
  has_regression: boolean;  // populated below from prior signoff comparison
  active_acks: Array<{ check_type: QaCheckType; reason: string; expires_at: string; ack_id: number }>;
  linked_issues: Array<{ check_type: QaCheckType; issue_id: number; status: string }>;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const db = env.ENGAGE_DB;
  const auth = await requirePermission(request, db, 'qa.view');
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const kindFilter = (url.searchParams.get('kind') || '').split(',').map(s => s.trim()).filter(Boolean);
  const statusFilter = url.searchParams.get('status'); // 'fail' | null
  const runIdParam = url.searchParams.get('run_id');

  // Determine target run: explicit ?run_id or latest
  let runId: number | null;
  if (runIdParam) {
    runId = parseInt(runIdParam, 10);
    if (isNaN(runId)) return jsonResponse({ error: 'invalid run_id' }, 400);
  } else {
    const latest = await db
      .prepare(`SELECT id FROM qa_runs WHERE finished_at IS NOT NULL ORDER BY started_at DESC LIMIT 1`)
      .first<{ id: number }>();
    if (!latest) {
      return jsonResponse({ run_id: null, rows: [], message: 'no completed runs yet' }, 200);
    }
    runId = latest.id;
  }

  // Pull all check results for that run
  const { results } = await db
    .prepare(`SELECT content_code, content_kind, content_title, check_type, status, error_detail, checked_at
              FROM qa_check_results WHERE run_id = ?`)
    .bind(runId)
    .all<{ content_code: string; content_kind: QaContentKind; content_title: string | null;
            check_type: QaCheckType; status: QaCheckStatus; error_detail: string | null; checked_at: string }>();

  // Group by content_code
  const byCode = new Map<string, MatrixRow>();
  for (const r of results || []) {
    if (!byCode.has(r.content_code)) {
      byCode.set(r.content_code, {
        content_code: r.content_code,
        content_kind: r.content_kind,
        content_title: r.content_title,
        cells: {},
        has_failure: false,
        has_regression: false,
        active_acks: [],
        linked_issues: [],
      });
    }
    const row = byCode.get(r.content_code)!;
    row.cells[r.check_type] = {
      status: r.status,
      error_detail: r.error_detail,
      checked_at: r.checked_at,
    };
    if (r.status === 'fail') row.has_failure = true;
  }

  // Apply filters
  let rows = Array.from(byCode.values());
  if (kindFilter.length > 0) {
    const kinds = new Set(kindFilter.filter(k => QA_CONTENT_KINDS.includes(k as QaContentKind)));
    rows = rows.filter(r => kinds.has(r.content_kind));
  }
  if (statusFilter === 'fail') rows = rows.filter(r => r.has_failure);

  // Pull active acknowledgements for these rows
  const codes = rows.map(r => r.content_code);
  if (codes.length > 0) {
    const placeholders = codes.map(() => '?').join(',');
    const ackResults = await db
      .prepare(`SELECT id, content_code, check_type, reason, expires_at FROM qa_acknowledgements
                WHERE cleared_at IS NULL AND expires_at > datetime('now') AND content_code IN (${placeholders})`)
      .bind(...codes).all<any>();
    for (const a of ackResults.results || []) {
      const row = byCode.get(a.content_code);
      if (row) row.active_acks.push({
        check_type: a.check_type, reason: a.reason, expires_at: a.expires_at, ack_id: a.id,
      });
    }
    // Pull linked open issues
    const issueResults = await db
      .prepare(`SELECT id, qa_content_code, qa_check_type, status FROM issues
                WHERE qa_content_code IN (${placeholders}) AND status IN ('open', 'in_progress')`)
      .bind(...codes).all<any>();
    for (const i of issueResults.results || []) {
      const row = byCode.get(i.qa_content_code);
      if (row && i.qa_check_type) row.linked_issues.push({
        check_type: i.qa_check_type, issue_id: i.id, status: i.status,
      });
    }
  }

  // Determine regressions vs last sign-off
  const lastSignoff = await db
    .prepare(`SELECT based_on_run_id FROM qa_weekly_signoffs ORDER BY week_start_date DESC LIMIT 1`)
    .first<{ based_on_run_id: number }>();
  if (lastSignoff && lastSignoff.based_on_run_id !== runId) {
    const { results: priorResults } = await db
      .prepare(`SELECT content_code, check_type, status FROM qa_check_results WHERE run_id = ?`)
      .bind(lastSignoff.based_on_run_id).all<{ content_code: string; check_type: QaCheckType; status: QaCheckStatus }>();
    const priorMap = new Map<string, QaCheckStatus>();
    for (const p of priorResults || []) {
      priorMap.set(`${p.content_code}|${p.check_type}`, p.status);
    }
    for (const row of rows) {
      for (const ct of QA_CHECK_TYPES) {
        const cell = row.cells[ct];
        if (cell?.status === 'fail' && priorMap.get(`${row.content_code}|${ct}`) === 'pass') {
          row.has_regression = true;
          break;
        }
      }
    }
  }

  return jsonResponse({
    run_id: runId,
    row_count: rows.length,
    rows,
    check_types: QA_CHECK_TYPES,
    content_kinds: QA_CONTENT_KINDS,
  }, 200);
};
```

- [ ] **Step 2: Test via curl (must be logged in)**

Get a session cookie by logging in via the dashboard at `http://localhost:8788/admin` first (use a tester or admin account from local D1). Then:

```bash
curl -i "http://localhost:8788/api/dashboard/qa/matrix" \
  -H "Cookie: session_id=<paste from browser dev tools>"
```
Expected: HTTP 200, body has `run_id`, `rows: [{content_code: "T014", cells: {...}}]`.

- [ ] **Step 3: Test filter**

```bash
curl "http://localhost:8788/api/dashboard/qa/matrix?status=fail" \
  -H "Cookie: session_id=..."
```
Expected: only rows where `has_failure: true`.

- [ ] **Step 4: Commit**

```bash
git add functions/api/dashboard/qa/matrix.ts
git commit -m "feat(qa): GET /qa/matrix with filters and regression detection"
```

---

### Task 12: Implement GET /api/dashboard/qa/runs

**Files:**
- Create: `/Users/amtoc/amtocbot-site/functions/api/dashboard/qa/runs/index.ts`

- [ ] **Step 1: Write the endpoint**

```bash
mkdir -p /Users/amtoc/amtocbot-site/functions/api/dashboard/qa/runs
```

```typescript
/**
 * GET /api/dashboard/qa/runs
 * Lists runs (newest first). Used by Refresh polling: ?since=<iso>&limit=20.
 */
import { Env, jsonResponse, optionsHandler, requirePermission, QaRunRow } from '../_shared';

export const onRequestOptions = optionsHandler;

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const db = env.ENGAGE_DB;
  const auth = await requirePermission(request, db, 'qa.view');
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const since = url.searchParams.get('since');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);

  let sql = `SELECT id, client_run_id, started_at, finished_at, source, triggered_by,
                    total_checks, total_pass, total_fail, total_na, notes
             FROM qa_runs`;
  const binds: unknown[] = [];
  if (since) {
    sql += ` WHERE started_at > ?`;
    binds.push(since);
  }
  sql += ` ORDER BY started_at DESC LIMIT ?`;
  binds.push(limit);

  const { results } = await db.prepare(sql).bind(...binds).all<QaRunRow>();
  return jsonResponse({ runs: results || [] }, 200);
};
```

- [ ] **Step 2: Curl test**

```bash
curl "http://localhost:8788/api/dashboard/qa/runs?limit=5" -H "Cookie: session_id=..."
```
Expected: HTTP 200, body has `runs: [{id: 1, source: "manual", ...}]`.

- [ ] **Step 3: Commit**

```bash
git add functions/api/dashboard/qa/runs/index.ts
git commit -m "feat(qa): GET /qa/runs list endpoint"
```

---

### Task 13: Implement GET /api/dashboard/qa/runs/[id]

**Files:**
- Create: `/Users/amtoc/amtocbot-site/functions/api/dashboard/qa/runs/[id].ts`

- [ ] **Step 1: Write the endpoint**

```typescript
/**
 * GET /api/dashboard/qa/runs/[id]
 * Single run summary. Used by history drill-through.
 */
import { Env, jsonResponse, optionsHandler, requirePermission, QaRunRow } from '../_shared';

export const onRequestOptions = optionsHandler;

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  const db = env.ENGAGE_DB;
  const auth = await requirePermission(request, db, 'qa.view');
  if (auth instanceof Response) return auth;

  const id = parseInt(params.id as string, 10);
  if (isNaN(id)) return jsonResponse({ error: 'invalid id' }, 400);

  const run = await db
    .prepare(`SELECT id, client_run_id, started_at, finished_at, source, triggered_by,
                     total_checks, total_pass, total_fail, total_na, notes
              FROM qa_runs WHERE id = ?`)
    .bind(id).first<QaRunRow>();

  if (!run) return jsonResponse({ error: 'not found' }, 404);
  return jsonResponse({ run }, 200);
};
```

- [ ] **Step 2: Curl test**

```bash
curl "http://localhost:8788/api/dashboard/qa/runs/1" -H "Cookie: session_id=..."
```
Expected: HTTP 200 with the single run.

- [ ] **Step 3: 404 test**

```bash
curl -i "http://localhost:8788/api/dashboard/qa/runs/99999" -H "Cookie: session_id=..."
```
Expected: HTTP 404.

- [ ] **Step 4: Commit**

```bash
git add functions/api/dashboard/qa/runs/'[id].ts'
git commit -m "feat(qa): GET /qa/runs/[id] single-run endpoint"
```

---

### Task 14: Permission denial test

**Files:** none

- [ ] **Step 1: Test reviewer can read**

Log in as a reviewer (or temporarily change a test user's role to `reviewer`):
```bash
curl -i "http://localhost:8788/api/dashboard/qa/matrix" -H "Cookie: session_id=<reviewer>"
```
Expected: HTTP 200 (reviewer has `qa.view`).

- [ ] **Step 2: Test member is denied**

If a `member` role user exists, hit the same endpoint:
```bash
curl -i "http://localhost:8788/api/dashboard/qa/matrix" -H "Cookie: session_id=<member>"
```
Expected: HTTP 403 (member is not in qa.view's allowed roles).

- [ ] **Step 3: Test unauthenticated**

```bash
curl -i "http://localhost:8788/api/dashboard/qa/matrix"
```
Expected: HTTP 401.

---

### Task 15: Phase 2 deploy + smoke test in production

**Files:** none

- [ ] **Step 1: Push**

```bash
cd /Users/amtoc/amtocbot-site
git push origin main
```

Wait for Cloudflare Pages deploy to finish (~2 min).

- [ ] **Step 2: Production curl smoke test**

```bash
PROD_TOKEN="<the token you set in Task 8 step 1>"
curl -i -X POST https://amtocbot.com/api/dashboard/qa/ingest \
  -H "Authorization: Bearer $PROD_TOKEN" \
  -H "Content-Type: application/json" \
  --data @/Users/amtoc/amtocbot-site/scripts/qa-test-fixtures/ingest-sample.json
```
Expected: HTTP 201 with run_id. (Use a different `client_run_id` if you want to avoid the idempotency dedupe.)

- [ ] **Step 3: Verify in prod D1**

```bash
npx wrangler d1 execute engage-db --remote \
  --command "SELECT id, source, total_checks FROM qa_runs ORDER BY id DESC LIMIT 1"
```
Expected: the row you just inserted.

---

### Task 16: Phase 2 commit checkpoint

- [ ] **Step 1: Tag**

```bash
cd /Users/amtoc/amtocbot-site
git tag qa-phase-2-complete
```

**Phase 2 done. Backend can ingest and serve the matrix. No frontend yet.**

---

## Phase 3 — Backend Write-Path

Adds: acknowledge (single + bulk + clear), issue-from-cell, todos (computed), refresh (GH dispatch), signoff eligibility + commit, history endpoints (heatmap, trend, signoffs), cron monitor.

### Task 17: POST /api/dashboard/qa/acknowledge

**Files:**
- Create: `/Users/amtoc/amtocbot-site/functions/api/dashboard/qa/acknowledge/index.ts`

- [ ] **Step 1: Make directory**

```bash
mkdir -p /Users/amtoc/amtocbot-site/functions/api/dashboard/qa/acknowledge
```

- [ ] **Step 2: Write the endpoint**

```typescript
/**
 * POST /api/dashboard/qa/acknowledge
 * Body: { content_code, check_type, reason, expires_in_days? }
 * Default expiry: 14 days.
 */
import {
  Env, jsonResponse, optionsHandler, requirePermission, logAudit,
  QA_CHECK_TYPES, QaCheckType,
} from '../_shared';

export const onRequestOptions = optionsHandler;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const db = env.ENGAGE_DB;
  const auth = await requirePermission(request, db, 'qa.acknowledge');
  if (auth instanceof Response) return auth;
  const user = auth;

  let body: { content_code?: string; check_type?: string; reason?: string; expires_in_days?: number };
  try { body = await request.json(); } catch { return jsonResponse({ error: 'invalid JSON' }, 400); }

  if (!body.content_code) return jsonResponse({ error: 'content_code required' }, 422);
  if (!QA_CHECK_TYPES.includes(body.check_type as QaCheckType)) {
    return jsonResponse({ error: 'invalid check_type' }, 422);
  }
  if (!body.reason || body.reason.trim().length < 3) {
    return jsonResponse({ error: 'reason must be at least 3 chars' }, 422);
  }
  const days = Math.min(Math.max(body.expires_in_days ?? 14, 1), 90);
  const expiresAt = new Date(Date.now() + days * 86_400_000).toISOString();

  const result = await db.prepare(
    `INSERT INTO qa_acknowledgements (content_code, check_type, acknowledged_by, reason, expires_at)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(body.content_code, body.check_type, user.id, body.reason.trim(), expiresAt).run();

  const ackId = result.meta.last_row_id as number;
  await logAudit(db, user.id, user.username, 'qa.acknowledge',
    JSON.stringify({ ack_id: ackId, content_code: body.content_code, check_type: body.check_type, reason: body.reason, expires_at: expiresAt }),
    request.headers.get('cf-connecting-ip'));

  return jsonResponse({ ack_id: ackId, expires_at: expiresAt }, 201);
};
```

- [ ] **Step 3: Curl test**

```bash
curl -i -X POST http://localhost:8788/api/dashboard/qa/acknowledge \
  -H "Cookie: session_id=<tester>" \
  -H "Content-Type: application/json" \
  -d '{"content_code":"T014","check_type":"linkedin_crosspost","reason":"will cross-post next week","expires_in_days":7}'
```
Expected: HTTP 201, body has `ack_id` and `expires_at`.

- [ ] **Step 4: Verify D1**

```bash
npx wrangler d1 execute engage-db --local \
  --command "SELECT id, content_code, check_type, reason, expires_at FROM qa_acknowledgements ORDER BY id DESC LIMIT 1"
```
Expected: the row.

- [ ] **Step 5: Commit**

```bash
git add functions/api/dashboard/qa/acknowledge/index.ts
git commit -m "feat(qa): POST /qa/acknowledge endpoint"
```

---

### Task 18: POST /api/dashboard/qa/acknowledge/bulk

**Files:**
- Create: `/Users/amtoc/amtocbot-site/functions/api/dashboard/qa/acknowledge/bulk.ts`

- [ ] **Step 1: Write the endpoint**

```typescript
/**
 * POST /api/dashboard/qa/acknowledge/bulk
 * Body: { cells: [{content_code, check_type}], reason, expires_in_days? }
 * Creates one ack per cell, all with the same reason + expiry.
 */
import {
  Env, jsonResponse, optionsHandler, requirePermission, logAudit,
  QA_CHECK_TYPES, QaCheckType,
} from '../_shared';

export const onRequestOptions = optionsHandler;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const db = env.ENGAGE_DB;
  const auth = await requirePermission(request, db, 'qa.acknowledge');
  if (auth instanceof Response) return auth;
  const user = auth;

  let body: { cells?: Array<{ content_code: string; check_type: string }>; reason?: string; expires_in_days?: number };
  try { body = await request.json(); } catch { return jsonResponse({ error: 'invalid JSON' }, 400); }

  if (!Array.isArray(body.cells) || body.cells.length === 0) {
    return jsonResponse({ error: 'cells array required (non-empty)' }, 422);
  }
  if (body.cells.length > 500) {
    return jsonResponse({ error: 'max 500 cells per bulk ack' }, 422);
  }
  if (!body.reason || body.reason.trim().length < 3) {
    return jsonResponse({ error: 'reason must be at least 3 chars' }, 422);
  }
  for (let i = 0; i < body.cells.length; i++) {
    const c = body.cells[i];
    if (!c.content_code) return jsonResponse({ error: `cells[${i}].content_code required` }, 422);
    if (!QA_CHECK_TYPES.includes(c.check_type as QaCheckType)) {
      return jsonResponse({ error: `cells[${i}].check_type invalid` }, 422);
    }
  }

  const days = Math.min(Math.max(body.expires_in_days ?? 14, 1), 90);
  const expiresAt = new Date(Date.now() + days * 86_400_000).toISOString();

  // Batch inserts
  const stmts = body.cells.map(c => db.prepare(
    `INSERT INTO qa_acknowledgements (content_code, check_type, acknowledged_by, reason, expires_at)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(c.content_code, c.check_type, user.id, body.reason!.trim(), expiresAt));

  const results: Array<{ content_code: string; check_type: string; ack_id: number }> = [];
  // Chunk batches at 25 statements each
  for (let i = 0; i < stmts.length; i += 25) {
    const chunk = stmts.slice(i, i + 25);
    const out = await db.batch(chunk);
    for (let j = 0; j < out.length; j++) {
      const cell = body.cells[i + j];
      results.push({
        content_code: cell.content_code,
        check_type: cell.check_type,
        ack_id: out[j].meta.last_row_id as number,
      });
    }
  }

  // One audit row per cell
  for (const r of results) {
    await logAudit(db, user.id, user.username, 'qa.acknowledge',
      JSON.stringify({ ack_id: r.ack_id, content_code: r.content_code, check_type: r.check_type, reason: body.reason, expires_at: expiresAt, bulk: true }),
      request.headers.get('cf-connecting-ip'));
  }

  return jsonResponse({ count: results.length, acks: results, expires_at: expiresAt }, 201);
};
```

- [ ] **Step 2: Curl test**

```bash
curl -i -X POST http://localhost:8788/api/dashboard/qa/acknowledge/bulk \
  -H "Cookie: session_id=<tester>" -H "Content-Type: application/json" \
  -d '{"cells":[{"content_code":"T014","check_type":"x_crosspost"},{"content_code":"T013","check_type":"x_crosspost"}],"reason":"X cross-post backlog","expires_in_days":14}'
```
Expected: HTTP 201, body `{count: 2, acks: [...]}`.

- [ ] **Step 3: Commit**

```bash
git add functions/api/dashboard/qa/acknowledge/bulk.ts
git commit -m "feat(qa): POST /qa/acknowledge/bulk endpoint"
```

---

### Task 19: DELETE /api/dashboard/qa/acknowledge/[id]

**Files:**
- Create: `/Users/amtoc/amtocbot-site/functions/api/dashboard/qa/acknowledge/[id].ts`

- [ ] **Step 1: Write the endpoint**

```typescript
/**
 * DELETE /api/dashboard/qa/acknowledge/[id]
 * Clears an ack early (sets cleared_at, cleared_reason).
 */
import {
  Env, jsonResponse, optionsHandler, requirePermission, logAudit,
} from '../_shared';

export const onRequestOptions = optionsHandler;

export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  const db = env.ENGAGE_DB;
  const auth = await requirePermission(request, db, 'qa.acknowledge');
  if (auth instanceof Response) return auth;
  const user = auth;

  const id = parseInt(params.id as string, 10);
  if (isNaN(id)) return jsonResponse({ error: 'invalid id' }, 400);

  let body: { reason?: string } = {};
  try { body = await request.json(); } catch { /* body optional */ }

  const result = await db.prepare(
    `UPDATE qa_acknowledgements
     SET cleared_at = datetime('now'), cleared_reason = ?
     WHERE id = ? AND cleared_at IS NULL`
  ).bind(body.reason || 'cleared by tester', id).run();

  if (result.meta.changes === 0) {
    return jsonResponse({ error: 'not found or already cleared' }, 404);
  }

  await logAudit(db, user.id, user.username, 'qa.acknowledge_clear',
    JSON.stringify({ acknowledgement_id: id, reason: body.reason }),
    request.headers.get('cf-connecting-ip'));

  return jsonResponse({ cleared: true }, 200);
};
```

- [ ] **Step 2: Curl test**

```bash
curl -i -X DELETE http://localhost:8788/api/dashboard/qa/acknowledge/1 \
  -H "Cookie: session_id=<tester>" -H "Content-Type: application/json" \
  -d '{"reason":"issue filed"}'
```
Expected: HTTP 200, `{cleared: true}`. Re-running returns 404.

- [ ] **Step 3: Commit**

```bash
git add functions/api/dashboard/qa/acknowledge/'[id].ts'
git commit -m "feat(qa): DELETE /qa/acknowledge/[id] clear-ack endpoint"
```

---

### Task 20: POST /api/dashboard/qa/issue-from-cell

**Files:**
- Create: `/Users/amtoc/amtocbot-site/functions/api/dashboard/qa/issue-from-cell.ts`

- [ ] **Step 1: Write the endpoint**

```typescript
/**
 * POST /api/dashboard/qa/issue-from-cell
 * Pre-fills an issues row with the failing-cell context.
 * Body: { content_code, check_type, severity?, description? }
 */
import {
  Env, jsonResponse, optionsHandler, requirePermission, logAudit,
  QA_CHECK_TYPES, QaCheckType,
} from './_shared';

export const onRequestOptions = optionsHandler;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const db = env.ENGAGE_DB;
  const auth = await requirePermission(request, db, 'qa.acknowledge'); // same permission
  if (auth instanceof Response) return auth;
  const user = auth;

  let body: { content_code?: string; check_type?: string; severity?: string; description?: string };
  try { body = await request.json(); } catch { return jsonResponse({ error: 'invalid JSON' }, 400); }

  if (!body.content_code) return jsonResponse({ error: 'content_code required' }, 422);
  if (!QA_CHECK_TYPES.includes(body.check_type as QaCheckType)) {
    return jsonResponse({ error: 'invalid check_type' }, 422);
  }
  const severity = ['low','medium','high','critical'].includes(body.severity || '') ? body.severity : 'medium';

  // Look up the latest error_detail for this cell
  const latest = await db.prepare(
    `SELECT error_detail, content_title FROM qa_check_results
     WHERE content_code = ? AND check_type = ?
     ORDER BY checked_at DESC LIMIT 1`
  ).bind(body.content_code, body.check_type).first<{ error_detail: string | null; content_title: string | null }>();

  const title = `[QA] ${body.content_code} · ${body.check_type} fail`;
  const description = (body.description ? body.description + '\n\n' : '') +
    (latest?.content_title ? `Content: ${latest.content_title}\n` : '') +
    `Code: ${body.content_code}\nCheck: ${body.check_type}\nLast error: ${latest?.error_detail ?? '(none)'}`;

  const result = await db.prepare(
    `INSERT INTO issues (title, description, type, severity, status, content_id, qa_content_code, qa_check_type, created_by)
     VALUES (?, ?, 'quality', ?, 'open', NULL, ?, ?, ?)`
  ).bind(title, description, severity, body.content_code, body.check_type, user.id).run();

  const issueId = result.meta.last_row_id as number;
  await logAudit(db, user.id, user.username, 'qa.issue_from_cell',
    JSON.stringify({ issue_id: issueId, content_code: body.content_code, check_type: body.check_type }),
    request.headers.get('cf-connecting-ip'));

  return jsonResponse({ issue_id: issueId, title, severity }, 201);
};
```

- [ ] **Step 2: Curl test**

```bash
curl -i -X POST http://localhost:8788/api/dashboard/qa/issue-from-cell \
  -H "Cookie: session_id=<tester>" -H "Content-Type: application/json" \
  -d '{"content_code":"T014","check_type":"linkedin_crosspost","severity":"medium"}'
```
Expected: HTTP 201, body has `issue_id` and the prefab title.

- [ ] **Step 3: Verify the issue links back to the cell**

```bash
npx wrangler d1 execute engage-db --local \
  --command "SELECT id, title, qa_content_code, qa_check_type FROM issues ORDER BY id DESC LIMIT 1"
```
Expected: 1 row with `qa_content_code='T014'` and `qa_check_type='linkedin_crosspost'`.

- [ ] **Step 4: Commit**

```bash
git add functions/api/dashboard/qa/issue-from-cell.ts
git commit -m "feat(qa): POST /qa/issue-from-cell creates linked issue"
```

---

### Task 21: GET /api/dashboard/qa/todos

**Files:**
- Create: `/Users/amtoc/amtocbot-site/functions/api/dashboard/qa/todos.ts`

- [ ] **Step 1: Write the endpoint**

```typescript
/**
 * GET /api/dashboard/qa/todos
 * Risk-weighted prioritized todo list (8 tiers). Max 200 items.
 */
import {
  Env, jsonResponse, optionsHandler, requirePermission,
  QA_CHECK_TYPES, QaCheckType, QaContentKind, QaCheckStatus,
} from './_shared';

export const onRequestOptions = optionsHandler;

interface Todo {
  priority_tier: number;
  priority_label: string;
  content_code: string;
  content_kind: QaContentKind;
  content_title: string | null;
  check_type: QaCheckType;
  last_error: string | null;
  last_known_good_at: string | null;
  suggested_action: string;
  existing_ack_id: number | null;
  existing_issue_id: number | null;
}

const TIER_LABELS = [
  '', // 0 unused
  'Regressions',
  'Live URL 404s',
  'Tracker URL violations',
  'Missing watermarks',
  'Missing primary platform',
  'Missing secondary cross-posts',
  'Acknowledged-but-stale',
  'Never-been-green > 7d',
];

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const db = env.ENGAGE_DB;
  const auth = await requirePermission(request, db, 'qa.view');
  if (auth instanceof Response) return auth;

  // Find latest run
  const latest = await db.prepare(
    `SELECT id FROM qa_runs WHERE finished_at IS NOT NULL ORDER BY started_at DESC LIMIT 1`
  ).first<{ id: number }>();
  if (!latest) return jsonResponse({ todos: [] }, 200);
  const runId = latest.id;

  // Find prior signoff snapshot run for regression detection
  const lastSignoff = await db.prepare(
    `SELECT based_on_run_id, signed_at FROM qa_weekly_signoffs ORDER BY week_start_date DESC LIMIT 1`
  ).first<{ based_on_run_id: number; signed_at: string }>();

  // Pull all latest fails
  const { results: fails } = await db.prepare(
    `SELECT content_code, content_kind, content_title, check_type, status, error_detail, checked_at
     FROM qa_check_results WHERE run_id = ? AND status = 'fail'`
  ).bind(runId).all<{
    content_code: string; content_kind: QaContentKind; content_title: string | null;
    check_type: QaCheckType; status: QaCheckStatus; error_detail: string | null; checked_at: string;
  }>();

  // Pull prior pass map
  const priorPassMap = new Map<string, boolean>();
  if (lastSignoff) {
    const { results: priors } = await db.prepare(
      `SELECT content_code, check_type, status FROM qa_check_results WHERE run_id = ? AND status = 'pass'`
    ).bind(lastSignoff.based_on_run_id).all<{ content_code: string; check_type: QaCheckType }>();
    for (const p of priors || []) priorPassMap.set(`${p.content_code}|${p.check_type}`, true);
  }

  // Pull active acks
  const ackMap = new Map<string, { ack_id: number; acknowledged_at: string }>();
  const { results: acks } = await db.prepare(
    `SELECT id, content_code, check_type, acknowledged_at FROM qa_acknowledgements
     WHERE cleared_at IS NULL AND expires_at > datetime('now')`
  ).all<{ id: number; content_code: string; check_type: QaCheckType; acknowledged_at: string }>();
  for (const a of acks || []) ackMap.set(`${a.content_code}|${a.check_type}`, { ack_id: a.id, acknowledged_at: a.acknowledged_at });

  // Pull linked open issues
  const issueMap = new Map<string, number>();
  const { results: issues } = await db.prepare(
    `SELECT id, qa_content_code, qa_check_type FROM issues
     WHERE status IN ('open','in_progress') AND qa_content_code IS NOT NULL`
  ).all<{ id: number; qa_content_code: string; qa_check_type: string }>();
  for (const i of issues || []) issueMap.set(`${i.qa_content_code}|${i.qa_check_type}`, i.id);

  // For "last_known_good_at": fetch most recent pass per (content_code, check_type)
  // Cheap version: aggregate from latest 30 days of results for failing cells.
  const failKeys = (fails || []).map(f => [f.content_code, f.check_type] as const);
  const lastGoodMap = new Map<string, string>();
  if (failKeys.length > 0) {
    const { results: goods } = await db.prepare(
      `SELECT content_code, check_type, MAX(checked_at) AS last_good
       FROM qa_check_results
       WHERE status = 'pass' AND checked_at > datetime('now', '-90 days')
       GROUP BY content_code, check_type`
    ).all<{ content_code: string; check_type: QaCheckType; last_good: string }>();
    for (const g of goods || []) lastGoodMap.set(`${g.content_code}|${g.check_type}`, g.last_good);
  }

  const todos: Todo[] = [];

  for (const f of fails || []) {
    const key = `${f.content_code}|${f.check_type}`;
    let tier = 0;

    // Tier 1: regression (was pass at last signoff snapshot, now fail)
    if (lastSignoff && priorPassMap.has(key)) tier = 1;
    // Tier 2: live URL 404
    else if (f.check_type === 'live_url_200') tier = 2;
    // Tier 3: tracker URL violation
    else if (f.check_type === 'tracker_url_valid') tier = 3;
    // Tier 4: missing watermark
    else if (f.check_type === 'watermarked') tier = 4;
    // Tier 5: missing primary platform
    else if (
      (['tale','podcast','video'].includes(f.content_kind) && ['youtube_uploaded','youtube_thumbnail','youtube_playlist'].includes(f.check_type))
      || (f.content_kind === 'blog' && f.check_type === 'blogger_live')
      || (f.content_kind === 'podcast' && f.check_type === 'spotify_live')
    ) tier = 5;
    // Tier 6: missing secondary cross-post
    else if (['linkedin_crosspost','x_crosspost'].includes(f.check_type)) tier = 6;
    // Tier 7: acknowledged-but-stale
    else if (ackMap.has(key)) {
      const ack = ackMap.get(key)!;
      const ackAge = (Date.now() - new Date(ack.acknowledged_at).getTime()) / 86_400_000;
      if (ackAge > 14) tier = 7;
      else continue; // ack is fresh; not in todo list
    }
    // Tier 8: never-been-green > 7d (no last_good)
    else if (!lastGoodMap.has(key)) tier = 8;
    else continue; // green-leaning, skip

    const ack = ackMap.get(key);
    const issueId = issueMap.get(key);
    let suggested: string;
    if (issueId) suggested = 'Track in linked issue';
    else if (ack) suggested = 'Re-evaluate ack';
    else if (tier === 1) suggested = 'Investigate regression — file issue';
    else suggested = 'Acknowledge or file issue';

    todos.push({
      priority_tier: tier,
      priority_label: TIER_LABELS[tier],
      content_code: f.content_code,
      content_kind: f.content_kind,
      content_title: f.content_title,
      check_type: f.check_type,
      last_error: f.error_detail,
      last_known_good_at: lastGoodMap.get(key) || null,
      suggested_action: suggested,
      existing_ack_id: ack?.ack_id ?? null,
      existing_issue_id: issueId ?? null,
    });
  }

  // Sort by tier asc, then content_code asc
  todos.sort((a, b) => a.priority_tier - b.priority_tier || a.content_code.localeCompare(b.content_code));

  return jsonResponse({ todos: todos.slice(0, 200), tier_labels: TIER_LABELS }, 200);
};
```

- [ ] **Step 2: Curl test**

```bash
curl "http://localhost:8788/api/dashboard/qa/todos" -H "Cookie: session_id=<tester>"
```
Expected: HTTP 200, body has `todos: [...]` sorted by `priority_tier`.

- [ ] **Step 3: Commit**

```bash
git add functions/api/dashboard/qa/todos.ts
git commit -m "feat(qa): GET /qa/todos with 8-tier risk-weighted ordering"
```

---

### Task 22: POST /api/dashboard/qa/refresh

**Files:**
- Create: `/Users/amtoc/amtocbot-site/functions/api/dashboard/qa/refresh.ts`

- [ ] **Step 1: Write the endpoint**

```typescript
/**
 * POST /api/dashboard/qa/refresh
 * Triggers GH Actions workflow_dispatch on amtocbot-droid/amtocsoft-content/.github/workflows/qa-suite.yml.
 * Returns 202 with tracking_run_after timestamp; UI polls /qa/runs?since=<that>.
 * Optional body: { kind?: string, code?: string, check_only?: string }
 */
import {
  Env, jsonResponse, optionsHandler, requirePermission, logAudit,
} from './_shared';

export const onRequestOptions = optionsHandler;

const GH_OWNER = 'amtocbot-droid';
const GH_REPO = 'amtocsoft-content';
const GH_WORKFLOW = 'qa-suite.yml';
const GH_REF = 'main';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const db = env.ENGAGE_DB;
  const auth = await requirePermission(request, db, 'qa.refresh');
  if (auth instanceof Response) return auth;
  const user = auth;

  const pat = (env as any).GH_REPOSITORY_DISPATCH_TOKEN as string | undefined;
  if (!pat) return jsonResponse({ error: 'GH_REPOSITORY_DISPATCH_TOKEN not configured' }, 500);

  let body: { kind?: string; code?: string; check_only?: string } = {};
  try { body = await request.json(); } catch { /* optional */ }

  const trackingRunAfter = new Date().toISOString();

  const ghRes = await fetch(
    `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/actions/workflows/${GH_WORKFLOW}/dispatches`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${pat}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'amtocbot-site',
      },
      body: JSON.stringify({
        ref: GH_REF,
        inputs: {
          ...(body.kind ? { kind: body.kind } : {}),
          ...(body.code ? { code: body.code } : {}),
          ...(body.check_only ? { check_only: body.check_only } : {}),
        },
      }),
    }
  );

  if (!ghRes.ok) {
    const errText = await ghRes.text();
    return jsonResponse({ error: 'GitHub dispatch failed', detail: errText, status: ghRes.status }, 502);
  }

  await logAudit(db, user.id, user.username, 'qa.refresh_triggered',
    JSON.stringify({ inputs: body, tracking_run_after: trackingRunAfter }),
    request.headers.get('cf-connecting-ip'));

  return jsonResponse({ tracking_run_after: trackingRunAfter, status: 'dispatched' }, 202);
};
```

- [ ] **Step 2: Set GH_REPOSITORY_DISPATCH_TOKEN in Pages env**

Generate a fine-grained PAT scoped to `amtocbot-droid/amtocsoft-content` with `actions: write` permission. Save it as a Cloudflare Pages env variable:
- Name: `GH_REPOSITORY_DISPATCH_TOKEN`
- Type: encrypted
- Environment: Production AND Preview

Trigger a redeploy.

- [ ] **Step 3: Curl test (will hit GitHub — be careful)**

This actually triggers a workflow run. Skip until Phase 5 if the workflow doesn't exist yet, or test against a dummy workflow.

For now, verify the auth gate:
```bash
curl -i -X POST http://localhost:8788/api/dashboard/qa/refresh \
  -H "Cookie: session_id=<reviewer>" -H "Content-Type: application/json" -d '{}'
```
Expected: HTTP 403 (reviewer lacks `qa.refresh`).

- [ ] **Step 4: Commit**

```bash
git add functions/api/dashboard/qa/refresh.ts
git commit -m "feat(qa): POST /qa/refresh triggers GH Actions workflow_dispatch"
```

---

### Task 23: GET /api/dashboard/qa/signoff/eligibility

**Files:**
- Create: `/Users/amtoc/amtocbot-site/functions/api/dashboard/qa/signoff/eligibility.ts`

- [ ] **Step 1: Make directory**

```bash
mkdir -p /Users/amtoc/amtocbot-site/functions/api/dashboard/qa/signoff
```

- [ ] **Step 2: Write the endpoint**

```typescript
/**
 * GET /api/dashboard/qa/signoff/eligibility
 * Returns { eligible: bool, blockers: [...], summary: {...} }
 */
import {
  Env, jsonResponse, optionsHandler, requirePermission,
  QaCheckType, QaContentKind, QaCheckStatus,
} from '../_shared';

export const onRequestOptions = optionsHandler;

interface Blocker {
  content_code: string;
  check_type: QaCheckType;
  why: 'no_ack_no_issue' | 'regression_unaddressed';
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const db = env.ENGAGE_DB;
  const auth = await requirePermission(request, db, 'qa.view');
  if (auth instanceof Response) return auth;

  const latest = await db.prepare(
    `SELECT id FROM qa_runs WHERE finished_at IS NOT NULL ORDER BY started_at DESC LIMIT 1`
  ).first<{ id: number }>();
  if (!latest) return jsonResponse({ eligible: true, blockers: [], summary: { steady_green: 0, new_green: 0, persistent_fail: 0, regressions: 0 }, run_id: null }, 200);

  const lastSignoff = await db.prepare(
    `SELECT based_on_run_id, signed_at FROM qa_weekly_signoffs ORDER BY week_start_date DESC LIMIT 1`
  ).first<{ based_on_run_id: number; signed_at: string }>();

  // Latest run: fail rows
  const { results: latestRows } = await db.prepare(
    `SELECT content_code, check_type, status FROM qa_check_results WHERE run_id = ?`
  ).bind(latest.id).all<{ content_code: string; check_type: QaCheckType; status: QaCheckStatus }>();

  const latestStatus = new Map<string, QaCheckStatus>();
  for (const r of latestRows || []) latestStatus.set(`${r.content_code}|${r.check_type}`, r.status);

  // Prior pass set
  const priorPass = new Set<string>();
  if (lastSignoff) {
    const { results: priors } = await db.prepare(
      `SELECT content_code, check_type, status FROM qa_check_results WHERE run_id = ? AND status = 'pass'`
    ).bind(lastSignoff.based_on_run_id).all<{ content_code: string; check_type: QaCheckType }>();
    for (const p of priors || []) priorPass.add(`${p.content_code}|${p.check_type}`);
  }

  // Active acks (with timestamp for freshness check)
  const ackMap = new Map<string, { ack_id: number; acknowledged_at: string }>();
  const { results: acks } = await db.prepare(
    `SELECT id, content_code, check_type, acknowledged_at FROM qa_acknowledgements
     WHERE cleared_at IS NULL AND expires_at > datetime('now')`
  ).all<{ id: number; content_code: string; check_type: QaCheckType; acknowledged_at: string }>();
  for (const a of acks || []) ackMap.set(`${a.content_code}|${a.check_type}`, { ack_id: a.id, acknowledged_at: a.acknowledged_at });

  // Linked open issues (with created_at for freshness check)
  const issueMap = new Map<string, { issue_id: number; created_at: string }>();
  const { results: issues } = await db.prepare(
    `SELECT id, qa_content_code, qa_check_type, created_at FROM issues
     WHERE status IN ('open','in_progress') AND qa_content_code IS NOT NULL`
  ).all<{ id: number; qa_content_code: string; qa_check_type: string; created_at: string }>();
  for (const i of issues || []) issueMap.set(`${i.qa_content_code}|${i.qa_check_type}`, { issue_id: i.id, created_at: i.created_at });

  const blockers: Blocker[] = [];
  let countSteadyGreen = 0, countNewGreen = 0, countPersistentFail = 0, countRegressions = 0;

  for (const [key, status] of latestStatus) {
    if (status === 'pass') {
      if (priorPass.has(key)) countSteadyGreen++;
      else countNewGreen++;  // was fail (or absent), now pass
      continue;
    }
    if (status !== 'fail') continue;

    const [content_code, check_type] = key.split('|') as [string, QaCheckType];
    const isRegression = lastSignoff && priorPass.has(key);
    const ack = ackMap.get(key);
    const issue = issueMap.get(key);

    if (isRegression) {
      // Must have FRESH addressing (after lastSignoff.signed_at)
      const ackFresh = ack && ack.acknowledged_at > lastSignoff!.signed_at;
      const issueFresh = issue && issue.created_at > lastSignoff!.signed_at;
      if (!ackFresh && !issueFresh) {
        blockers.push({ content_code, check_type, why: 'regression_unaddressed' });
        countRegressions++;
      } else {
        countRegressions++;  // counted but not blocking
      }
    } else {
      // Persistent fail: any active ack OR open issue is enough
      if (!ack && !issue) {
        blockers.push({ content_code, check_type, why: 'no_ack_no_issue' });
      }
      countPersistentFail++;
    }
  }

  return jsonResponse({
    eligible: blockers.length === 0,
    run_id: latest.id,
    based_on_run_id: latest.id,
    last_signoff: lastSignoff,
    blockers,
    summary: {
      steady_green: countSteadyGreen,
      new_green: countNewGreen,
      persistent_fail: countPersistentFail,
      regressions: countRegressions,
    },
  }, 200);
};
```

- [ ] **Step 3: Curl test**

```bash
curl "http://localhost:8788/api/dashboard/qa/signoff/eligibility" -H "Cookie: session_id=<tester>"
```
Expected: HTTP 200, body has `eligible`, `blockers`, `summary`.

- [ ] **Step 4: Commit**

```bash
git add functions/api/dashboard/qa/signoff/eligibility.ts
git commit -m "feat(qa): GET /qa/signoff/eligibility computes blockers and summary"
```

---

### Task 24: POST /api/dashboard/qa/signoff

**Files:**
- Create: `/Users/amtoc/amtocbot-site/functions/api/dashboard/qa/signoff/index.ts`

- [ ] **Step 1: Write the endpoint**

```typescript
/**
 * POST /api/dashboard/qa/signoff
 * Body: { week_start_date: 'YYYY-MM-DD', notes?: string }
 * Re-runs eligibility server-side; 409 if blocked.
 */
import {
  Env, jsonResponse, optionsHandler, requirePermission, logAudit,
} from '../_shared';

export const onRequestOptions = optionsHandler;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const db = env.ENGAGE_DB;
  const auth = await requirePermission(request, db, 'qa.signoff');
  if (auth instanceof Response) return auth;
  const user = auth;

  let body: { week_start_date?: string; notes?: string };
  try { body = await request.json(); } catch { return jsonResponse({ error: 'invalid JSON' }, 400); }

  if (!body.week_start_date || !/^\d{4}-\d{2}-\d{2}$/.test(body.week_start_date)) {
    return jsonResponse({ error: 'week_start_date must be YYYY-MM-DD' }, 422);
  }
  // Verify it's a Monday
  const d = new Date(body.week_start_date + 'T00:00:00Z');
  if (d.getUTCDay() !== 1) {
    return jsonResponse({ error: 'week_start_date must be a Monday' }, 422);
  }

  // Fetch eligibility internally (re-implement minimally to avoid HTTP self-call)
  const latest = await db.prepare(
    `SELECT id FROM qa_runs WHERE finished_at IS NOT NULL ORDER BY started_at DESC LIMIT 1`
  ).first<{ id: number }>();
  if (!latest) return jsonResponse({ error: 'no completed runs' }, 409);

  // Call eligibility logic (inline copy to avoid duplicate fetch overhead — kept identical to eligibility.ts)
  const eligibilityRes = await fetch(new URL(request.url).origin + '/api/dashboard/qa/signoff/eligibility', {
    headers: { 'Cookie': request.headers.get('Cookie') || '' },
  });
  const elig = await eligibilityRes.json() as any;
  if (!elig.eligible) {
    return jsonResponse({ error: 'not eligible', blockers: elig.blockers }, 409);
  }

  // Insert signoff
  try {
    const result = await db.prepare(
      `INSERT INTO qa_weekly_signoffs
        (week_start_date, signed_by, based_on_run_id,
         count_regressions, count_persistent, count_new_green, count_steady_green, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      body.week_start_date, user.id, latest.id,
      elig.summary.regressions, elig.summary.persistent_fail,
      elig.summary.new_green, elig.summary.steady_green,
      body.notes || null,
    ).run();

    const signoffId = result.meta.last_row_id as number;
    await logAudit(db, user.id, user.username, 'qa.signoff',
      JSON.stringify({ signoff_id: signoffId, week_start_date: body.week_start_date, run_id: latest.id, counts: elig.summary }),
      request.headers.get('cf-connecting-ip'));

    return jsonResponse({ signoff_id: signoffId, summary: elig.summary }, 201);
  } catch (e: any) {
    if (String(e.message).includes('UNIQUE')) {
      return jsonResponse({ error: 'already signed off this week' }, 409);
    }
    throw e;
  }
};
```

- [ ] **Step 2: Curl test (must be eligible)**

```bash
curl -i -X POST http://localhost:8788/api/dashboard/qa/signoff \
  -H "Cookie: session_id=<tester>" -H "Content-Type: application/json" \
  -d '{"week_start_date":"2026-04-27","notes":"all clear"}'
```
Expected: HTTP 201 if eligible, HTTP 409 with blocker list otherwise.

- [ ] **Step 3: Commit**

```bash
git add functions/api/dashboard/qa/signoff/index.ts
git commit -m "feat(qa): POST /qa/signoff with server-side eligibility re-check"
```

---

### Task 25: GET /api/dashboard/qa/history/heatmap

**Files:**
- Create: `/Users/amtoc/amtocbot-site/functions/api/dashboard/qa/history/heatmap.ts`

- [ ] **Step 1: Make directory**

```bash
mkdir -p /Users/amtoc/amtocbot-site/functions/api/dashboard/qa/history
```

- [ ] **Step 2: Write the endpoint**

```typescript
/**
 * GET /api/dashboard/qa/history/heatmap?days=90
 * Returns: [{content_code, content_kind, check_type, pct_green, sample_count}]
 */
import { Env, jsonResponse, optionsHandler, requirePermission, QaCheckType, QaContentKind } from '../_shared';

export const onRequestOptions = optionsHandler;

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const db = env.ENGAGE_DB;
  const auth = await requirePermission(request, db, 'qa.view');
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '90', 10), 7), 365);

  const { results } = await db.prepare(
    `SELECT
       content_code,
       MAX(content_kind) AS content_kind,
       MAX(content_title) AS content_title,
       check_type,
       COUNT(*) AS sample_count,
       ROUND(100.0 * SUM(CASE WHEN status='pass' THEN 1 ELSE 0 END) / COUNT(*), 1) AS pct_green,
       SUM(CASE WHEN status='fail' THEN 1 ELSE 0 END) AS fail_count,
       SUM(CASE WHEN status='unknown' THEN 1 ELSE 0 END) AS unknown_count
     FROM qa_check_results
     WHERE checked_at > datetime('now', '-' || ? || ' days')
       AND status IN ('pass','fail','unknown')
     GROUP BY content_code, check_type
     ORDER BY content_code, check_type`
  ).bind(days).all<{
    content_code: string; content_kind: QaContentKind; content_title: string | null;
    check_type: QaCheckType; sample_count: number; pct_green: number; fail_count: number; unknown_count: number;
  }>();

  return jsonResponse({ days, cells: results || [] }, 200);
};
```

- [ ] **Step 3: Curl test**

```bash
curl "http://localhost:8788/api/dashboard/qa/history/heatmap?days=90" -H "Cookie: session_id=<tester>"
```
Expected: HTTP 200, body has `cells: [{content_code, check_type, pct_green, sample_count}]`.

- [ ] **Step 4: Commit**

```bash
git add functions/api/dashboard/qa/history/heatmap.ts
git commit -m "feat(qa): GET /qa/history/heatmap aggregation"
```

---

### Task 26: GET /api/dashboard/qa/history/trend

**Files:**
- Create: `/Users/amtoc/amtocbot-site/functions/api/dashboard/qa/history/trend.ts`

- [ ] **Step 1: Write the endpoint**

```typescript
/**
 * GET /api/dashboard/qa/history/trend?weeks=26
 * Returns: [{week_start, check_type, fail_count, sample_count}]
 */
import { Env, jsonResponse, optionsHandler, requirePermission, QaCheckType } from '../_shared';

export const onRequestOptions = optionsHandler;

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const db = env.ENGAGE_DB;
  const auth = await requirePermission(request, db, 'qa.view');
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const weeks = Math.min(Math.max(parseInt(url.searchParams.get('weeks') || '26', 10), 4), 104);

  const { results } = await db.prepare(
    `SELECT
       date(checked_at, 'weekday 0', '-6 days') AS week_start,
       check_type,
       COUNT(*) AS sample_count,
       SUM(CASE WHEN status='fail' THEN 1 ELSE 0 END) AS fail_count
     FROM qa_check_results
     WHERE checked_at > datetime('now', '-' || ? || ' days')
       AND status IN ('pass','fail')
     GROUP BY week_start, check_type
     ORDER BY week_start ASC, check_type`
  ).bind(weeks * 7).all<{
    week_start: string; check_type: QaCheckType; sample_count: number; fail_count: number;
  }>();

  return jsonResponse({ weeks, points: results || [] }, 200);
};
```

- [ ] **Step 2: Curl test**

```bash
curl "http://localhost:8788/api/dashboard/qa/history/trend?weeks=26" -H "Cookie: session_id=<tester>"
```
Expected: HTTP 200, body has `points: [{week_start, check_type, fail_count}]`.

- [ ] **Step 3: Commit**

```bash
git add functions/api/dashboard/qa/history/trend.ts
git commit -m "feat(qa): GET /qa/history/trend weekly aggregation"
```

---

### Task 27: GET /api/dashboard/qa/history/signoffs

**Files:**
- Create: `/Users/amtoc/amtocbot-site/functions/api/dashboard/qa/history/signoffs/index.ts`

- [ ] **Step 1: Make directory**

```bash
mkdir -p /Users/amtoc/amtocbot-site/functions/api/dashboard/qa/history/signoffs
```

- [ ] **Step 2: Write the endpoint**

```typescript
/**
 * GET /api/dashboard/qa/history/signoffs
 * Lists all weekly sign-offs newest first.
 */
import { Env, jsonResponse, optionsHandler, requirePermission, QaWeeklySignoffRow } from '../../_shared';

export const onRequestOptions = optionsHandler;

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const db = env.ENGAGE_DB;
  const auth = await requirePermission(request, db, 'qa.view');
  if (auth instanceof Response) return auth;

  const { results } = await db.prepare(
    `SELECT s.*, u.username AS signed_by_username
     FROM qa_weekly_signoffs s
     LEFT JOIN users u ON s.signed_by = u.id
     ORDER BY week_start_date DESC LIMIT 200`
  ).all<QaWeeklySignoffRow & { signed_by_username: string }>();

  return jsonResponse({ signoffs: results || [] }, 200);
};
```

- [ ] **Step 3: Curl test**

```bash
curl "http://localhost:8788/api/dashboard/qa/history/signoffs" -H "Cookie: session_id=<tester>"
```
Expected: HTTP 200.

- [ ] **Step 4: Commit**

```bash
git add functions/api/dashboard/qa/history/signoffs/index.ts
git commit -m "feat(qa): GET /qa/history/signoffs list"
```

---

### Task 28: GET /api/dashboard/qa/history/signoffs/[id]

**Files:**
- Create: `/Users/amtoc/amtocbot-site/functions/api/dashboard/qa/history/signoffs/[id].ts`

- [ ] **Step 1: Write the endpoint**

```typescript
/**
 * GET /api/dashboard/qa/history/signoffs/[id]
 * Returns the matrix snapshot as it was at this signoff (uses based_on_run_id).
 */
import { Env, jsonResponse, optionsHandler, requirePermission, QaCheckType, QaContentKind, QaCheckStatus } from '../../_shared';

export const onRequestOptions = optionsHandler;

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  const db = env.ENGAGE_DB;
  const auth = await requirePermission(request, db, 'qa.view');
  if (auth instanceof Response) return auth;

  const id = parseInt(params.id as string, 10);
  if (isNaN(id)) return jsonResponse({ error: 'invalid id' }, 400);

  const signoff = await db.prepare(
    `SELECT s.*, u.username AS signed_by_username
     FROM qa_weekly_signoffs s LEFT JOIN users u ON s.signed_by = u.id
     WHERE s.id = ?`
  ).bind(id).first<any>();
  if (!signoff) return jsonResponse({ error: 'not found' }, 404);

  const { results } = await db.prepare(
    `SELECT content_code, content_kind, content_title, check_type, status, error_detail
     FROM qa_check_results WHERE run_id = ?`
  ).bind(signoff.based_on_run_id).all<{
    content_code: string; content_kind: QaContentKind; content_title: string | null;
    check_type: QaCheckType; status: QaCheckStatus; error_detail: string | null;
  }>();

  return jsonResponse({ signoff, results: results || [] }, 200);
};
```

- [ ] **Step 2: Curl test**

```bash
curl "http://localhost:8788/api/dashboard/qa/history/signoffs/1" -H "Cookie: session_id=<tester>"
```
Expected: HTTP 200 with signoff + matrix snapshot, or HTTP 404 if no signoffs yet.

- [ ] **Step 3: Commit**

```bash
git add functions/api/dashboard/qa/history/signoffs/'[id].ts'
git commit -m "feat(qa): GET /qa/history/signoffs/[id] drill-through"
```

---

### Task 29: Cron monitor endpoint

**Files:**
- Create: `/Users/amtoc/amtocbot-site/functions/api/cron/qa-monitors.ts`

- [ ] **Step 1: Make directory**

```bash
mkdir -p /Users/amtoc/amtocbot-site/functions/api/cron
```

- [ ] **Step 2: Write the endpoint**

```typescript
/**
 * GET /api/cron/qa-monitors
 * Triggered by Cloudflare Cron every 6h. Sends Brevo email if any condition fires.
 *
 * Conditions:
 *   - No qa_runs.finished_at within last 36h
 *   - >3 ingest 5xx in audit_logs in last 24h
 *   - Eligibility query has >10 blockers for >7 days (rough proxy: latest run total_fail > 10
 *     AND no signoff in last 7 days)
 */
import { Env, jsonResponse, optionsHandler } from '../_shared/auth';

export const onRequestOptions = optionsHandler;

const ALERT_TO = 'hello@amtocbot.com';

async function sendAlertEmail(env: Env, subject: string, htmlBody: string): Promise<void> {
  const apiKey = (env as any).BREVO_API_KEY as string | undefined;
  if (!apiKey) {
    console.error('BREVO_API_KEY not set; cannot send alert');
    return;
  }
  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'content-type': 'application/json',
      'accept': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'AmtocBot QA Monitor', email: 'noreply@amtocbot.com' },
      to: [{ email: ALERT_TO }],
      subject,
      htmlContent: htmlBody,
    }),
  });
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  // Allow only Cloudflare cron internal calls OR a manual trigger with bearer token
  const cf = (request as any).cf;
  const isCron = !!cf?.cronTrigger || request.headers.get('cf-connecting-ip') === '';
  const manualToken = request.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
  const expected = (env as any).QA_INGEST_TOKEN as string | undefined;
  if (!isCron && !(manualToken && expected && manualToken === expected)) {
    return jsonResponse({ error: 'forbidden' }, 403);
  }

  const db = env.ENGAGE_DB;
  const alerts: Array<{ name: string; detail: string }> = [];

  // 1. No run in 36h
  const recent = await db.prepare(
    `SELECT COUNT(*) AS n FROM qa_runs WHERE finished_at > datetime('now', '-36 hours')`
  ).first<{ n: number }>();
  if (!recent || recent.n === 0) {
    alerts.push({ name: 'no_run_36h', detail: 'No QA cron run completed in the last 36 hours.' });
  }

  // 2. Ingest 5xx errors
  const errs = await db.prepare(
    `SELECT COUNT(*) AS n FROM audit_logs
     WHERE action = 'qa.ingest' AND detail LIKE '%"error"%' AND created_at > datetime('now', '-24 hours')`
  ).first<{ n: number }>();
  if (errs && errs.n > 3) {
    alerts.push({ name: 'ingest_5xx', detail: `${errs.n} ingest errors in last 24h.` });
  }

  // 3. Stale blockers (proxy)
  const lastSignoff = await db.prepare(
    `SELECT week_start_date FROM qa_weekly_signoffs ORDER BY week_start_date DESC LIMIT 1`
  ).first<{ week_start_date: string }>();
  if (!lastSignoff || (Date.now() - new Date(lastSignoff.week_start_date).getTime()) > 7 * 86_400_000) {
    const latest = await db.prepare(
      `SELECT total_fail FROM qa_runs WHERE finished_at IS NOT NULL ORDER BY started_at DESC LIMIT 1`
    ).first<{ total_fail: number }>();
    if (latest && latest.total_fail > 10) {
      alerts.push({ name: 'stale_blockers', detail: `Latest run has ${latest.total_fail} failures and no sign-off in 7+ days.` });
    }
  }

  if (alerts.length > 0) {
    const html = '<h2>QA Monitor Alerts</h2><ul>' +
      alerts.map(a => `<li><b>${a.name}</b>: ${a.detail}</li>`).join('') +
      '</ul><p>See <a href="https://amtocbot.com/dashboard">dashboard</a>.</p>';
    await sendAlertEmail(env, `[QA] ${alerts.length} alert(s)`, html);
  }

  return jsonResponse({ alerts, sent: alerts.length > 0 }, 200);
};
```

- [ ] **Step 3: Add Cron Trigger to wrangler.toml**

Edit `/Users/amtoc/amtocbot-site/wrangler.toml` and add (or append to existing `[triggers]` section):

```toml
[triggers]
crons = ["0 */6 * * *"]
```

If the file already has triggers, merge the cron schedule with the existing list.

- [ ] **Step 4: Curl test (manual)**

```bash
curl "http://localhost:8788/api/cron/qa-monitors" -H "Authorization: Bearer $QA_INGEST_TOKEN_LOCAL"
```
Expected: HTTP 200, body `{alerts: [...], sent: bool}`. Locally probably has alerts because there's no run history.

- [ ] **Step 5: Commit**

```bash
git add functions/api/cron/qa-monitors.ts wrangler.toml
git commit -m "feat(qa): cron monitor for missed runs/ingest errors/stale blockers"
```

---

### Task 30: Phase 3 deploy + smoke

**Files:** none

- [ ] **Step 1: Push**

```bash
cd /Users/amtoc/amtocbot-site
git push origin main
```

Wait for Pages deploy (~2 min).

- [ ] **Step 2: Verify all endpoints respond in prod**

For each endpoint, hit with a logged-in session and verify HTTP 200/201/202 as appropriate. Quick script:
```bash
ENDPOINTS=(
  "GET /api/dashboard/qa/matrix"
  "GET /api/dashboard/qa/todos"
  "GET /api/dashboard/qa/runs"
  "GET /api/dashboard/qa/signoff/eligibility"
  "GET /api/dashboard/qa/history/heatmap"
  "GET /api/dashboard/qa/history/trend"
  "GET /api/dashboard/qa/history/signoffs"
)
# Manually run each via curl with prod session cookie
```

- [ ] **Step 3: Tag**

```bash
git tag qa-phase-3-complete
```

**Phase 3 done. Backend complete. Ready for Python suite.**

---

## Phase 4 — Python Check Suite

All work in `/Users/amtoc/amtocsoft-content/`. The suite reuses existing scripts (`check-tracker.py`, `check-links.py`, `check-watermarks.py`, the YouTube/Blogger token files) and adds per-check modules + an orchestrator.

### Task 31: Add deps to requirements.txt

**Files:**
- Modify: `/Users/amtoc/amtocsoft-content/scripts/requirements.txt` (create if absent)

- [ ] **Step 1: Check existing**

Run: `cat /Users/amtoc/amtocsoft-content/scripts/requirements.txt 2>/dev/null || echo "not found"`

- [ ] **Step 2: Write/update requirements.txt**

Append (or create) with:

```
# QA Suite deps
requests>=2.31.0
google-api-python-client>=2.100.0
google-auth-httplib2>=0.1.1
google-auth-oauthlib>=1.0.0
Pillow>=10.0.0
```

If file already has these, leave them. The watermark.py uses Pillow already.

- [ ] **Step 3: Verify install in a fresh venv**

```bash
cd /Users/amtoc/amtocsoft-content
python3 -m venv /tmp/qa-venv
/tmp/qa-venv/bin/pip install -r scripts/requirements.txt
```
Expected: all packages install without error.

- [ ] **Step 4: Commit**

```bash
cd /Users/amtoc/amtocsoft-content
git add scripts/requirements.txt
git commit -m "build(qa): add requirements.txt with check-suite deps"
```

---

### Task 32: qa-checks package skeleton

**Files:**
- Create: `/Users/amtoc/amtocsoft-content/scripts/qa_checks/__init__.py`

(Note: Python identifiers can't have hyphens; use `qa_checks` as module name even though spec said `qa-checks` in path.)

- [ ] **Step 1: Make directory**

```bash
mkdir -p /Users/amtoc/amtocsoft-content/scripts/qa_checks
```

- [ ] **Step 2: Write __init__.py**

```python
"""QA traceability check suite. Each module exports check_* functions
returning {'status': 'pass'|'fail'|'na'|'unknown', 'error_detail'?: str}.
"""
from typing import TypedDict, Literal, Optional

CheckStatus = Literal['pass', 'fail', 'na', 'unknown']

class CheckResult(TypedDict, total=False):
    status: CheckStatus
    error_detail: str

def ok() -> CheckResult:
    return {'status': 'pass'}

def na() -> CheckResult:
    return {'status': 'na'}

def fail(detail: str) -> CheckResult:
    return {'status': 'fail', 'error_detail': detail}

def unknown(detail: str) -> CheckResult:
    return {'status': 'unknown', 'error_detail': detail}
```

- [ ] **Step 3: Commit**

```bash
git add scripts/qa_checks/__init__.py
git commit -m "feat(qa): qa_checks package skeleton"
```

---

### Task 33: content_inventory.py — parse tracker.md

**Files:**
- Create: `/Users/amtoc/amtocsoft-content/scripts/qa_checks/content_inventory.py`

- [ ] **Step 1: Write the module**

```python
"""Parse metrics/content-tracker.md → list of content rows."""
from pathlib import Path
from typing import Optional, Iterator
import re

# Map content_code prefix → content_kind (per spec)
KIND_BY_PREFIX = {
    'T': 'tale',
    'P': 'podcast',
    'V': 'video',
    'LA': 'linkedin_article',
}

def _detect_kind(code: str) -> str:
    if code.startswith('LA-'):
        return 'linkedin_article'
    if len(code) >= 2 and code[0] in 'TPV' and code[1].isdigit():
        return KIND_BY_PREFIX[code[0]]
    if re.fullmatch(r'\d{3}', code):
        # bare 3-digit number is blog or tutorial; treat as blog by default
        # (tutorial blogs are post 126+, but there's no tracker-side discriminator
        #  except the post body. We'll classify by code range conservatively.)
        n = int(code)
        return 'tutorial' if n >= 126 else 'blog'
    return 'unknown'

def enumerate_all(repo_root: Path, kind: Optional[str] = None, code: Optional[str] = None) -> list[dict]:
    """Returns list of {code, kind, title, status, urls: {...}}."""
    tracker = repo_root / 'metrics' / 'content-tracker.md'
    if not tracker.exists():
        raise FileNotFoundError(f"tracker not found: {tracker}")

    items = []
    for row in _iter_table_rows(tracker):
        if not row or len(row) < 5:
            continue
        # Tracker columns vary; we extract by header position.
        code_cell = row.get('code') or row.get('Code') or ''
        if not code_cell or code_cell == '-':
            continue
        item = {
            'code': code_cell.strip(),
            'kind': _detect_kind(code_cell.strip()),
            'title': (row.get('title') or row.get('Title') or '').strip(),
            'status': (row.get('status') or row.get('Status') or '').strip(),
            'youtube_url': _extract_url(row.get('youtube') or row.get('YouTube') or ''),
            'blogger_url': _extract_url(row.get('blog') or row.get('Blog') or row.get('blogger') or ''),
            'spotify_url': _extract_url(row.get('spotify') or row.get('Spotify') or ''),
            'linkedin_url': _extract_url(row.get('linkedin') or row.get('LinkedIn') or ''),
            'x_url': _extract_url(row.get('x') or row.get('twitter') or row.get('X') or ''),
            '_raw': row,
        }
        if kind and item['kind'] != kind:
            continue
        if code and item['code'] != code:
            continue
        items.append(item)
    return items

def _iter_table_rows(path: Path) -> Iterator[dict]:
    """Parse markdown tables from the tracker. Yield dict per row keyed by header."""
    headers: list[str] = []
    in_table = False
    for line in path.read_text(encoding='utf-8').splitlines():
        line = line.rstrip()
        if line.startswith('|') and line.endswith('|'):
            cells = [c.strip() for c in line.strip('|').split('|')]
            # Skip separator rows (---)
            if all(re.fullmatch(r':?-+:?', c) for c in cells if c):
                in_table = True
                continue
            if not in_table or not headers:
                # First row of a new table = headers
                headers = [_normalize_header(c) for c in cells]
                in_table = False
                continue
            yield dict(zip(headers, cells))
        else:
            in_table = False
            headers = []

def _normalize_header(h: str) -> str:
    return h.lower().replace(' ', '_').replace('/', '_')

def _extract_url(cell: str) -> Optional[str]:
    """Pull the first http(s) URL out of a markdown cell, or None.
    Returns '— FAILED' literally if cell contains that string."""
    if not cell:
        return None
    if '— FAILED' in cell or '-- FAILED' in cell:
        return '— FAILED'
    # Markdown link: [text](url)
    md = re.search(r'\[[^\]]*\]\((https?://[^\)]+)\)', cell)
    if md:
        return md.group(1).strip()
    bare = re.search(r'https?://\S+', cell)
    if bare:
        return bare.group(0).strip()
    return None
```

- [ ] **Step 2: Smoke test**

```bash
cd /Users/amtoc/amtocsoft-content
python3 -c "
from pathlib import Path
import sys; sys.path.insert(0, 'scripts')
from qa_checks.content_inventory import enumerate_all
items = enumerate_all(Path('.'))
print(f'Found {len(items)} items')
print('First 3:', items[:3])
print('T014:', [i for i in items if i['code'] == 'T014'])
"
```
Expected: prints item count > 0 and the T014 row with kind='tale'.

- [ ] **Step 3: Commit**

```bash
git add scripts/qa_checks/content_inventory.py
git commit -m "feat(qa): content_inventory parses tracker.md → row dicts"
```

---

### Task 34: tracker_checks.py

**Files:**
- Create: `/Users/amtoc/amtocsoft-content/scripts/qa_checks/tracker_checks.py`

- [ ] **Step 1: Write the module**

```python
"""Checks driven by the tracker.md row itself + simple URL HEAD."""
import re, requests
from . import CheckResult, ok, fail, na, unknown

def check_in_tracker(item: dict) -> CheckResult:
    """Pass if status == Published in tracker."""
    if item.get('status', '').lower() == 'published':
        return ok()
    if item.get('status', '').lower() in ('scheduled', 'draft', ''):
        return fail(f"status is {item.get('status') or '(empty)'} (not Published)")
    return fail(f"status is {item['status']}")

PROFILE_URL_PATTERNS = [
    re.compile(r'^https?://(www\.)?linkedin\.com/in/'),
    re.compile(r'^https?://x\.com/AmToc96282/?$'),  # base profile only
    re.compile(r'^https?://(www\.)?youtube\.com/@'),
]

def check_tracker_url_valid(item: dict) -> CheckResult:
    """Pass if the primary URL is a real post URL, not a profile URL or '— FAILED'."""
    primary_url = (
        item.get('youtube_url') or item.get('blogger_url')
        or item.get('spotify_url') or item.get('linkedin_url') or item.get('x_url')
    )
    if not primary_url:
        return fail('no primary URL recorded')
    if primary_url == '— FAILED':
        return fail('URL marked — FAILED')
    for pat in PROFILE_URL_PATTERNS:
        if pat.match(primary_url):
            return fail(f'profile URL written instead of post URL: {primary_url}')
    return ok()

def check_live_url_200(item: dict) -> CheckResult:
    """HEAD the primary URL, expect 200/2xx."""
    url = (
        item.get('youtube_url') or item.get('blogger_url')
        or item.get('spotify_url') or item.get('linkedin_url') or item.get('x_url')
    )
    if not url or url == '— FAILED':
        return fail('no live URL to check')
    try:
        r = requests.head(url, allow_redirects=True, timeout=10, headers={'User-Agent': 'amtocbot-qa'})
        # YouTube returns 405 for HEAD on /watch — fall back to GET with stream
        if r.status_code in (405, 403):
            r = requests.get(url, allow_redirects=True, timeout=10, stream=True, headers={'User-Agent': 'amtocbot-qa'})
            r.close()
        if 200 <= r.status_code < 300:
            return ok()
        return fail(f'HTTP {r.status_code}')
    except requests.exceptions.Timeout:
        return unknown('timeout')
    except requests.exceptions.RequestException as e:
        return unknown(f'request error: {type(e).__name__}: {e}')
```

- [ ] **Step 2: Smoke test**

```bash
cd /Users/amtoc/amtocsoft-content
python3 -c "
import sys; sys.path.insert(0, 'scripts')
from qa_checks.content_inventory import enumerate_all
from qa_checks.tracker_checks import check_in_tracker, check_tracker_url_valid, check_live_url_200
from pathlib import Path
items = enumerate_all(Path('.'), code='T014')
if items:
    item = items[0]
    print('in_tracker:', check_in_tracker(item))
    print('tracker_url_valid:', check_tracker_url_valid(item))
    print('live_url_200:', check_live_url_200(item))
"
```
Expected: 3 lines printed, each with a `status:` key.

- [ ] **Step 3: Commit**

```bash
git add scripts/qa_checks/tracker_checks.py
git commit -m "feat(qa): tracker_checks (in_tracker, tracker_url_valid, live_url_200)"
```

---

### Task 35: watermark_checks.py

**Files:**
- Create: `/Users/amtoc/amtocsoft-content/scripts/qa_checks/watermark_checks.py`

- [ ] **Step 1: Write the module**

```python
"""Watermark gate. Reuses scripts/watermark.py is_watermarked()."""
from pathlib import Path
import sys, glob
from . import CheckResult, ok, fail, na, unknown

# Import the existing watermark utility
def _import_watermark(repo_root: Path):
    sys.path.insert(0, str(repo_root / 'scripts'))
    try:
        import watermark  # noqa: F401
        return watermark
    except ImportError:
        return None

def _candidate_paths(item: dict, repo_root: Path) -> list[Path]:
    """Return candidate final-output asset paths to verify watermark on."""
    code = item['code']
    kind = item['kind']
    paths = []
    if kind == 'tale':
        slug_dirs = list((repo_root / 'video').glob(f'{code}-*'))
        for d in slug_dirs:
            paths.extend(d.glob(f'{code}-*-youtube.mp4'))
            paths.append(d / 'thumbnail.png')
    elif kind == 'podcast':
        slug_dirs = list((repo_root / 'video').glob(f'{code}-*'))
        for d in slug_dirs:
            paths.extend(d.glob(f'{code}-*.mp4'))
            paths.append(d / 'podcast-cover.png')
    elif kind == 'video':
        slug_dirs = list((repo_root / 'video').glob(f'{code}-*'))
        for d in slug_dirs:
            paths.extend(d.glob('AmtocSoft-*.mp4'))
            paths.append(d / 'thumbnail.png')
    elif kind in ('blog', 'tutorial'):
        # blog images live in blog/images/NNN-slug/
        dirs = list((repo_root / 'blog' / 'images').glob(f'{code}-*'))
        for d in dirs:
            paths.extend(d.glob('*.png'))
            paths.extend(d.glob('*.jpg'))
    return [p for p in paths if p.exists()]

def check_watermarked(item: dict, repo_root: Path) -> CheckResult:
    if item['kind'] == 'linkedin_article':
        return na()  # LinkedIn articles don't have watermarkable assets in this scheme

    wm = _import_watermark(repo_root)
    if wm is None:
        return unknown('watermark.py not importable')

    paths = _candidate_paths(item, repo_root)
    if not paths:
        return fail('no candidate assets found for watermark check')

    unstamped = []
    for p in paths:
        try:
            if not wm.is_watermarked(p):
                unstamped.append(str(p.relative_to(repo_root)))
        except Exception as e:
            return unknown(f'watermark check error on {p.name}: {e}')

    if unstamped:
        return fail(f'{len(unstamped)} unstamped: {", ".join(unstamped[:3])}{"..." if len(unstamped) > 3 else ""}')
    return ok()
```

- [ ] **Step 2: Smoke test**

```bash
cd /Users/amtoc/amtocsoft-content
python3 -c "
import sys; sys.path.insert(0, 'scripts')
from pathlib import Path
from qa_checks.content_inventory import enumerate_all
from qa_checks.watermark_checks import check_watermarked
items = enumerate_all(Path('.'), code='T014')
if items:
    print(check_watermarked(items[0], Path('.')))
"
```
Expected: a CheckResult dict.

- [ ] **Step 3: Commit**

```bash
git add scripts/qa_checks/watermark_checks.py
git commit -m "feat(qa): watermark_checks reuses watermark.is_watermarked"
```

---

### Task 36: youtube_checks.py

**Files:**
- Create: `/Users/amtoc/amtocsoft-content/scripts/qa_checks/youtube_checks.py`

- [ ] **Step 1: Write the module**

```python
"""YouTube uploaded / thumbnail / playlist checks via Data API v3."""
from pathlib import Path
import os, re
from . import CheckResult, ok, fail, na, unknown

YT_PLAYLIST_BY_KIND = {
    'tale':    'Timeless Tales',
    'podcast': 'Bot Thoughts Podcast',
    'video':   None,  # main channel feed, no required playlist
}

def _video_id(url: str) -> str | None:
    if not url: return None
    m = re.search(r'(?:v=|youtu\.be/|/embed/|/shorts/)([A-Za-z0-9_-]{11})', url)
    return m.group(1) if m else None

_yt_service = None

def _get_yt_service():
    global _yt_service
    if _yt_service is not None: return _yt_service
    try:
        from googleapiclient.discovery import build
        from google.oauth2.credentials import Credentials
        from google.auth.transport.requests import Request as GoogleRequest
        import json
        token_path = Path.home() / '.config' / 'amtocsoft' / 'youtube_token.json'
        if not token_path.exists():
            return None
        creds = Credentials.from_authorized_user_file(str(token_path),
            ['https://www.googleapis.com/auth/youtube.readonly'])
        if creds.expired and creds.refresh_token:
            creds.refresh(GoogleRequest())
        _yt_service = build('youtube', 'v3', credentials=creds, cache_discovery=False)
        return _yt_service
    except Exception:
        return None

def _kind_uses_youtube(kind: str) -> bool:
    return kind in ('tale', 'podcast', 'video')

def check_youtube_uploaded(item: dict) -> CheckResult:
    if not _kind_uses_youtube(item['kind']):
        return na()
    vid = _video_id(item.get('youtube_url') or '')
    if not vid:
        return fail('no YouTube video ID in tracker')
    yt = _get_yt_service()
    if yt is None:
        return unknown('YouTube API not configured')
    try:
        resp = yt.videos().list(part='status', id=vid).execute()
        if not resp.get('items'):
            return fail(f'video {vid} not found via API')
        privacy = resp['items'][0]['status'].get('privacyStatus', '')
        if privacy != 'public':
            return fail(f'privacy={privacy} (expected public)')
        return ok()
    except Exception as e:
        return unknown(f'YouTube API error: {type(e).__name__}: {e}')

def check_youtube_thumbnail(item: dict) -> CheckResult:
    if not _kind_uses_youtube(item['kind']):
        return na()
    vid = _video_id(item.get('youtube_url') or '')
    if not vid:
        return fail('no YouTube video ID')
    yt = _get_yt_service()
    if yt is None:
        return unknown('YouTube API not configured')
    try:
        resp = yt.videos().list(part='snippet', id=vid).execute()
        if not resp.get('items'):
            return fail(f'video {vid} not found')
        thumbs = resp['items'][0]['snippet'].get('thumbnails', {})
        # Custom thumbnails have 'maxres' or 'standard' present; auto-generated have only default/medium/high
        if 'maxres' in thumbs or 'standard' in thumbs:
            return ok()
        return fail('only auto-generated thumbnails (maxres/standard absent)')
    except Exception as e:
        return unknown(f'YouTube API error: {type(e).__name__}: {e}')

def check_youtube_playlist(item: dict) -> CheckResult:
    target_playlist_name = YT_PLAYLIST_BY_KIND.get(item['kind'])
    if target_playlist_name is None:
        return na()
    vid = _video_id(item.get('youtube_url') or '')
    if not vid:
        return fail('no YouTube video ID')
    yt = _get_yt_service()
    if yt is None:
        return unknown('YouTube API not configured')
    try:
        # Find the playlist ID by name (cached per-process)
        cache = _get_yt_service.__dict__.setdefault('_playlist_cache', {})
        if target_playlist_name not in cache:
            pl = yt.playlists().list(part='snippet', mine=True, maxResults=50).execute()
            for p in pl.get('items', []):
                cache[p['snippet']['title']] = p['id']
        plid = cache.get(target_playlist_name)
        if not plid:
            return unknown(f'playlist "{target_playlist_name}" not found in mine')
        # Search the playlist for the video ID
        next_token = None
        while True:
            req = yt.playlistItems().list(part='contentDetails', playlistId=plid, maxResults=50, pageToken=next_token)
            resp = req.execute()
            for it in resp.get('items', []):
                if it['contentDetails'].get('videoId') == vid:
                    return ok()
            next_token = resp.get('nextPageToken')
            if not next_token:
                break
        return fail(f'video not in playlist "{target_playlist_name}"')
    except Exception as e:
        return unknown(f'YouTube playlist check error: {type(e).__name__}: {e}')
```

- [ ] **Step 2: Smoke test (requires youtube_token.json)**

```bash
cd /Users/amtoc/amtocsoft-content
python3 -c "
import sys; sys.path.insert(0, 'scripts')
from pathlib import Path
from qa_checks.content_inventory import enumerate_all
from qa_checks.youtube_checks import check_youtube_uploaded, check_youtube_thumbnail, check_youtube_playlist
items = enumerate_all(Path('.'), code='T014')
if items:
    item = items[0]
    print('uploaded:', check_youtube_uploaded(item))
    print('thumbnail:', check_youtube_thumbnail(item))
    print('playlist:', check_youtube_playlist(item))
"
```
Expected: 3 results. If `unknown` because no token, that's fine for this smoke step.

- [ ] **Step 3: Commit**

```bash
git add scripts/qa_checks/youtube_checks.py
git commit -m "feat(qa): youtube_checks (uploaded/thumbnail/playlist via Data API)"
```

---

### Task 37: spotify_checks.py

**Files:**
- Create: `/Users/amtoc/amtocsoft-content/scripts/qa_checks/spotify_checks.py`

- [ ] **Step 1: Write**

```python
"""Spotify episode liveness via HTTP HEAD."""
import re, requests
from . import CheckResult, ok, fail, na, unknown

EPISODE_PATTERN = re.compile(r'^https?://open\.spotify\.com/episode/[A-Za-z0-9]+/?')

def check_spotify_live(item: dict) -> CheckResult:
    if item['kind'] != 'podcast':
        return na()
    url = item.get('spotify_url')
    if not url or url == '— FAILED':
        return fail('no Spotify episode URL recorded')
    if not EPISODE_PATTERN.match(url):
        return fail(f'not a Spotify episode URL: {url}')
    try:
        r = requests.head(url, allow_redirects=True, timeout=10, headers={'User-Agent': 'amtocbot-qa'})
        if 200 <= r.status_code < 300:
            return ok()
        return fail(f'HTTP {r.status_code}')
    except requests.exceptions.RequestException as e:
        return unknown(f'request error: {type(e).__name__}: {e}')
```

- [ ] **Step 2: Commit**

```bash
git add scripts/qa_checks/spotify_checks.py
git commit -m "feat(qa): spotify_checks.check_spotify_live"
```

---

### Task 38: blogger_checks.py

**Files:**
- Create: `/Users/amtoc/amtocsoft-content/scripts/qa_checks/blogger_checks.py`

- [ ] **Step 1: Write**

```python
"""Blogger post liveness — HEAD + verify all <img src> return 200."""
import re, requests
from . import CheckResult, ok, fail, na, unknown

POST_PATTERN = re.compile(r'^https?://amtocsoft\.blogspot\.com/\d{4}/\d{2}/[^/]+\.html')

def check_blogger_live(item: dict) -> CheckResult:
    if item['kind'] not in ('blog', 'tutorial'):
        return na()
    url = item.get('blogger_url')
    if not url or url == '— FAILED':
        return fail('no Blogger URL recorded')
    if not POST_PATTERN.match(url):
        return fail(f'not a Blogger post URL: {url}')
    try:
        r = requests.get(url, timeout=15, headers={'User-Agent': 'amtocbot-qa'})
        if r.status_code != 200:
            return fail(f'HTTP {r.status_code}')
        # Scan for <img src> and verify each (cap at 20 to limit time)
        img_srcs = re.findall(r'<img[^>]+src=["\']([^"\']+)["\']', r.text)[:20]
        broken = []
        for src in img_srcs:
            if src.startswith('//'):
                src = 'https:' + src
            if not src.startswith('http'):
                continue
            try:
                ir = requests.head(src, allow_redirects=True, timeout=8)
                if ir.status_code >= 400:
                    broken.append(f'{src} ({ir.status_code})')
            except requests.exceptions.RequestException:
                broken.append(f'{src} (req-err)')
        if broken:
            return fail(f'{len(broken)} broken images: {broken[0]}')
        return ok()
    except requests.exceptions.RequestException as e:
        return unknown(f'request error: {type(e).__name__}: {e}')
```

- [ ] **Step 2: Commit**

```bash
git add scripts/qa_checks/blogger_checks.py
git commit -m "feat(qa): blogger_checks.check_blogger_live with image scan"
```

---

### Task 39: linkedin_checks.py + x_checks.py

**Files:**
- Create: `/Users/amtoc/amtocsoft-content/scripts/qa_checks/linkedin_checks.py`
- Create: `/Users/amtoc/amtocsoft-content/scripts/qa_checks/x_checks.py`

- [ ] **Step 1: Write linkedin_checks.py**

```python
"""LinkedIn cross-post check — verify a real share/activity URL is recorded."""
import re
from . import CheckResult, ok, fail, na

LI_POST_PATTERN = re.compile(
    r'^https?://(www\.)?linkedin\.com/(feed/update/urn:li:(share|activity):|posts/)'
)

def check_linkedin_crosspost(item: dict) -> CheckResult:
    # Only published content needs a LinkedIn cross-post
    if item.get('status', '').lower() != 'published':
        return na()
    url = item.get('linkedin_url')
    if not url or url == '— FAILED':
        return fail('no LinkedIn URL recorded')
    if re.match(r'^https?://(www\.)?linkedin\.com/in/', url):
        return fail(f'profile URL written instead of post URL: {url}')
    if not LI_POST_PATTERN.match(url):
        return fail(f'not a LinkedIn post URL: {url}')
    return ok()
```

- [ ] **Step 2: Write x_checks.py**

```python
"""X (Twitter) cross-post check."""
import re
from . import CheckResult, ok, fail, na

X_POST_PATTERN = re.compile(r'^https?://(twitter\.com|x\.com)/[^/]+/status/\d+')

def check_x_crosspost(item: dict) -> CheckResult:
    if item.get('status', '').lower() != 'published':
        return na()
    url = item.get('x_url')
    if not url or url == '— FAILED':
        return fail('no X URL recorded')
    if not X_POST_PATTERN.match(url):
        return fail(f'not an X post URL: {url}')
    return ok()
```

- [ ] **Step 3: Commit**

```bash
git add scripts/qa_checks/linkedin_checks.py scripts/qa_checks/x_checks.py
git commit -m "feat(qa): linkedin/x cross-post checks"
```

---

### Task 40: github_checks.py — companion repo

**Files:**
- Create: `/Users/amtoc/amtocsoft-content/scripts/qa_checks/github_checks.py`

- [ ] **Step 1: Write**

```python
"""Companion repo check for tutorial blogs (post 126+)."""
import os, re, requests
from . import CheckResult, ok, fail, na, unknown

EXAMPLES_OWNER = 'amtocbot-droid'
EXAMPLES_REPO  = 'amtocbot-examples'

def check_companion_repo(item: dict) -> CheckResult:
    if item['kind'] != 'tutorial':
        return na()
    code = item['code']
    if not re.fullmatch(r'\d{3}', code):
        return na()
    try:
        n = int(code)
    except ValueError:
        return na()
    if n < 126:
        return na()

    # Look for any directory whose name starts with NNN- in the examples repo
    api_url = f'https://api.github.com/repos/{EXAMPLES_OWNER}/{EXAMPLES_REPO}/contents/'
    headers = {'User-Agent': 'amtocbot-qa', 'Accept': 'application/vnd.github+json'}
    token = os.environ.get('GH_TOKEN') or os.environ.get('GITHUB_TOKEN')
    if token:
        headers['Authorization'] = f'Bearer {token}'
    try:
        r = requests.get(api_url, headers=headers, timeout=15)
        if r.status_code == 404:
            return fail(f'examples repo {EXAMPLES_OWNER}/{EXAMPLES_REPO} not found')
        if r.status_code != 200:
            return unknown(f'GitHub API HTTP {r.status_code}')
        for entry in r.json():
            if entry.get('type') == 'dir' and entry.get('name', '').startswith(f'{code}-'):
                return ok()
        return fail(f'no directory starting with {code}- in examples repo')
    except requests.exceptions.RequestException as e:
        return unknown(f'request error: {type(e).__name__}: {e}')
```

- [ ] **Step 2: Commit**

```bash
git add scripts/qa_checks/github_checks.py
git commit -m "feat(qa): github_checks.check_companion_repo"
```

---

### Task 41: qa-suite.py orchestrator

**Files:**
- Create: `/Users/amtoc/amtocsoft-content/scripts/qa-suite.py`

- [ ] **Step 1: Write the orchestrator**

```python
#!/usr/bin/env python3
"""QA suite orchestrator — runs all 12 checks for every (or filtered) content item,
posts results to /api/dashboard/qa/ingest.
"""
import argparse, json, os, sys, time, uuid
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / 'scripts'))

from qa_checks.content_inventory import enumerate_all
from qa_checks.tracker_checks import check_in_tracker, check_tracker_url_valid, check_live_url_200
from qa_checks.watermark_checks import check_watermarked
from qa_checks.youtube_checks import check_youtube_uploaded, check_youtube_thumbnail, check_youtube_playlist
from qa_checks.spotify_checks import check_spotify_live
from qa_checks.blogger_checks import check_blogger_live
from qa_checks.linkedin_checks import check_linkedin_crosspost
from qa_checks.x_checks import check_x_crosspost
from qa_checks.github_checks import check_companion_repo

CHECK_RUNNERS = [
    ('in_tracker',         lambda i, root: check_in_tracker(i)),
    ('tracker_url_valid',  lambda i, root: check_tracker_url_valid(i)),
    ('live_url_200',       lambda i, root: check_live_url_200(i)),
    ('watermarked',        lambda i, root: check_watermarked(i, root)),
    ('youtube_uploaded',   lambda i, root: check_youtube_uploaded(i)),
    ('youtube_thumbnail',  lambda i, root: check_youtube_thumbnail(i)),
    ('youtube_playlist',   lambda i, root: check_youtube_playlist(i)),
    ('spotify_live',       lambda i, root: check_spotify_live(i)),
    ('blogger_live',       lambda i, root: check_blogger_live(i)),
    ('linkedin_crosspost', lambda i, root: check_linkedin_crosspost(i)),
    ('x_crosspost',        lambda i, root: check_x_crosspost(i)),
    ('companion_repo',     lambda i, root: check_companion_repo(i)),
]

OFFLINE_SAFE = {'in_tracker', 'tracker_url_valid', 'watermarked'}

def run_one(item: dict, only_check: str | None, offline: bool) -> dict:
    checks = {}
    for name, fn in CHECK_RUNNERS:
        if only_check and name != only_check:
            continue
        if offline and name not in OFFLINE_SAFE:
            continue
        try:
            checks[name] = fn(item, REPO_ROOT)
        except Exception as e:
            checks[name] = {'status': 'unknown', 'error_detail': f'check raised: {type(e).__name__}: {e}'}
    return {
        'content_code':  item['code'],
        'content_kind':  item['kind'],
        'content_title': item.get('title', ''),
        'checks':        checks,
    }

def aggregate_counts(results: list[dict]) -> dict:
    total = pass_ = fail_ = na_ = unk = 0
    for r in results:
        for cell in r['checks'].values():
            total += 1
            s = cell.get('status')
            if s == 'pass': pass_ += 1
            elif s == 'fail': fail_ += 1
            elif s == 'na': na_ += 1
            else: unk += 1
    return {'total': total, 'pass': pass_, 'fail': fail_, 'na': na_, 'unknown': unk}

def post_payload(payload: dict, url: str, token: str, retries: int = 3) -> int:
    import requests
    for attempt in range(retries):
        try:
            r = requests.post(
                url,
                headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'},
                data=json.dumps(payload),
                timeout=60,
            )
            if r.status_code in (200, 201):
                body = r.json()
                print(f'POST {url} → {r.status_code} run_id={body.get("run_id")}', file=sys.stderr)
                return r.status_code
            print(f'POST {url} → {r.status_code} {r.text[:200]}', file=sys.stderr)
            if 500 <= r.status_code < 600:
                time.sleep(2 ** attempt)
                continue
            return r.status_code
        except Exception as e:
            print(f'attempt {attempt+1} failed: {e}', file=sys.stderr)
            time.sleep(2 ** attempt)
    return -1

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--dry-run', action='store_true')
    p.add_argument('--kind', help='filter by content_kind')
    p.add_argument('--code', help='single content code')
    p.add_argument('--check-only', help='single check_type')
    p.add_argument('--offline', action='store_true', help='skip network checks')
    args = p.parse_args()

    started_at = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    items = enumerate_all(REPO_ROOT, kind=args.kind, code=args.code)
    print(f'[qa-suite] {len(items)} items to check', file=sys.stderr)

    results = []
    for i, item in enumerate(items, 1):
        print(f'[{i}/{len(items)}] {item["code"]} {item["kind"]} {item.get("title","")[:50]}', file=sys.stderr)
        results.append(run_one(item, args.check_only, args.offline))

    finished_at = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    counts = aggregate_counts(results)
    payload = {
        'run': {
            'started_at':    started_at,
            'finished_at':   finished_at,
            'source':        os.environ.get('QA_SOURCE', 'manual'),
            'notes':         f'{len(items)} items, {counts["total"]} checks, {counts["fail"]} fail, {counts["unknown"]} unknown',
            'client_run_id': f'qa-suite-{started_at}-{uuid.uuid4().hex[:8]}',
        },
        'results': results,
    }

    if args.dry_run:
        print(json.dumps(payload, indent=2))
        sys.exit(0)

    url = os.environ.get('QA_INGEST_URL')
    token = os.environ.get('QA_INGEST_TOKEN')
    if not url or not token:
        print('ERROR: QA_INGEST_URL and QA_INGEST_TOKEN must be set (or pass --dry-run)', file=sys.stderr)
        sys.exit(2)

    code = post_payload(payload, url, token)
    if code in (200, 201):
        sys.exit(0)
    else:
        # Dump payload to /tmp for GH Actions artifact
        Path('/tmp').mkdir(exist_ok=True)
        dump_path = f'/tmp/qa-suite-{int(time.time())}.json'
        Path(dump_path).write_text(json.dumps(payload, indent=2))
        print(f'POST failed; payload dumped to {dump_path}', file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
```

- [ ] **Step 2: Make executable**

```bash
chmod +x /Users/amtoc/amtocsoft-content/scripts/qa-suite.py
```

- [ ] **Step 3: Smoke test (offline, dry-run)**

```bash
cd /Users/amtoc/amtocsoft-content
python3 scripts/qa-suite.py --dry-run --offline --code T014
```
Expected: prints a JSON payload with 1 result and 3 check entries (the offline-safe ones), exit 0.

- [ ] **Step 4: Smoke test (full, dry-run, single code)**

```bash
cd /Users/amtoc/amtocsoft-content
python3 scripts/qa-suite.py --dry-run --code T014
```
Expected: prints JSON with up to 12 check entries for T014; some may be `unknown` if YouTube token missing.

- [ ] **Step 5: Commit**

```bash
git add scripts/qa-suite.py
git commit -m "feat(qa): qa-suite.py orchestrator with --dry-run, --kind, --code, --check-only, --offline"
```

---

### Task 42: End-to-end local test against production endpoint

**Files:** none

- [ ] **Step 1: Set env vars**

```bash
export QA_INGEST_URL="https://amtocbot.com/api/dashboard/qa/ingest"
export QA_INGEST_TOKEN="<the production token from Task 8>"
export QA_SOURCE="manual"
```

- [ ] **Step 2: Run for a single content piece**

```bash
cd /Users/amtoc/amtocsoft-content
python3 scripts/qa-suite.py --code T014
```
Expected: prints `[qa-suite] 1 items to check`, `POST ... 201 run_id=N`, exits 0.

- [ ] **Step 3: Verify run lands in prod D1**

```bash
cd /Users/amtoc/amtocbot-site
npx wrangler d1 execute engage-db --remote \
  --command "SELECT id, source, total_checks, total_fail, notes FROM qa_runs ORDER BY id DESC LIMIT 1"
```
Expected: a row with `source='manual'`, `notes` describing 1 item.

- [ ] **Step 4: Verify matrix returns the row**

Open https://amtocbot.com/api/dashboard/qa/matrix in a browser logged in as a tester; should show T014's cells.

---

### Task 43: Phase 4 commit checkpoint

- [ ] **Step 1: Tag in amtocsoft-content**

```bash
cd /Users/amtoc/amtocsoft-content
git push origin main
git tag qa-phase-4-complete
git push origin qa-phase-4-complete
```

**Phase 4 done. Python suite works locally + can post to prod. Next: GH Actions cron.**

---

## Phase 5 — GitHub Actions Cron

### Task 44: Set GH Actions secrets

**Files:** none (GitHub UI)

- [ ] **Step 1: Generate and copy secrets**

You'll need 5 secrets in `amtocbot-droid/amtocsoft-content` repo:

| Secret name | Value |
|---|---|
| `QA_INGEST_TOKEN` | same token as Cloudflare Pages (from Task 8) |
| `QA_INGEST_URL`   | `https://amtocbot.com/api/dashboard/qa/ingest` |
| `YOUTUBE_TOKEN_JSON` | full contents of `~/.config/amtocsoft/youtube_token.json` |
| `BLOGGER_TOKEN_JSON` | full contents of `~/.config/amtocsoft/blogger_token.json` |
| `YT_CLIENT_SECRETS`  | full contents of `~/.config/amtocsoft/client_secrets.json` |

- [ ] **Step 2: Set in GitHub UI**

Go to https://github.com/amtocbot-droid/amtocsoft-content/settings/secrets/actions and add each secret. Verify all 5 appear in the list before continuing.

- [ ] **Step 3: Document in MEMORY**

Update the user's MEMORY file with: "QA suite secrets are set in amtocbot-droid/amtocsoft-content GH Actions; rotate `QA_INGEST_TOKEN` quarterly in lockstep with Cloudflare Pages."

---

### Task 45: Write the workflow file

**Files:**
- Create: `/Users/amtoc/amtocsoft-content/.github/workflows/qa-suite.yml`

- [ ] **Step 1: Make directory if absent**

```bash
mkdir -p /Users/amtoc/amtocsoft-content/.github/workflows
```

- [ ] **Step 2: Write the workflow**

```yaml
name: QA Suite

on:
  schedule:
    - cron: '0 6 * * *'   # 06:00 UTC daily
  workflow_dispatch:
    inputs:
      kind:
        description: 'Optional content_kind filter (tale|podcast|video|blog|tutorial|linkedin_article)'
        required: false
        type: string
      code:
        description: 'Optional single content_code (e.g. T014)'
        required: false
        type: string
      check_only:
        description: 'Optional single check_type (e.g. live_url_200)'
        required: false
        type: string

permissions:
  contents: read
  actions: write   # for the upload-artifact step on failure

jobs:
  run-suite:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Python 3.11
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: 'pip'
          cache-dependency-path: scripts/requirements.txt

      - name: Install dependencies
        run: pip install -r scripts/requirements.txt

      - name: Decrypt OAuth tokens
        run: |
          mkdir -p ~/.config/amtocsoft
          printf '%s' "$YOUTUBE_TOKEN_JSON" > ~/.config/amtocsoft/youtube_token.json
          printf '%s' "$BLOGGER_TOKEN_JSON" > ~/.config/amtocsoft/blogger_token.json
          printf '%s' "$YT_CLIENT_SECRETS"  > ~/.config/amtocsoft/client_secrets.json
          chmod 600 ~/.config/amtocsoft/*.json
        env:
          YOUTUBE_TOKEN_JSON: ${{ secrets.YOUTUBE_TOKEN_JSON }}
          BLOGGER_TOKEN_JSON: ${{ secrets.BLOGGER_TOKEN_JSON }}
          YT_CLIENT_SECRETS:  ${{ secrets.YT_CLIENT_SECRETS }}

      - name: Run QA suite
        env:
          QA_INGEST_URL:   ${{ secrets.QA_INGEST_URL }}
          QA_INGEST_TOKEN: ${{ secrets.QA_INGEST_TOKEN }}
          QA_SOURCE:       ${{ github.event_name == 'schedule' && 'cron' || 'dispatch' }}
          GH_TOKEN:        ${{ secrets.GITHUB_TOKEN }}
        run: |
          ARGS=""
          if [ -n "${{ inputs.kind }}" ]; then ARGS="$ARGS --kind ${{ inputs.kind }}"; fi
          if [ -n "${{ inputs.code }}" ]; then ARGS="$ARGS --code ${{ inputs.code }}"; fi
          if [ -n "${{ inputs.check_only }}" ]; then ARGS="$ARGS --check-only ${{ inputs.check_only }}"; fi
          python3 scripts/qa-suite.py $ARGS

      - name: Upload debug artifact on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: qa-suite-debug-${{ github.run_id }}
          path: /tmp/qa-suite-*.json
          if-no-files-found: ignore
          retention-days: 7
```

- [ ] **Step 3: Commit and push**

```bash
cd /Users/amtoc/amtocsoft-content
git add .github/workflows/qa-suite.yml
git commit -m "feat(qa): add GH Actions workflow for daily cron + workflow_dispatch"
git push origin main
```

---

### Task 46: Manually trigger first dispatch run

**Files:** none

- [ ] **Step 1: Trigger via GitHub UI**

Go to https://github.com/amtocbot-droid/amtocsoft-content/actions/workflows/qa-suite.yml → "Run workflow" → leave inputs blank → click "Run workflow".

- [ ] **Step 2: Watch the run**

Open the run in GitHub Actions UI. Verify:
- Checkout step: green
- Setup Python: green
- Install deps: green (60-90s)
- Decrypt tokens: green (no output, secrets masked)
- Run QA suite: green (~2-5 min depending on item count); stderr shows `POST ... 201 run_id=N` at the end

If "Run QA suite" fails:
- If it's an HTTP 403 → token mismatch between GH secret and Cloudflare env → re-set both with the same value
- If `unknown` for everything → tokens didn't get written → check the decrypt step
- If `requests.exceptions.SSLError` on amtocbot.com → Cloudflare cold start; re-trigger

- [ ] **Step 3: Verify run lands in prod D1**

```bash
cd /Users/amtoc/amtocbot-site
npx wrangler d1 execute engage-db --remote \
  --command "SELECT id, source, started_at, finished_at, total_checks, total_fail FROM qa_runs ORDER BY id DESC LIMIT 3"
```
Expected: most recent row has `source='dispatch'`, totals populated.

- [ ] **Step 4: Verify in dashboard**

Open https://amtocbot.com/api/dashboard/qa/runs?limit=3 (logged in as tester). Expect the dispatch run.

---

### Task 47: Test refresh endpoint round-trip

**Files:** none

- [ ] **Step 1: Trigger via the API**

```bash
curl -i -X POST https://amtocbot.com/api/dashboard/qa/refresh \
  -H "Cookie: session_id=<tester>" -H "Content-Type: application/json" \
  -d '{"code":"T014"}'
```
Expected: HTTP 202, body `{tracking_run_after: "<iso>", status: "dispatched"}`.

- [ ] **Step 2: Verify GitHub received the dispatch**

Refresh https://github.com/amtocbot-droid/amtocsoft-content/actions and confirm a new run started within 30s.

- [ ] **Step 3: Verify run completes and lands**

After the workflow finishes (~2 min), poll the runs endpoint:
```bash
curl "https://amtocbot.com/api/dashboard/qa/runs?since=<tracking_run_after>" -H "Cookie: session_id=<tester>"
```
Expected: 1 new run with `finished_at` populated.

---

### Task 48: Wait for first scheduled cron run

**Files:** none

- [ ] **Step 1: Confirm next cron time**

Today's schedule fires at the next 06:00 UTC. Note the date.

- [ ] **Step 2: At T+24h, verify a `cron` run landed**

```bash
cd /Users/amtoc/amtocbot-site
npx wrangler d1 execute engage-db --remote \
  --command "SELECT id, source, started_at FROM qa_runs WHERE source='cron' ORDER BY id DESC LIMIT 1"
```
Expected: 1 row whose `started_at` matches today's 06:00 UTC.

If no row: check https://github.com/amtocbot-droid/amtocsoft-content/actions for the scheduled run; investigate failure logs.

---

### Task 49: Wait for second scheduled cron run

**Files:** none

- [ ] **Step 1: At T+48h, verify two consecutive `cron` runs**

```bash
npx wrangler d1 execute engage-db --remote \
  --command "SELECT id, started_at FROM qa_runs WHERE source='cron' ORDER BY id DESC LIMIT 2"
```
Expected: 2 rows, started_at on consecutive days at 06:00 UTC.

This is the Phase 5 acceptance gate per spec.

---

### Task 50: Phase 5 commit checkpoint

- [ ] **Step 1: Tag**

```bash
cd /Users/amtoc/amtocsoft-content
git tag qa-phase-5-complete
git push origin qa-phase-5-complete
```

**Phase 5 done. Cron is autonomous. Next: frontend.**

---

## Phase 6 — Frontend Tester Tab

All in `/Users/amtoc/amtocbot-site/src/app/features/dashboard/qa-tab/`.

### Task 51: qa-tab.service.ts

**Files:**
- Create: `/Users/amtoc/amtocbot-site/src/app/features/dashboard/qa-tab/qa-tab.service.ts`

- [ ] **Step 1: Make directory + write service**

```bash
mkdir -p /Users/amtoc/amtocbot-site/src/app/features/dashboard/qa-tab
```

```typescript
/**
 * HTTP client for QA traceability endpoints.
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type QaCheckType =
  | 'in_tracker' | 'tracker_url_valid' | 'live_url_200' | 'watermarked'
  | 'youtube_uploaded' | 'youtube_thumbnail' | 'youtube_playlist'
  | 'spotify_live' | 'blogger_live' | 'linkedin_crosspost' | 'x_crosspost' | 'companion_repo';

export type QaContentKind = 'tale' | 'podcast' | 'video' | 'blog' | 'tutorial' | 'linkedin_article';
export type QaCheckStatus = 'pass' | 'fail' | 'na' | 'unknown';

export interface MatrixCell { status: QaCheckStatus; error_detail: string | null; checked_at: string; }
export interface MatrixRow {
  content_code: string;
  content_kind: QaContentKind;
  content_title: string | null;
  cells: Partial<Record<QaCheckType, MatrixCell>>;
  has_failure: boolean;
  has_regression: boolean;
  active_acks: Array<{ check_type: QaCheckType; reason: string; expires_at: string; ack_id: number }>;
  linked_issues: Array<{ check_type: QaCheckType; issue_id: number; status: string }>;
}
export interface MatrixResponse {
  run_id: number | null;
  row_count: number;
  rows: MatrixRow[];
  check_types: readonly QaCheckType[];
  content_kinds: readonly QaContentKind[];
}
export interface Todo {
  priority_tier: number;
  priority_label: string;
  content_code: string;
  content_kind: QaContentKind;
  content_title: string | null;
  check_type: QaCheckType;
  last_error: string | null;
  last_known_good_at: string | null;
  suggested_action: string;
  existing_ack_id: number | null;
  existing_issue_id: number | null;
}
export interface QaRun {
  id: number; client_run_id: string | null;
  started_at: string; finished_at: string | null;
  source: 'cron' | 'manual' | 'dispatch'; triggered_by: number | null;
  total_checks: number; total_pass: number; total_fail: number; total_na: number;
  notes: string | null;
}
export interface EligibilityResponse {
  eligible: boolean;
  run_id: number | null;
  based_on_run_id: number | null;
  last_signoff: { signed_at: string; based_on_run_id: number; week_start_date: string } | null;
  blockers: Array<{ content_code: string; check_type: QaCheckType; why: string }>;
  summary: { steady_green: number; new_green: number; persistent_fail: number; regressions: number };
}
export interface SignoffRow {
  id: number; week_start_date: string; signed_at: string;
  signed_by: number; signed_by_username: string;
  based_on_run_id: number;
  count_regressions: number; count_persistent: number; count_new_green: number; count_steady_green: number;
  notes: string | null;
}
export interface HeatmapCell {
  content_code: string; content_kind: QaContentKind; content_title: string | null;
  check_type: QaCheckType; sample_count: number; pct_green: number;
  fail_count: number; unknown_count: number;
}
export interface TrendPoint {
  week_start: string; check_type: QaCheckType; sample_count: number; fail_count: number;
}

@Injectable({ providedIn: 'root' })
export class QaTabService {
  private http = inject(HttpClient);
  private base = '/api/dashboard/qa';

  getMatrix(filters?: { kind?: string; status?: string; run_id?: number }): Observable<MatrixResponse> {
    const params: Record<string, string> = {};
    if (filters?.kind)   params['kind'] = filters.kind;
    if (filters?.status) params['status'] = filters.status;
    if (filters?.run_id) params['run_id'] = String(filters.run_id);
    return this.http.get<MatrixResponse>(`${this.base}/matrix`, { params });
  }

  getTodos(): Observable<{ todos: Todo[]; tier_labels: string[] }> {
    return this.http.get<{ todos: Todo[]; tier_labels: string[] }>(`${this.base}/todos`);
  }

  getRuns(since?: string, limit = 20): Observable<{ runs: QaRun[] }> {
    const params: Record<string, string> = { limit: String(limit) };
    if (since) params['since'] = since;
    return this.http.get<{ runs: QaRun[] }>(`${this.base}/runs`, { params });
  }

  acknowledge(content_code: string, check_type: QaCheckType, reason: string, expires_in_days = 14) {
    return this.http.post<{ ack_id: number; expires_at: string }>(
      `${this.base}/acknowledge`, { content_code, check_type, reason, expires_in_days });
  }

  acknowledgeBulk(cells: Array<{content_code: string; check_type: QaCheckType}>, reason: string, expires_in_days = 14) {
    return this.http.post<{ count: number; acks: Array<{content_code: string; check_type: QaCheckType; ack_id: number}>; expires_at: string }>(
      `${this.base}/acknowledge/bulk`, { cells, reason, expires_in_days });
  }

  clearAcknowledge(ackId: number, reason: string) {
    return this.http.delete<{ cleared: boolean }>(`${this.base}/acknowledge/${ackId}`, { body: { reason } } as any);
  }

  issueFromCell(content_code: string, check_type: QaCheckType, severity: string = 'medium', description?: string) {
    return this.http.post<{ issue_id: number; title: string; severity: string }>(
      `${this.base}/issue-from-cell`, { content_code, check_type, severity, description });
  }

  refresh(opts?: { kind?: string; code?: string; check_only?: string }) {
    return this.http.post<{ tracking_run_after: string; status: string }>(`${this.base}/refresh`, opts || {});
  }

  getEligibility(): Observable<EligibilityResponse> {
    return this.http.get<EligibilityResponse>(`${this.base}/signoff/eligibility`);
  }

  signoff(week_start_date: string, notes?: string) {
    return this.http.post<{ signoff_id: number; summary: any }>(
      `${this.base}/signoff`, { week_start_date, notes });
  }

  getHeatmap(days = 90): Observable<{ days: number; cells: HeatmapCell[] }> {
    return this.http.get<{ days: number; cells: HeatmapCell[] }>(
      `${this.base}/history/heatmap`, { params: { days: String(days) } });
  }

  getTrend(weeks = 26): Observable<{ weeks: number; points: TrendPoint[] }> {
    return this.http.get<{ weeks: number; points: TrendPoint[] }>(
      `${this.base}/history/trend`, { params: { weeks: String(weeks) } });
  }

  getSignoffs(): Observable<{ signoffs: SignoffRow[] }> {
    return this.http.get<{ signoffs: SignoffRow[] }>(`${this.base}/history/signoffs`);
  }

  getSignoffDetail(id: number): Observable<{ signoff: SignoffRow; results: any[] }> {
    return this.http.get<{ signoff: SignoffRow; results: any[] }>(
      `${this.base}/history/signoffs/${id}`);
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/amtoc/amtocbot-site && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep "qa-tab" | head
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/features/dashboard/qa-tab/qa-tab.service.ts
git commit -m "feat(qa): qa-tab.service.ts HttpClient wrapper"
```

---

### Task 52: qa-matrix-view component

**Files:**
- Create: `/Users/amtoc/amtocbot-site/src/app/features/dashboard/qa-tab/qa-matrix-view/qa-matrix-view.component.ts`

- [ ] **Step 1: Make dir + write component**

```bash
mkdir -p /Users/amtoc/amtocbot-site/src/app/features/dashboard/qa-tab/qa-matrix-view
```

```typescript
import { Component, inject, signal, computed, OnInit, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { QaTabService, MatrixRow, QaCheckType, QaContentKind, QaCheckStatus } from '../qa-tab.service';
import { AuthService } from '../../../../shared/services/auth.service';

interface SelectedCell { content_code: string; check_type: QaCheckType; }

@Component({
  selector: 'qa-matrix-view',
  standalone: true,
  imports: [CommonModule, FormsModule, MatTableModule, MatChipsModule, MatButtonModule,
            MatIconModule, MatTooltipModule, MatSelectModule, MatFormFieldModule, MatCheckboxModule],
  template: `
    <div class="qa-matrix-controls">
      <button mat-flat-button color="primary" (click)="refresh()" [disabled]="refreshing()">
        <mat-icon>refresh</mat-icon> Refresh
      </button>
      <span class="run-summary" *ngIf="lastRunSummary() as s">{{s}}</span>
      <mat-form-field appearance="outline">
        <mat-label>Status</mat-label>
        <mat-select [(value)]="statusFilter" (valueChange)="reload()">
          <mat-option value="">All</mat-option>
          <mat-option value="fail">Failures only</mat-option>
        </mat-select>
      </mat-form-field>
      <mat-chip-set>
        <mat-chip *ngFor="let k of allKinds" (click)="toggleKind(k)"
          [class.selected]="kindFilter().has(k)">{{k}}</mat-chip>
      </mat-chip-set>
      <span class="spacer"></span>
      <button mat-flat-button color="accent" *ngIf="canSignoff()"
        [disabled]="signingOff()" (click)="signoffClicked.emit()">Sign Off Week</button>
      <button mat-stroked-button color="warn" *ngIf="selectedCells().length > 0 && canAck()"
        (click)="bulkAckClicked.emit(selectedCells())">
        Acknowledge selected ({{selectedCells().length}})
      </button>
    </div>

    <div class="matrix-table-wrapper" *ngIf="rows().length > 0; else empty">
      <table mat-table [dataSource]="rows()">
        <ng-container matColumnDef="select">
          <th mat-header-cell *matHeaderCellDef></th>
          <td mat-cell *matCellDef="let row">
            <mat-checkbox *ngIf="row.has_failure && canAck()"
              [checked]="rowAnyCellSelected(row)"
              (change)="toggleAllFailingCells(row, $event.checked)"></mat-checkbox>
          </td>
        </ng-container>
        <ng-container matColumnDef="code">
          <th mat-header-cell *matHeaderCellDef>Code · Title</th>
          <td mat-cell *matCellDef="let row">
            <div class="row-code">{{row.content_code}}</div>
            <div class="row-title">{{row.content_title}}</div>
            <div class="row-kind">{{row.content_kind}}</div>
          </td>
        </ng-container>
        <ng-container *ngFor="let ct of checkTypes" [matColumnDef]="ct">
          <th mat-header-cell *matHeaderCellDef [matTooltip]="ct">{{shortLabel(ct)}}</th>
          <td mat-cell *matCellDef="let row">
            <button mat-icon-button class="cell"
              [class.pass]="row.cells[ct]?.status === 'pass'"
              [class.fail]="row.cells[ct]?.status === 'fail'"
              [class.na]="row.cells[ct]?.status === 'na'"
              [class.unknown]="row.cells[ct]?.status === 'unknown'"
              [class.regression]="isRegression(row, ct)"
              [class.acked]="hasAck(row, ct)"
              [class.linked]="hasIssue(row, ct)"
              [matTooltip]="cellTooltip(row, ct)"
              (click)="cellClick.emit({row, check_type: ct})">
              {{cellGlyph(row.cells[ct]?.status)}}{{isRegression(row, ct) ? '!' : ''}}
            </button>
          </td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
      </table>
    </div>
    <ng-template #empty>
      <div class="empty">No data yet. Run "Refresh" to trigger the first check.</div>
    </ng-template>
  `,
  styles: [`
    .qa-matrix-controls { display: flex; gap: 12px; align-items: center; padding: 12px; flex-wrap: wrap; }
    .run-summary { color: var(--mat-sys-on-surface-variant); font-size: 13px; }
    .spacer { flex: 1; }
    mat-chip.selected { background: var(--mat-sys-primary-container); color: var(--mat-sys-on-primary-container); }
    .matrix-table-wrapper { overflow-x: auto; max-height: calc(100vh - 280px); }
    table { width: 100%; }
    .cell { width: 36px; height: 36px; line-height: 36px; padding: 0; font-weight: 600; }
    .cell.pass    { color: #2e7d32; }
    .cell.fail    { color: #c62828; }
    .cell.na      { color: #9e9e9e; }
    .cell.unknown { color: #f9a825; }
    .cell.regression { border: 2px solid #c62828; border-radius: 4px; }
    .cell.acked::after  { content: 'i'; font-size: 9px; vertical-align: super; }
    .cell.linked::after { content: '🔗'; font-size: 9px; vertical-align: super; }
    .row-code { font-weight: 600; }
    .row-title { font-size: 12px; color: var(--mat-sys-on-surface-variant); max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .row-kind { font-size: 11px; color: var(--mat-sys-on-surface-variant); font-style: italic; }
    .empty { padding: 48px; text-align: center; color: var(--mat-sys-on-surface-variant); }
  `],
})
export class QaMatrixViewComponent implements OnInit {
  private svc = inject(QaTabService);
  private auth = inject(AuthService);

  // Outputs
  cellClick = output<{ row: MatrixRow; check_type: QaCheckType }>();
  signoffClicked = output<void>();
  bulkAckClicked = output<SelectedCell[]>();
  refreshTriggered = output<string>(); // emits tracking_run_after

  rows = signal<MatrixRow[]>([]);
  checkTypes: QaCheckType[] = [
    'in_tracker', 'tracker_url_valid', 'live_url_200', 'watermarked',
    'youtube_uploaded', 'youtube_thumbnail', 'youtube_playlist',
    'spotify_live', 'blogger_live', 'linkedin_crosspost', 'x_crosspost', 'companion_repo',
  ];
  allKinds: QaContentKind[] = ['tale','podcast','video','blog','tutorial','linkedin_article'];
  kindFilter = signal<Set<QaContentKind>>(new Set());
  statusFilter = '';
  refreshing = signal(false);
  signingOff = signal(false);
  selected = signal<Map<string, SelectedCell>>(new Map());
  selectedCells = computed(() => Array.from(this.selected().values()));
  lastRunSummary = signal<string>('');

  displayedColumns = computed(() => ['select', 'code', ...this.checkTypes]);

  canAck = computed(() => this.auth.hasPermission('qa.acknowledge'));
  canSignoff = computed(() => this.auth.hasPermission('qa.signoff'));

  ngOnInit() { this.reload(); }

  reload() {
    const filters: any = {};
    const k = this.kindFilter();
    if (k.size > 0) filters.kind = Array.from(k).join(',');
    if (this.statusFilter) filters.status = this.statusFilter;
    this.svc.getMatrix(filters).subscribe(res => {
      this.rows.set(res.rows);
      this.lastRunSummary.set(`run #${res.run_id} · ${res.row_count} items`);
    });
  }

  toggleKind(k: QaContentKind) {
    const s = new Set(this.kindFilter());
    if (s.has(k)) s.delete(k); else s.add(k);
    this.kindFilter.set(s);
    this.reload();
  }

  refresh() {
    this.refreshing.set(true);
    this.svc.refresh().subscribe({
      next: r => { this.refreshTriggered.emit(r.tracking_run_after); },
      error: e => { this.refreshing.set(false); console.error(e); },
    });
  }
  refreshDone() { this.refreshing.set(false); this.reload(); }

  shortLabel(ct: QaCheckType): string {
    const map: Record<QaCheckType, string> = {
      in_tracker: 'trk', tracker_url_valid: 'url', live_url_200: '200',
      watermarked: 'wm', youtube_uploaded: 'yt', youtube_thumbnail: 'thm',
      youtube_playlist: 'pls', spotify_live: 'spt', blogger_live: 'blg',
      linkedin_crosspost: 'li', x_crosspost: 'x', companion_repo: 'rep',
    };
    return map[ct];
  }
  cellGlyph(s?: QaCheckStatus): string { return s === 'pass' ? '✓' : s === 'fail' ? '✗' : s === 'na' ? '–' : s === 'unknown' ? '?' : ''; }
  cellTooltip(row: MatrixRow, ct: QaCheckType): string {
    const c = row.cells[ct];
    if (!c) return ct + ' (no data)';
    const ack = row.active_acks.find(a => a.check_type === ct);
    const issue = row.linked_issues.find(i => i.check_type === ct);
    let t = `${ct}: ${c.status}`;
    if (c.error_detail) t += ` — ${c.error_detail}`;
    if (ack) t += `\n[acked: ${ack.reason}, expires ${ack.expires_at}]`;
    if (issue) t += `\n[linked issue #${issue.issue_id}]`;
    return t;
  }
  isRegression(row: MatrixRow, ct: QaCheckType) { return row.has_regression && row.cells[ct]?.status === 'fail'; }
  hasAck(row: MatrixRow, ct: QaCheckType) { return row.active_acks.some(a => a.check_type === ct); }
  hasIssue(row: MatrixRow, ct: QaCheckType) { return row.linked_issues.some(i => i.check_type === ct); }

  rowAnyCellSelected(row: MatrixRow): boolean {
    const s = this.selected();
    return this.checkTypes.some(ct => s.has(`${row.content_code}|${ct}`));
  }
  toggleAllFailingCells(row: MatrixRow, checked: boolean) {
    const s = new Map(this.selected());
    for (const ct of this.checkTypes) {
      const cell = row.cells[ct];
      if (cell?.status !== 'fail') continue;
      const key = `${row.content_code}|${ct}`;
      if (checked) s.set(key, { content_code: row.content_code, check_type: ct });
      else s.delete(key);
    }
    this.selected.set(s);
  }
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/amtoc/amtocbot-site && npx ng build --configuration=development 2>&1 | grep -E "(error|qa-matrix)" | head -20
```
Expected: no errors mentioning qa-matrix.

- [ ] **Step 3: Commit**

```bash
git add src/app/features/dashboard/qa-tab/qa-matrix-view/qa-matrix-view.component.ts
git commit -m "feat(qa): qa-matrix-view component with cells, filters, selection"
```

---

### Task 53: qa-cell-popover component

**Files:**
- Create: `/Users/amtoc/amtocbot-site/src/app/features/dashboard/qa-tab/qa-matrix-view/qa-cell-popover.component.ts`

- [ ] **Step 1: Write component (Material dialog)**

```typescript
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { QaTabService, QaCheckType, MatrixRow } from '../qa-tab.service';

export interface CellPopoverData {
  row: MatrixRow;
  check_type: QaCheckType;
}

@Component({
  selector: 'qa-cell-popover',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule,
            MatFormFieldModule, MatInputModule, MatSelectModule, MatTabsModule],
  template: `
    <h2 mat-dialog-title>{{data.row.content_code}} · {{data.check_type}}</h2>
    <mat-dialog-content>
      <p><b>Status:</b> {{cell.status}}</p>
      <p *ngIf="cell.error_detail"><b>Last error:</b> {{cell.error_detail}}</p>
      <p><b>Checked at:</b> {{cell.checked_at}}</p>

      <mat-tab-group>
        <mat-tab label="Acknowledge">
          <mat-form-field appearance="outline" style="width:100%; margin-top:12px;">
            <mat-label>Reason</mat-label>
            <textarea matInput [(ngModel)]="ackReason" rows="3"></textarea>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Expires in (days)</mat-label>
            <input matInput type="number" min="1" max="90" [(ngModel)]="expiresInDays">
          </mat-form-field>
          <button mat-flat-button color="primary" (click)="ack()" [disabled]="!ackReason || ackReason.length < 3">
            Acknowledge
          </button>
        </mat-tab>
        <mat-tab label="File issue">
          <mat-form-field appearance="outline" style="width:100%; margin-top:12px;">
            <mat-label>Severity</mat-label>
            <mat-select [(value)]="issueSeverity">
              <mat-option value="low">low</mat-option>
              <mat-option value="medium">medium</mat-option>
              <mat-option value="high">high</mat-option>
              <mat-option value="critical">critical</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" style="width:100%;">
            <mat-label>Description (optional)</mat-label>
            <textarea matInput [(ngModel)]="issueDescription" rows="3"></textarea>
          </mat-form-field>
          <button mat-flat-button color="warn" (click)="fileIssue()">File issue</button>
        </mat-tab>
        <mat-tab label="Re-run">
          <p style="margin-top:12px;">Trigger a fresh check for just this cell. Round-trip ~90 seconds.</p>
          <button mat-flat-button color="accent" (click)="rerun()">Re-run check</button>
        </mat-tab>
      </mat-tab-group>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
})
export class QaCellPopoverComponent {
  data: CellPopoverData = inject(MAT_DIALOG_DATA);
  ref = inject(MatDialogRef<QaCellPopoverComponent>);
  svc = inject(QaTabService);

  cell = this.data.row.cells[this.data.check_type] || { status: 'unknown', error_detail: null, checked_at: '' };

  ackReason = '';
  expiresInDays = 14;
  issueSeverity = 'medium';
  issueDescription = '';

  ack() {
    this.svc.acknowledge(this.data.row.content_code, this.data.check_type, this.ackReason, this.expiresInDays)
      .subscribe(() => this.ref.close({ acked: true }));
  }
  fileIssue() {
    this.svc.issueFromCell(this.data.row.content_code, this.data.check_type, this.issueSeverity, this.issueDescription)
      .subscribe(r => this.ref.close({ issue_id: r.issue_id }));
  }
  rerun() {
    this.svc.refresh({ code: this.data.row.content_code, check_only: this.data.check_type })
      .subscribe(r => this.ref.close({ refresh_tracking: r.tracking_run_after }));
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/features/dashboard/qa-tab/qa-matrix-view/qa-cell-popover.component.ts
git commit -m "feat(qa): qa-cell-popover (ack/issue/re-run dialog)"
```

---

### Task 54: qa-todos-view component

**Files:**
- Create: `/Users/amtoc/amtocbot-site/src/app/features/dashboard/qa-tab/qa-todos-view/qa-todos-view.component.ts`

- [ ] **Step 1: Write component**

```bash
mkdir -p /Users/amtoc/amtocbot-site/src/app/features/dashboard/qa-tab/qa-todos-view
```

```typescript
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatButtonModule } from '@angular/material/button';
import { MatBadgeModule } from '@angular/material/badge';
import { MatIconModule } from '@angular/material/icon';
import { QaTabService, Todo } from '../qa-tab.service';

@Component({
  selector: 'qa-todos-view',
  standalone: true,
  imports: [CommonModule, MatExpansionModule, MatButtonModule, MatBadgeModule, MatIconModule],
  template: `
    <ng-container *ngFor="let tier of tiers()">
      <mat-expansion-panel *ngIf="tier.todos.length > 0" [expanded]="tier.priority <= 3">
        <mat-expansion-panel-header>
          <mat-panel-title>{{tierEmoji(tier.priority)}} {{tier.label}}</mat-panel-title>
          <mat-panel-description>
            <span [matBadge]="tier.todos.length" matBadgeOverlap="false" matBadgeColor="warn"></span>
          </mat-panel-description>
        </mat-expansion-panel-header>

        <div class="todo-row" *ngFor="let t of tier.todos">
          <div class="todo-info">
            <span class="code">{{t.content_code}}</span>
            <span class="check">{{t.check_type}}</span>
            <span class="error" *ngIf="t.last_error">{{t.last_error}}</span>
            <span class="last-good" *ngIf="t.last_known_good_at">last green: {{t.last_known_good_at}}</span>
          </div>
          <div class="todo-actions">
            <button mat-stroked-button *ngIf="!t.existing_ack_id">Ack</button>
            <button mat-stroked-button *ngIf="!t.existing_issue_id">Issue</button>
            <button mat-stroked-button>Re-run</button>
            <a mat-button *ngIf="t.existing_issue_id"
               [href]="'/dashboard?tab=issues&id=' + t.existing_issue_id">→ Issue #{{t.existing_issue_id}}</a>
          </div>
        </div>
      </mat-expansion-panel>
    </ng-container>
    <div *ngIf="emptyAll()" class="empty">All clear — no todos.</div>
  `,
  styles: [`
    .todo-row { display: flex; gap: 16px; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--mat-sys-outline-variant); }
    .todo-info { flex: 1; display: flex; gap: 12px; align-items: baseline; flex-wrap: wrap; }
    .code { font-weight: 600; min-width: 60px; }
    .check { color: var(--mat-sys-on-surface-variant); }
    .error { color: #c62828; font-size: 13px; }
    .last-good { color: var(--mat-sys-on-surface-variant); font-size: 12px; }
    .todo-actions { display: flex; gap: 4px; }
    .empty { padding: 48px; text-align: center; color: #2e7d32; font-weight: 500; }
  `],
})
export class QaTodosViewComponent implements OnInit {
  private svc = inject(QaTabService);
  tiers = signal<Array<{priority: number; label: string; todos: Todo[]}>>([]);
  emptyAll = () => this.tiers().every(t => t.todos.length === 0);

  ngOnInit() {
    this.svc.getTodos().subscribe(res => {
      const grouped = new Map<number, Todo[]>();
      for (const t of res.todos) {
        if (!grouped.has(t.priority_tier)) grouped.set(t.priority_tier, []);
        grouped.get(t.priority_tier)!.push(t);
      }
      const out: Array<{priority: number; label: string; todos: Todo[]}> = [];
      for (let p = 1; p <= 8; p++) {
        out.push({ priority: p, label: res.tier_labels[p] || `Tier ${p}`, todos: grouped.get(p) || [] });
      }
      this.tiers.set(out);
    });
  }
  tierEmoji(p: number): string { return ['','⚠','🔴','📋','🛡','📺','🔁','⏰','🌑'][p] || '·'; }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/features/dashboard/qa-tab/qa-todos-view/qa-todos-view.component.ts
git commit -m "feat(qa): qa-todos-view component"
```

---

### Task 55: qa-history-view + sub-components

**Files:**
- Create: `/Users/amtoc/amtocbot-site/src/app/features/dashboard/qa-tab/qa-history-view/qa-history-view.component.ts`
- Create: `/Users/amtoc/amtocbot-site/src/app/features/dashboard/qa-tab/qa-history-view/qa-heatmap.component.ts`
- Create: `/Users/amtoc/amtocbot-site/src/app/features/dashboard/qa-tab/qa-history-view/qa-trend-chart.component.ts`
- Create: `/Users/amtoc/amtocbot-site/src/app/features/dashboard/qa-tab/qa-history-view/qa-signoff-log.component.ts`

- [ ] **Step 1: Make dir**

```bash
mkdir -p /Users/amtoc/amtocbot-site/src/app/features/dashboard/qa-tab/qa-history-view
```

- [ ] **Step 2: Write qa-history-view.component.ts (shell)**

```typescript
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { QaHeatmapComponent } from './qa-heatmap.component';
import { QaTrendChartComponent } from './qa-trend-chart.component';
import { QaSignoffLogComponent } from './qa-signoff-log.component';

@Component({
  selector: 'qa-history-view',
  standalone: true,
  imports: [CommonModule, MatTabsModule, QaHeatmapComponent, QaTrendChartComponent, QaSignoffLogComponent],
  template: `
    <mat-tab-group>
      <mat-tab label="Heatmap"><qa-heatmap></qa-heatmap></mat-tab>
      <mat-tab label="Trend"><qa-trend-chart></qa-trend-chart></mat-tab>
      <mat-tab label="Sign-off log"><qa-signoff-log></qa-signoff-log></mat-tab>
    </mat-tab-group>
  `,
})
export class QaHistoryViewComponent {}
```

- [ ] **Step 3: Write qa-heatmap.component.ts**

```typescript
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';
import { QaTabService, HeatmapCell, QaCheckType } from '../qa-tab.service';

@Component({
  selector: 'qa-heatmap',
  standalone: true,
  imports: [CommonModule, MatTooltipModule],
  template: `
    <div class="heatmap" *ngIf="cellsByCode().size > 0; else loading">
      <table>
        <thead>
          <tr>
            <th>Content</th>
            <th *ngFor="let ct of checkTypes">{{shortLabel(ct)}}</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let entry of orderedRows()">
            <td class="code-cell">{{entry.code}} <span class="kind">({{entry.kind}})</span></td>
            <td *ngFor="let ct of checkTypes"
                [matTooltip]="cellTooltip(entry.code, ct)"
                [style.background]="cellColor(entry.code, ct)"
                [style.color]="'#fff'"
                class="cell">
              {{cellPct(entry.code, ct)}}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <ng-template #loading><p>Loading…</p></ng-template>
  `,
  styles: [`
    table { border-collapse: collapse; font-size: 11px; width: 100%; }
    th, td { padding: 4px; text-align: center; border: 1px solid var(--mat-sys-outline-variant); }
    .code-cell { text-align: left; font-weight: 600; }
    .kind { color: var(--mat-sys-on-surface-variant); font-weight: normal; font-size: 10px; }
    .cell { width: 36px; height: 28px; }
  `],
})
export class QaHeatmapComponent implements OnInit {
  private svc = inject(QaTabService);
  checkTypes: QaCheckType[] = [
    'in_tracker','tracker_url_valid','live_url_200','watermarked',
    'youtube_uploaded','youtube_thumbnail','youtube_playlist',
    'spotify_live','blogger_live','linkedin_crosspost','x_crosspost','companion_repo',
  ];
  // Map: content_code -> { kind, cells: { check_type -> HeatmapCell } }
  cellsByCode = signal<Map<string, { kind: string; cells: Map<QaCheckType, HeatmapCell> }>>(new Map());

  ngOnInit() {
    this.svc.getHeatmap(90).subscribe(res => {
      const m = new Map<string, { kind: string; cells: Map<QaCheckType, HeatmapCell> }>();
      for (const c of res.cells) {
        if (!m.has(c.content_code)) m.set(c.content_code, { kind: c.content_kind, cells: new Map() });
        m.get(c.content_code)!.cells.set(c.check_type, c);
      }
      this.cellsByCode.set(m);
    });
  }

  orderedRows() {
    return Array.from(this.cellsByCode().entries())
      .map(([code, v]) => ({ code, kind: v.kind }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }
  shortLabel(ct: QaCheckType): string {
    const map: Record<QaCheckType, string> = {
      in_tracker:'trk',tracker_url_valid:'url',live_url_200:'200',watermarked:'wm',
      youtube_uploaded:'yt',youtube_thumbnail:'thm',youtube_playlist:'pls',
      spotify_live:'spt',blogger_live:'blg',linkedin_crosspost:'li',x_crosspost:'x',companion_repo:'rep',
    };
    return map[ct];
  }
  cellPct(code: string, ct: QaCheckType): string {
    const c = this.cellsByCode().get(code)?.cells.get(ct);
    return c ? `${c.pct_green}%` : '–';
  }
  cellTooltip(code: string, ct: QaCheckType): string {
    const c = this.cellsByCode().get(code)?.cells.get(ct);
    if (!c) return 'no data';
    return `${ct}: ${c.pct_green}% green over ${c.sample_count} runs (${c.fail_count} fail, ${c.unknown_count} unknown)`;
  }
  cellColor(code: string, ct: QaCheckType): string {
    const c = this.cellsByCode().get(code)?.cells.get(ct);
    if (!c) return '#9e9e9e';
    // Interpolate red (0%) → green (100%)
    const r = Math.round(255 - (c.pct_green / 100) * 200);
    const g = Math.round(50 + (c.pct_green / 100) * 150);
    return `rgb(${r}, ${g}, 60)`;
  }
}
```

- [ ] **Step 4: Write qa-trend-chart.component.ts**

```typescript
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QaTabService, TrendPoint, QaCheckType } from '../qa-tab.service';

@Component({
  selector: 'qa-trend-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="trend" *ngIf="series().length > 0; else loading">
      <p class="legend">Failures per check_type, last 26 weeks</p>
      <svg [attr.viewBox]="'0 0 ' + width + ' ' + height" preserveAspectRatio="xMidYMid meet" style="width:100%; max-height: 480px;">
        <g *ngFor="let s of series()">
          <polyline [attr.points]="s.points" fill="none" [attr.stroke]="s.color" stroke-width="1.5" />
          <text [attr.x]="width - 80" [attr.y]="s.labelY" [attr.fill]="s.color" font-size="10">{{s.check_type}}</text>
        </g>
        <line *ngFor="let g of yGrid" [attr.x1]="40" [attr.x2]="width - 40" [attr.y1]="g.y" [attr.y2]="g.y" stroke="#e0e0e0" />
        <text *ngFor="let g of yGrid" [attr.x]="34" [attr.y]="g.y + 4" font-size="10" text-anchor="end">{{g.label}}</text>
      </svg>
    </div>
    <ng-template #loading><p>Loading…</p></ng-template>
  `,
  styles: [`
    .trend { padding: 16px; }
    .legend { color: var(--mat-sys-on-surface-variant); margin-bottom: 8px; }
  `],
})
export class QaTrendChartComponent implements OnInit {
  private svc = inject(QaTabService);
  width = 800; height = 400;
  series = signal<Array<{check_type: QaCheckType; points: string; color: string; labelY: number}>>([]);
  yGrid = [{ y: 60, label: '20' }, { y: 200, label: '10' }, { y: 340, label: '0' }];

  ngOnInit() {
    this.svc.getTrend(26).subscribe(res => {
      const byType = new Map<QaCheckType, TrendPoint[]>();
      for (const p of res.points) {
        if (!byType.has(p.check_type)) byType.set(p.check_type, []);
        byType.get(p.check_type)!.push(p);
      }
      const allWeeks = Array.from(new Set(res.points.map(p => p.week_start))).sort();
      const xStep = (this.width - 80) / Math.max(allWeeks.length - 1, 1);
      const maxFail = Math.max(20, Math.max(0, ...res.points.map(p => p.fail_count)));
      const colors = ['#1565c0','#2e7d32','#c62828','#ef6c00','#6a1b9a','#00838f','#558b2f','#5d4037','#37474f','#ad1457','#283593','#827717'];

      const series: Array<{check_type: QaCheckType; points: string; color: string; labelY: number}> = [];
      let i = 0;
      for (const [ct, pts] of byType) {
        const sorted = pts.sort((a, b) => a.week_start.localeCompare(b.week_start));
        const points = sorted.map((p) => {
          const wIdx = allWeeks.indexOf(p.week_start);
          const x = 40 + wIdx * xStep;
          const y = 340 - (p.fail_count / maxFail) * 280;
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(' ');
        const lastY = sorted.length ? 340 - (sorted[sorted.length - 1].fail_count / maxFail) * 280 : 340;
        series.push({ check_type: ct, points, color: colors[i % colors.length], labelY: lastY });
        i++;
      }
      this.series.set(series);
    });
  }
}
```

- [ ] **Step 5: Write qa-signoff-log.component.ts**

```typescript
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { QaTabService, SignoffRow } from '../qa-tab.service';

@Component({
  selector: 'qa-signoff-log',
  standalone: true,
  imports: [CommonModule, MatTableModule, MatButtonModule],
  template: `
    <table mat-table [dataSource]="signoffs()" class="mat-elevation-z1">
      <ng-container matColumnDef="week_start_date">
        <th mat-header-cell *matHeaderCellDef>Week</th>
        <td mat-cell *matCellDef="let s">{{s.week_start_date}}</td>
      </ng-container>
      <ng-container matColumnDef="signed_by_username">
        <th mat-header-cell *matHeaderCellDef>Signed by</th>
        <td mat-cell *matCellDef="let s">{{s.signed_by_username || '—'}}</td>
      </ng-container>
      <ng-container matColumnDef="count_regressions">
        <th mat-header-cell *matHeaderCellDef>Regressions</th>
        <td mat-cell *matCellDef="let s">{{s.count_regressions}}</td>
      </ng-container>
      <ng-container matColumnDef="count_persistent">
        <th mat-header-cell *matHeaderCellDef>Persistent</th>
        <td mat-cell *matCellDef="let s">{{s.count_persistent}}</td>
      </ng-container>
      <ng-container matColumnDef="count_new_green">
        <th mat-header-cell *matHeaderCellDef>New Green</th>
        <td mat-cell *matCellDef="let s">{{s.count_new_green}}</td>
      </ng-container>
      <ng-container matColumnDef="actions">
        <th mat-header-cell *matHeaderCellDef></th>
        <td mat-cell *matCellDef="let s">
          <button mat-button (click)="viewSnapshot(s.id)">View snapshot</button>
        </td>
      </ng-container>
      <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
      <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
    </table>
  `,
})
export class QaSignoffLogComponent implements OnInit {
  private svc = inject(QaTabService);
  signoffs = signal<SignoffRow[]>([]);
  displayedColumns = ['week_start_date', 'signed_by_username', 'count_regressions', 'count_persistent', 'count_new_green', 'actions'];

  ngOnInit() {
    this.svc.getSignoffs().subscribe(res => this.signoffs.set(res.signoffs));
  }

  viewSnapshot(id: number) {
    // Stub: route or open dialog. Implement when needed; for v1 just open in a new tab.
    window.open(`/api/dashboard/qa/history/signoffs/${id}`, '_blank');
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/app/features/dashboard/qa-tab/qa-history-view/
git commit -m "feat(qa): history view (heatmap, trend chart, signoff log)"
```

---

### Task 56: qa-signoff-dialog component

**Files:**
- Create: `/Users/amtoc/amtocbot-site/src/app/features/dashboard/qa-tab/qa-signoff-dialog.component.ts`

- [ ] **Step 1: Write component**

```typescript
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { QaTabService, EligibilityResponse } from './qa-tab.service';

@Component({
  selector: 'qa-signoff-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>Sign off week of {{nextMonday()}}</h2>
    <mat-dialog-content>
      <ng-container *ngIf="elig() as e">
        <ng-container *ngIf="e.eligible; else blocked">
          <p>Summary (latest run #{{e.run_id}}):</p>
          <ul>
            <li>Steady green: <b>{{e.summary.steady_green}}</b></li>
            <li>New green: <b>{{e.summary.new_green}}</b></li>
            <li>Persistent fail: <b>{{e.summary.persistent_fail}}</b></li>
            <li>Regressions: <b>{{e.summary.regressions}}</b></li>
          </ul>
          <mat-form-field appearance="outline" style="width:100%;">
            <mat-label>Notes (optional)</mat-label>
            <textarea matInput [(ngModel)]="notes" rows="2"></textarea>
          </mat-form-field>
        </ng-container>
        <ng-template #blocked>
          <p style="color:#c62828;">Cannot sign off — {{e.blockers.length}} item(s) need attention:</p>
          <ul>
            <li *ngFor="let b of e.blockers">
              <b>{{b.content_code}}</b> · {{b.check_type}} — {{b.why === 'regression_unaddressed' ? 'regression unaddressed' : 'no ack, no linked issue'}}
            </li>
          </ul>
        </ng-template>
      </ng-container>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button *ngIf="elig()?.eligible" mat-flat-button color="primary" (click)="signoff()" [disabled]="signing()">
        Confirm sign-off
      </button>
    </mat-dialog-actions>
  `,
})
export class QaSignoffDialogComponent implements OnInit {
  private svc = inject(QaTabService);
  ref = inject(MatDialogRef<QaSignoffDialogComponent>);

  elig = signal<EligibilityResponse | null>(null);
  notes = '';
  signing = signal(false);

  ngOnInit() {
    this.svc.getEligibility().subscribe(r => this.elig.set(r));
  }

  nextMonday(): string {
    const d = new Date();
    const day = d.getUTCDay();
    const diff = day === 1 ? 0 : day === 0 ? 1 : 8 - day; // next Monday
    d.setUTCDate(d.getUTCDate() + diff);
    return d.toISOString().slice(0, 10);
  }

  signoff() {
    this.signing.set(true);
    this.svc.signoff(this.nextMonday(), this.notes || undefined).subscribe({
      next: r => this.ref.close({ signed: true, signoff_id: r.signoff_id }),
      error: e => { this.signing.set(false); console.error(e); },
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/features/dashboard/qa-tab/qa-signoff-dialog.component.ts
git commit -m "feat(qa): qa-signoff-dialog with eligibility-aware UI"
```

---

### Task 57: qa-tab.component.ts (shell + refresh polling)

**Files:**
- Create: `/Users/amtoc/amtocbot-site/src/app/features/dashboard/qa-tab/qa-tab.component.ts`

- [ ] **Step 1: Write the shell**

```typescript
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { QaMatrixViewComponent } from './qa-matrix-view/qa-matrix-view.component';
import { QaCellPopoverComponent } from './qa-matrix-view/qa-cell-popover.component';
import { QaTodosViewComponent } from './qa-todos-view/qa-todos-view.component';
import { QaHistoryViewComponent } from './qa-history-view/qa-history-view.component';
import { QaSignoffDialogComponent } from './qa-signoff-dialog.component';
import { QaTabService, MatrixRow, QaCheckType } from './qa-tab.service';
import { interval, Subscription, takeWhile } from 'rxjs';

@Component({
  selector: 'qa-tab',
  standalone: true,
  imports: [CommonModule, MatTabsModule, MatDialogModule, MatSnackBarModule,
            QaMatrixViewComponent, QaTodosViewComponent, QaHistoryViewComponent],
  template: `
    <mat-tab-group #tabs>
      <mat-tab label="Matrix">
        <qa-matrix-view #matrix
          (cellClick)="openCellPopover($event)"
          (signoffClicked)="openSignoff()"
          (bulkAckClicked)="openBulkAck($event)"
          (refreshTriggered)="startPolling($event, matrix)">
        </qa-matrix-view>
      </mat-tab>
      <mat-tab label="Todos"><qa-todos-view></qa-todos-view></mat-tab>
      <mat-tab label="History"><qa-history-view></qa-history-view></mat-tab>
    </mat-tab-group>
  `,
})
export class QaTabComponent {
  private svc = inject(QaTabService);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);
  pollSub: Subscription | null = null;

  openCellPopover(ev: { row: MatrixRow; check_type: QaCheckType }) {
    const ref = this.dialog.open(QaCellPopoverComponent, { data: ev, width: '600px' });
    ref.afterClosed().subscribe(r => {
      if (r?.acked || r?.issue_id) this.snack.open('Saved', 'Dismiss', { duration: 3000 });
    });
  }

  openSignoff() {
    const ref = this.dialog.open(QaSignoffDialogComponent, { width: '520px' });
    ref.afterClosed().subscribe(r => {
      if (r?.signed) this.snack.open(`Week signed off (#${r.signoff_id})`, 'OK', { duration: 5000 });
    });
  }

  openBulkAck(cells: Array<{content_code: string; check_type: QaCheckType}>) {
    const reason = window.prompt(`Acknowledge ${cells.length} cells with what reason? (min 3 chars)`);
    if (!reason || reason.trim().length < 3) return;
    this.svc.acknowledgeBulk(cells, reason.trim()).subscribe(r => {
      this.snack.open(`Acknowledged ${r.count} cells`, 'OK', { duration: 4000 });
    });
  }

  startPolling(trackingRunAfter: string, matrixCmp: QaMatrixViewComponent) {
    let elapsedMs = 0;
    const intervalMs = 5000;
    const longRunMs = 5 * 60 * 1000;
    const timeoutMs = 16 * 60 * 1000;

    this.snack.open('Running checks via GitHub Actions… ~2-3 min', '', { duration: 4000 });
    this.pollSub?.unsubscribe();
    this.pollSub = interval(intervalMs).pipe(
      takeWhile(() => elapsedMs < timeoutMs),
    ).subscribe(() => {
      elapsedMs += intervalMs;
      this.svc.getRuns(trackingRunAfter, 1).subscribe(res => {
        const fresh = res.runs.find(r => r.finished_at);
        if (fresh) {
          this.pollSub?.unsubscribe();
          matrixCmp.refreshDone();
          this.snack.open(`Run #${fresh.id} complete`, 'OK', { duration: 4000 });
        } else if (elapsedMs >= timeoutMs) {
          matrixCmp.refreshDone();
          this.snack.open('Timed out — see GitHub Actions tab', 'OK', { duration: 8000 });
        } else if (elapsedMs >= longRunMs && elapsedMs < longRunMs + intervalMs) {
          this.snack.open('Still running, this is taking longer than usual…', '', { duration: 4000 });
        }
      });
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/features/dashboard/qa-tab/qa-tab.component.ts
git commit -m "feat(qa): qa-tab shell with refresh polling and dialog wiring"
```

---

### Task 58: Wire Tester tab into dashboard

**Files:**
- Modify: `/Users/amtoc/amtocbot-site/src/app/features/dashboard/dashboard.component.ts`

- [ ] **Step 1: Add imports + tab**

Find the existing imports list and add `QaTabComponent`:

```typescript
import { QaTabComponent } from './qa-tab/qa-tab.component';
```

Add to the component's `imports` array.

Inside the existing `<mat-tab-group>` template (at the appropriate position), add:

```html
<mat-tab label="Tester" *ngIf="canSeeQa()">
  <qa-tab></qa-tab>
</mat-tab>
```

- [ ] **Step 2: Add the permission check signal**

In the dashboard component class, add:

```typescript
canSeeQa = computed(() => this.auth.hasPermission('qa.view'));
```

(import `computed` from `@angular/core` if not already.)

- [ ] **Step 3: Build and verify**

```bash
cd /Users/amtoc/amtocbot-site && npx ng build --configuration=development 2>&1 | tail -10
```
Expected: Build successful.

- [ ] **Step 4: Commit**

```bash
git add src/app/features/dashboard/dashboard.component.ts
git commit -m "feat(qa): wire Tester tab into dashboard"
```

---

### Task 59: Local end-to-end test as tester

**Files:** none

- [ ] **Step 1: Start dev server**

```bash
cd /Users/amtoc/amtocbot-site && npx wrangler pages dev --port 8788 &
cd /Users/amtoc/amtocbot-site && npx ng serve --port 4200
```

Open http://localhost:4200/dashboard and log in as a tester.

- [ ] **Step 2: Visual check — matrix renders**

Click "Tester" tab. Expected:
- Matrix table visible with at least 1 row
- Cells show ✓/✗/–/? glyphs
- Refresh button enabled
- "Sign Off Week" button visible

- [ ] **Step 3: Click a failing cell**

Open the popover. Acknowledge with reason "test-ack" for 7 days. Snackbar shows "Saved". Cell now shows the ⓘ icon.

- [ ] **Step 4: Open Todos tab**

Expected: tier-grouped todo rows with action buttons.

- [ ] **Step 5: Open History tab**

Expected: heatmap renders with colored cells; trend chart renders an SVG; sign-off log table shows existing signoffs (or empty if none).

- [ ] **Step 6: Click Sign Off Week**

Dialog opens. If eligible: shows summary + Confirm. If blocked: shows blocker list.

---

### Task 60: Local end-to-end test as approver (read-only)

**Files:** none

- [ ] **Step 1: Log in as approver**

(Use a test user with role=approver in local D1.)

- [ ] **Step 2: Visual check**

Tester tab visible (approver has `qa.view`). Matrix renders. Verify:
- Refresh button: hidden or disabled
- Sign Off Week button: hidden
- Acknowledge selected toolbar: never appears
- Cell click → popover opens but Acknowledge / File Issue / Re-run are hidden or disabled

If buttons aren't gating correctly, fix in `qa-tab.component.ts` and the matrix/popover components.

- [ ] **Step 3: Commit any permission fixes**

If fixes needed:
```bash
git add -A && git commit -m "fix(qa): permission-gate tester actions for approver/reviewer"
```

---

### Task 61: Production deploy + smoke

**Files:** none

- [ ] **Step 1: Push**

```bash
cd /Users/amtoc/amtocbot-site && git push origin main
```

Wait for Cloudflare deploy.

- [ ] **Step 2: Smoke as a real tester user**

Log in to https://amtocbot.com/dashboard, click Tester. Verify all sub-tabs render with real data from prod runs.

- [ ] **Step 3: Tag**

```bash
git tag qa-phase-6-complete
git push origin qa-phase-6-complete
```

**Phase 6 done. Tester tab is live in production.**

---

## Phase 7 — Documentation & Final Acceptance

### Task 62: Tester-facing docs

**Files:**
- Create: `/Users/amtoc/amtocbot-site/docs/qa-traceability.md`

- [ ] **Step 1: Write the doc**

```markdown
# QA Traceability Matrix — Tester Guide

The **Tester** tab on `/dashboard` shows a live matrix of every published content piece × 12 publish/QA gates. Your job, weekly:

1. Open the **Tester** tab.
2. Look at the **Todos** sub-tab. Work top-down through the priority tiers.
3. For each red cell, either:
   - Click "Ack" → enter a reason ("CDN propagating", "scheduled fix this week", etc.) → 14-day default expiry, OR
   - Click "Issue" → file an issue that links back to the cell.
4. When the dashboard says "Sign Off Week", click it and confirm. The dialog will refuse if any failure is unaddressed or any regression hasn't been freshly acked/issued.

## What each check means

| Check | Pass when |
|---|---|
| `in_tracker` | The content has a row in `metrics/content-tracker.md` with status=`Published`. |
| `tracker_url_valid` | Primary URL is a real post URL (not a profile URL, not `— FAILED`). |
| `live_url_200` | Primary URL HEAD/GET returns 2xx. |
| `watermarked` | All final-output assets have the `amtocsoft:watermarked=v1` marker. |
| `youtube_uploaded` | (tale/podcast/video) Video ID is public on YouTube. |
| `youtube_thumbnail` | Custom thumbnail uploaded (not just YouTube's auto-generated frame). |
| `youtube_playlist` | Video is in the canonical playlist for its kind (Timeless Tales / Bot Thoughts Podcast). |
| `spotify_live` | (podcast) A real Spotify episode URL returns 2xx. |
| `blogger_live` | (blog/tutorial) Real Blogger post URL + every embedded image returns 200. |
| `linkedin_crosspost` | A real LinkedIn share/activity URL is recorded (not a profile link). |
| `x_crosspost` | A real X status URL is recorded. |
| `companion_repo` | (tutorial post 126+) A directory matching `NNN-` exists in `amtocbot-droid/amtocbot-examples`. |

## Cell glyph legend

- ✓ green — pass
- ✗ red — fail
- ✗! red bordered — regression (was green at last sign-off, now red — investigate first)
- – grey — N/A
- ? amber — unknown (check couldn't run; usually transient)
- ✗ⓘ — failure with active acknowledgement (hover for reason + expiry)
- ✗🔗 — failure linked to an open issue

## Refreshing

The "Refresh" button triggers a fresh GH Actions run. Round-trip ~2-3 min. The cron also runs daily at 06:00 UTC.

## When to use Bulk Ack

Whenever you see a category-wide failure (e.g. "all 80 podcasts missing X cross-posts"), check the row checkboxes and click "Acknowledge selected" — one reason applies to all.

## Sign-off rules

The sign-off button is **blocked** when:
- Any latest-run failure has neither an active ack nor a linked open issue
- Any regression vs. previous sign-off hasn't been *freshly* addressed (a pre-existing ack carried over from a prior week does NOT count)

This forces you to take a fresh look at every regression each week.

## When `unknown` piles up

If you see many `?` amber cells, check the GitHub Actions logs for the latest cron run — usually a token expiry or an external API outage.
```

- [ ] **Step 2: Commit**

```bash
cd /Users/amtoc/amtocbot-site
git add docs/qa-traceability.md
git commit -m "docs(qa): tester-facing guide"
```

---

### Task 63: Ops runbook

**Files:**
- Create: `/Users/amtoc/amtocbot-site/docs/qa-runbook.md`

- [ ] **Step 1: Write the runbook**

```markdown
# QA Suite — Ops Runbook

## Architecture

- GH Actions runs `scripts/qa-suite.py` daily at 06:00 UTC and on `workflow_dispatch`
- Suite POSTs JSON to `https://amtocbot.com/api/dashboard/qa/ingest` with bearer token
- Cloudflare Pages Functions writes to D1 (`qa_runs`, `qa_check_results`, etc.)
- Dashboard reads from D1 + writes acks/signoffs

## Token rotation (quarterly)

```bash
NEW_TOKEN=$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')
# Set in Cloudflare Pages env (encrypted): QA_INGEST_TOKEN
# Set in GH Actions secrets: QA_INGEST_TOKEN
# Trigger redeploy in Cloudflare; trigger workflow_dispatch in GH Actions to verify
```

## Adding a new check_type

1. Add to `QA_CHECK_TYPES` in `functions/api/dashboard/qa/_shared.ts` AND `qa-tab.service.ts`
2. Add a check function in `scripts/qa_checks/<area>_checks.py` returning `CheckResult`
3. Wire into `CHECK_RUNNERS` array in `scripts/qa-suite.py`
4. Add a column header and `shortLabel()` mapping in `qa-matrix-view.component.ts` and `qa-heatmap.component.ts`
5. Add tier classification (if it should appear in Todos) in `functions/api/dashboard/qa/todos.ts`
6. Update tester guide `docs/qa-traceability.md`

## Debugging a failed cron

1. Open https://github.com/amtocbot-droid/amtocsoft-content/actions/workflows/qa-suite.yml
2. Click the failed run; check stderr from "Run QA suite" step
3. Common failures:
   - HTTP 403 on ingest → token mismatch; rotate
   - HTTP 500 on ingest → check Cloudflare Worker logs
   - YouTube quota exceeded → wait for quota reset (midnight Pacific)
   - Network errors → re-trigger via workflow_dispatch
4. If suite crashed: download the `qa-suite-debug-<run_id>` artifact for the dumped payload

## Restoring after D1 outage

D1 is append-only for our purposes. On outage:
1. The cron run will fail at ingest; GH Actions marks it failed
2. After D1 recovers, trigger a manual `workflow_dispatch` to backfill the missed window
3. Idempotency via `client_run_id` — re-running the same suite invocation won't duplicate

## Health checks

Monitor cron health via `/api/cron/qa-monitors` (auto-runs every 6h). It emails `hello@amtocbot.com` if:
- No completed run in 36h
- >3 ingest 5xx in 24h
- Eligibility blockers >10 for >7 days

To manually test the monitor:
```bash
curl "https://amtocbot.com/api/cron/qa-monitors" -H "Authorization: Bearer $QA_INGEST_TOKEN"
```

## Schema rollback

If you need to drop the QA tables (full feature rollback):
```sql
DROP INDEX IF EXISTS idx_qa_signoffs_week;
DROP TABLE IF EXISTS qa_weekly_signoffs;
DROP INDEX IF EXISTS idx_qa_ack_active;
DROP TABLE IF EXISTS qa_acknowledgements;
DROP INDEX IF EXISTS idx_qa_results_status;
DROP INDEX IF EXISTS idx_qa_results_run;
DROP INDEX IF EXISTS idx_qa_results_latest;
DROP TABLE IF EXISTS qa_check_results;
DROP INDEX IF EXISTS idx_qa_runs_started;
DROP TABLE IF EXISTS qa_runs;
DROP INDEX IF EXISTS idx_issues_qa_link;
ALTER TABLE issues DROP COLUMN qa_check_type;
ALTER TABLE issues DROP COLUMN qa_content_code;
DELETE FROM schema_version WHERE version = 11;
```
```

- [ ] **Step 2: Commit**

```bash
git add docs/qa-runbook.md
git commit -m "docs(qa): ops runbook (token rotation, debugging, rollback)"
```

---

### Task 64: Update CLAUDE.md in both repos

**Files:**
- Modify: `/Users/amtoc/amtocbot-site/CLAUDE.md`
- Modify: `/Users/amtoc/amtocsoft-content/CLAUDE.md`

- [ ] **Step 1: Append to amtocbot-site/CLAUDE.md**

Add a new section above "Browser Automation Best Practices":

```markdown
## QA Traceability Matrix

The Tester tab on `/dashboard` provides a live matrix + prioritized todos + history view of every content piece × 12 publish/QA gates.

- **Architecture:** GH Actions in amtocsoft-content runs daily, POSTs to `/api/dashboard/qa/ingest` with bearer token. D1 stores snapshots forever. Pages Functions serves the matrix and accepts tester writes.
- **Permissions:** `qa.view` (admin/superadmin/tester/approver/reviewer); `qa.acknowledge`, `qa.signoff`, `qa.refresh` (admin/superadmin/tester only).
- **Sign-off:** weekly. Refuses if any failure is unaddressed or any regression hasn't been freshly acked/issued.
- **Tester docs:** `docs/qa-traceability.md`. **Ops runbook:** `docs/qa-runbook.md`.
- **Tables:** `qa_runs`, `qa_check_results`, `qa_acknowledgements`, `qa_weekly_signoffs` + new columns `issues.qa_content_code`, `issues.qa_check_type`.
```

- [ ] **Step 2: Append to amtocsoft-content/CLAUDE.md**

Inside the "Publishing Checklist" section, add a smoke step:

```markdown
### Pre-publish: QA suite smoke (manual)

Before committing a new piece of content, run the QA suite locally to confirm the new row passes the offline-safe checks:

```bash
python3 scripts/qa-suite.py --dry-run --offline --code <CODE>
```

This validates that `in_tracker`, `tracker_url_valid`, and `watermarked` all return `pass`. The full network-bound suite runs daily at 06:00 UTC via GH Actions and reports to the dashboard Tester tab.
```

- [ ] **Step 3: Commit both**

```bash
cd /Users/amtoc/amtocbot-site
git add CLAUDE.md
git commit -m "docs(qa): CLAUDE.md mentions QA traceability tab"
git push origin main

cd /Users/amtoc/amtocsoft-content
git add CLAUDE.md
git commit -m "docs(qa): CLAUDE.md adds qa-suite --dry-run smoke step"
git push origin main
```

---

### Task 65: Verify monitoring email fires

**Files:** none

- [ ] **Step 1: Simulate "no run in 36h" condition**

Temporarily mark the most recent qa_runs row as old:
```bash
cd /Users/amtoc/amtocbot-site
npx wrangler d1 execute engage-db --remote \
  --command "UPDATE qa_runs SET finished_at = datetime('now', '-48 hours') ORDER BY id DESC LIMIT 1"
```

- [ ] **Step 2: Trigger the monitor manually**

```bash
curl "https://amtocbot.com/api/cron/qa-monitors" -H "Authorization: Bearer $QA_INGEST_TOKEN"
```
Expected: response includes an `alerts` array with `no_run_36h` and `sent: true`.

- [ ] **Step 3: Verify email received**

Check `hello@amtocbot.com` (forwarded to amtocbot@gmail.com). Expected: an email titled `[QA] 1 alert(s)` with the alert detail.

- [ ] **Step 4: Restore the timestamp**

```bash
npx wrangler d1 execute engage-db --remote \
  --command "UPDATE qa_runs SET finished_at = datetime('now') WHERE id = (SELECT id FROM qa_runs ORDER BY id DESC LIMIT 1)"
```

(Or just trigger a fresh `workflow_dispatch` to land a real fresh run.)

---

### Task 66: Final acceptance verification

**Files:** none

Walk through every acceptance criterion from the spec (`docs/superpowers/specs/2026-04-25-qa-traceability-matrix-design.md` §10). For each one, run the verification and check off:

- [ ] **Criterion 1:** Migration 011 in prod D1 (4 tables + 2 issues columns).
  Verify: `npx wrangler d1 execute engage-db --remote --command "SELECT version FROM schema_version WHERE version=11"` returns 1 row.

- [ ] **Criterion 2:** Tester sees the Tester tab.
  Verify: log in as tester to https://amtocbot.com/dashboard; tab is visible.

- [ ] **Criterion 3:** Matrix populates from a successful cron run within 24h of phase 5.
  Verify: `qa_runs` has at least one `source='cron'` row; matrix UI shows ≥1 row.

- [ ] **Criterion 4a:** Tester can acknowledge with reason + 14-day default expiry.
  Verify: click a failing cell → Acknowledge → row appears in `qa_acknowledgements`.

- [ ] **Criterion 4b:** Tester can file an issue from a cell.
  Verify: click → File issue → new row in `issues` with `qa_content_code` and `qa_check_type` populated.

- [ ] **Criterion 4c:** Tester can view 8-tier todo list.
  Verify: Todos sub-tab renders, tiers grouped, empty tiers hidden.

- [ ] **Criterion 4d:** Tester can view heatmap, trend, sign-off log.
  Verify: History sub-tabs render data.

- [ ] **Criterion 4e:** Refresh → new run lands within 5 min.
  Verify: click Refresh; observe snackbar; verify `qa_runs` has new row within 5 min.

- [ ] **Criterion 4f:** Sign-off persists.
  Verify: when eligible, sign off; row appears in `qa_weekly_signoffs`.

- [ ] **Criterion 5:** Sign-off blocked by unaddressed fails / unaddressed regressions.
  Verify: leave one failure unacked → eligibility returns `eligible: false` with the blocker.

- [ ] **Criterion 6:** Approver/reviewer sees read-only.
  Verify: log in as approver; matrix renders, no Ack/Issue/Refresh/SignOff buttons.

- [ ] **Criterion 7:** Audit log shows ack/signoff/refresh/ingest events.
  Verify: open Audit Log tab, search `action LIKE 'qa.%'`; entries present.

- [ ] **Criterion 8:** Two consecutive 06:00 UTC cron runs without intervention.
  Already verified in Task 49.

- [ ] **Criterion 9:** Cron monitor email fires on simulated 36h-no-run.
  Already verified in Task 65.

- [ ] **Criterion 10:** `qa-suite.py --dry-run --code T014` prints valid payload.
  Already verified in Task 41.

- [ ] **Criterion 11:** Bulk acknowledge.
  Verify: select 5 rows in matrix → Acknowledge selected → 5 audit rows.

- [ ] **Criterion 12:** UI refresh round-trip ≤5 min, long-running snackbar at 5 min, timeout at 16 min.
  Verify: trigger refresh; watch UI for the 3 states.

---

### Task 67: Phase 7 commit checkpoint

- [ ] **Step 1: Tag**

```bash
cd /Users/amtoc/amtocbot-site
git tag qa-phase-7-complete
git push origin qa-phase-7-complete

cd /Users/amtoc/amtocsoft-content
git tag qa-phase-7-complete
git push origin qa-phase-7-complete
```

**ALL PHASES DONE. Feature complete and verified.**

---

## Self-review checklist

Before marking this plan executed, the implementer should re-verify:

- [ ] All 12 acceptance criteria pass (Task 66)
- [ ] No `console.log` / `print()` debug calls left in committed code
- [ ] All endpoints have CORS handlers (`onRequestOptions`)
- [ ] All write endpoints log to `audit_logs`
- [ ] Schema mirror in `schema.sql` matches the migration exactly
- [ ] Documentation in both repos is up to date
- [ ] No hardcoded secrets in any committed file
- [ ] `wrangler.toml` cron trigger is set
- [ ] First scheduled cron has fired in production
- [ ] At least one weekly sign-off has been recorded successfully

If any of these fail, fix before considering the feature shipped.






