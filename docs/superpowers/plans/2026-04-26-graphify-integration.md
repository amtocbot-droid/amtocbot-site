# Graphify Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `graphifyy` into both repos so Claude Code has a persistent knowledge graph of each codebase, and extend the Angular dashboard with QA metrics charts (trend + heatmap) powered by `ngx-echarts`.

**Architecture:** graphifyy is installed system-wide (Python CLI), run once per repo to produce `graphify-out/GRAPH_REPORT.md` + `graph.json`, then kept current via a PostToolUse hook that incrementally updates the graph after file writes. CLAUDE.md in each repo tells Claude to read the report before searching. The ngx-echarts charts live in a new `qa-tab/` sub-component directory, fetching data from the already-built `/api/dashboard/qa/history/*` endpoints.

**Tech Stack:** Python 3.10+ · graphifyy (pip) · Angular 21.2 · ngx-echarts 19 · Apache ECharts 5 · Cloudflare Pages Functions (D1, already live)

---

## File Map

### amtocsoft-content (`/Users/amtoc/amtocsoft-content/`)

| Action | Path | Purpose |
|--------|------|---------|
| Create (generated) | `graphify-out/GRAPH_REPORT.md` | Human-readable graph summary — **committed** |
| Create (generated) | `graphify-out/graph.json` | Machine-queryable graph — **gitignored** |
| Create (generated) | `graphify-out/graph.html` | Interactive viz — **gitignored** |
| Modify | `CLAUDE.md` | Add graphify read directive |
| Modify | `.claude/settings.json` | Add PostToolUse hook to re-scan on file write |
| Modify | `.gitignore` | Ignore `graphify-out/graph.json` + `graphify-out/graph.html` |

### amtocbot-site (`/Users/amtoc/amtocbot-site/`)

| Action | Path | Purpose |
|--------|------|---------|
| Create (generated) | `graphify-out/GRAPH_REPORT.md` | Human-readable graph summary — **committed** |
| Create (generated) | `graphify-out/graph.json` | Machine-queryable graph — **gitignored** |
| Create (generated) | `graphify-out/graph.html` | Interactive viz — **gitignored** |
| Create | `CLAUDE.md` | Graphify directive + key codebase facts |
| Create | `.claude/settings.json` | PostToolUse hook to re-scan on file write |
| Modify | `.gitignore` | Ignore `graphify-out/graph.json` + `graphify-out/graph.html` |
| Modify | `package.json` | Add `echarts` + `ngx-echarts` |
| Modify | `src/app/app.config.ts` | Add `provideEcharts()` |
| Create | `src/app/features/dashboard/qa-tab/qa-tab.component.ts` | QA tab shell (matrix stub + chart placeholders) |
| Create | `src/app/features/dashboard/qa-tab/qa-trend.component.ts` | Line chart: pass/fail/na counts over last 30 runs |
| Create | `src/app/features/dashboard/qa-tab/qa-heatmap.component.ts` | Calendar heatmap: fail-count by check_type × week |
| Modify | `src/app/features/dashboard/dashboard.component.ts` | Import QaTabComponent, add QA tab to mat-tab-group |

---

## Task 1: Install graphifyy system-wide

**Files:**
- No project files changed — system pip install only

- [ ] **Step 1: Install graphifyy**

```bash
pip install graphifyy
```

Expected output ends with: `Successfully installed graphifyy-X.Y.Z`

- [ ] **Step 2: Run graphify install (sets up CLI entry point)**

```bash
graphify install
```

Expected: `Graphify installed successfully` or similar confirmation. If `graphify` is not on PATH after this, run `pip show graphifyy` and add the scripts dir to PATH:

```bash
pip show graphifyy | grep Location
# e.g. Location: /opt/homebrew/lib/python3.12/site-packages
# Then: export PATH="/opt/homebrew/lib/python3.12/site-packages/../../../bin:$PATH"
```

- [ ] **Step 3: Verify CLI is available**

```bash
graphify --version
```

Expected: prints version like `graphify 0.x.y`. If it errors, resolve PATH before proceeding to Task 2.

---

## Task 2: Scan amtocsoft-content and commit graph report

**Files:**
- Create: `graphify-out/GRAPH_REPORT.md`
- Modify: `.gitignore`

- [ ] **Step 1: Run graphify on the content repo**

```bash
cd /Users/amtoc/amtocsoft-content
graphify . --mode deep
```

This indexes all `.py`, `.md`, `.json`, `.sh` files. Expected output: progress lines like `Indexing scripts/qa-suite.py…` then `Graph written to graphify-out/`. Takes 30–90 seconds on first run.

- [ ] **Step 2: Verify outputs exist**

```bash
ls -lh /Users/amtoc/amtocsoft-content/graphify-out/
```

Expected (all three files present):
```
-rw-r--r--  1 amtoc  staff   12K  Apr 26 10:00 GRAPH_REPORT.md
-rw-r--r--  1 amtoc  staff  245K  Apr 26 10:00 graph.html
-rw-r--r--  1 amtoc  staff   88K  Apr 26 10:00 graph.json
```

- [ ] **Step 3: Add graph.json and graph.html to .gitignore**

Append to `/Users/amtoc/amtocsoft-content/.gitignore`:

```
# Graphify — keep report, ignore binary/html artifacts
graphify-out/graph.json
graphify-out/graph.html
```

- [ ] **Step 4: Commit GRAPH_REPORT.md**

```bash
cd /Users/amtoc/amtocsoft-content
git add graphify-out/GRAPH_REPORT.md .gitignore
git commit -m "feat: add graphify knowledge graph report for amtocsoft-content"
```

---

## Task 3: Configure Claude Code integration for amtocsoft-content

**Files:**
- Modify: `CLAUDE.md` (add graphify directive section)
- Modify: `.claude/settings.json` (add PostToolUse hook)

- [ ] **Step 1: Add graphify directive to CLAUDE.md**

Open `/Users/amtoc/amtocsoft-content/CLAUDE.md` and insert this section immediately after the `## Mission` section (before `## Repository Structure`):

```markdown
## Codebase Knowledge Graph

A `graphify-out/GRAPH_REPORT.md` file is committed at the root of this repo. It contains a structured summary of every Python module, script, and key file — their purpose, dependencies, and relationships.

**Before searching for a file or function**, read `graphify-out/GRAPH_REPORT.md` first. It will tell you exactly which file to look at, saving redundant glob searches across 300+ content files and 20+ scripts.

The graph is automatically updated whenever a file is written (PostToolUse hook). If `GRAPH_REPORT.md` seems stale, run: `graphify . --update` from the repo root.
```

- [ ] **Step 2: Add PostToolUse hook to .claude/settings.json**

Read current `.claude/settings.json`:

```json
{
  "enabledPlugins": {
    "superpowers@claude-plugins-official": true
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "statusMessage": "Backing up blog post before revision...",
            "command": "/Users/amtoc/amtocsoft-content/.claude/backup-blog-revision.sh"
          }
        ]
      }
    ]
  }
}
```

Add a `PostToolUse` key alongside `PreToolUse` so the full `hooks` section becomes:

```json
"hooks": {
  "PreToolUse": [
    {
      "matcher": "Write",
      "hooks": [
        {
          "type": "command",
          "statusMessage": "Backing up blog post before revision...",
          "command": "/Users/amtoc/amtocsoft-content/.claude/backup-blog-revision.sh"
        }
      ]
    }
  ],
  "PostToolUse": [
    {
      "matcher": "Write",
      "hooks": [
        {
          "type": "command",
          "statusMessage": "Updating knowledge graph...",
          "command": "cd /Users/amtoc/amtocsoft-content && graphify . --update --quiet 2>/dev/null || true"
        }
      ]
    }
  ]
}
```

- [ ] **Step 3: Verify the hook fires**

Write a trivial test file to trigger the hook:

```bash
echo "# test" > /Users/amtoc/amtocsoft-content/graphify-test-trigger.md
```

Watch for the "Updating knowledge graph..." status message in Claude Code. Then delete the test file:

```bash
rm /Users/amtoc/amtocsoft-content/graphify-test-trigger.md
```

- [ ] **Step 4: Commit**

```bash
cd /Users/amtoc/amtocsoft-content
git add CLAUDE.md .claude/settings.json
git commit -m "feat: configure graphify Claude Code integration for amtocsoft-content"
```

---

## Task 4: Scan amtocbot-site and commit graph report

**Files:**
- Create: `graphify-out/GRAPH_REPORT.md`
- Modify: `.gitignore`

- [ ] **Step 1: Run graphify on the site repo**

```bash
cd /Users/amtoc/amtocbot-site
graphify . --mode deep
```

graphify will index `.ts`, `.html`, `.css`, `.json` files — Angular components, Cloudflare Pages Functions, migrations, and configs. Expected time: 45–120 seconds (larger repo with `node_modules`). graphify skips `node_modules/` and `dist/` by default. If it doesn't, pass:

```bash
graphify . --mode deep --exclude node_modules --exclude dist
```

- [ ] **Step 2: Verify outputs exist**

```bash
ls -lh /Users/amtoc/amtocbot-site/graphify-out/
```

Expected (all three files present):
```
-rw-r--r--  1 amtoc  staff   18K  Apr 26 10:10 GRAPH_REPORT.md
-rw-r--r--  1 amtoc  staff  380K  Apr 26 10:10 graph.html
-rw-r--r--  1 amtoc  staff  142K  Apr 26 10:10 graph.json
```

- [ ] **Step 3: Add graph.json and graph.html to .gitignore**

Read current `.gitignore` and append:

```
# Graphify — keep report, ignore binary/html artifacts
graphify-out/graph.json
graphify-out/graph.html
```

- [ ] **Step 4: Commit GRAPH_REPORT.md**

```bash
cd /Users/amtoc/amtocbot-site
git add graphify-out/GRAPH_REPORT.md .gitignore
git commit -m "feat: add graphify knowledge graph report for amtocbot-site"
```

---

## Task 5: Configure Claude Code integration for amtocbot-site

**Files:**
- Create: `CLAUDE.md`
- Create: `.claude/settings.json`

- [ ] **Step 1: Create CLAUDE.md for amtocbot-site**

Create `/Users/amtoc/amtocbot-site/CLAUDE.md`:

```markdown
# amtocbot-site Codebase Guide

Angular 21.2 SPA + Cloudflare Pages Functions backend. D1 SQLite via `env.ENGAGE_DB`.

## Stack Quick-Reference

- **Frontend:** Angular 21.2, Angular Material, standalone components, signals
- **Backend:** Cloudflare Pages Functions (`functions/api/**/*.ts`), file-based routing
- **DB:** D1 (SQLite), migrations in `migrations/`, applied via `wrangler d1 execute`
- **Auth:** Session cookie `engage_session`, `getSessionUser(request, env.ENGAGE_DB)` → `requirePermission(user, perm)`
- **Build:** `npx ng build && cp dist/.../index.csr.html dist/.../index.html`
- **Deploy:** `npx wrangler pages deploy dist/amtocbot-site/browser --project-name=amtocbot-site`

## Key Conventions

- All API responses use `jsonResponse(body, status)` from `functions/api/_shared/auth.ts`
- Permission check pattern: `const deny = requirePermission(user, 'perm.name'); if (deny) return deny;`
- User ID field is `user.user_id` (not `user.id`)
- QA endpoints re-export from `functions/api/dashboard/qa/_shared.ts`
- Angular services use `inject(HttpClient)` pattern (not constructor injection)

## Codebase Knowledge Graph

A `graphify-out/GRAPH_REPORT.md` file is committed at the root of this repo. It contains a structured map of every Angular component, service, Cloudflare Pages Function, and migration — their relationships and dependencies.

**Before searching for a file or function**, read `graphify-out/GRAPH_REPORT.md` first. It will point you directly to the right file, saving grep-across-400-TypeScript-files searches.

The graph updates automatically via PostToolUse hook after every file write. To manually refresh: `graphify . --update --exclude node_modules --exclude dist` from the repo root.
```

- [ ] **Step 2: Create .claude/settings.json for amtocbot-site**

```bash
mkdir -p /Users/amtoc/amtocbot-site/.claude
```

Create `/Users/amtoc/amtocbot-site/.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "statusMessage": "Updating knowledge graph...",
            "command": "cd /Users/amtoc/amtocbot-site && graphify . --update --exclude node_modules --exclude dist --quiet 2>/dev/null || true"
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 3: Verify hook fires on a test write**

Create and delete a dummy file to trigger the hook:

```bash
echo "test" > /Users/amtoc/amtocbot-site/graphify-hook-test.txt
```

Watch for the "Updating knowledge graph..." status in Claude Code. Then:

```bash
rm /Users/amtoc/amtocbot-site/graphify-hook-test.txt
```

- [ ] **Step 4: Commit**

```bash
cd /Users/amtoc/amtocbot-site
git add CLAUDE.md .claude/settings.json
git commit -m "feat: configure graphify Claude Code integration for amtocbot-site"
```

---

## Task 6: Add ngx-echarts to amtocbot-site

**Files:**
- Modify: `package.json` (via npm install)
- Modify: `src/app/app.config.ts`

- [ ] **Step 1: Install echarts and ngx-echarts**

```bash
cd /Users/amtoc/amtocbot-site
npm install echarts ngx-echarts
```

Expected: both packages appear in `package.json` dependencies. As of writing, compatible versions are `echarts@^5.6` + `ngx-echarts@^19.0`.

- [ ] **Step 2: Add provideEcharts() to app.config.ts**

Open `src/app/app.config.ts`. Current providers array:

```typescript
providers: [
  provideBrowserGlobalErrorListeners(),
  provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' })),
  provideHttpClient(withFetch()),
  provideClientHydration(withEventReplay()),
  {
    provide: APP_INITIALIZER,
    useFactory: initTheme,
    deps: [ThemeService],
    multi: true,
  },
],
```

Add the import and provider:

```typescript
import { provideEcharts } from 'ngx-echarts';

// Inside providers array, after provideClientHydration:
provideEcharts(),
```

Full updated providers array:

```typescript
providers: [
  provideBrowserGlobalErrorListeners(),
  provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' })),
  provideHttpClient(withFetch()),
  provideClientHydration(withEventReplay()),
  provideEcharts(),
  {
    provide: APP_INITIALIZER,
    useFactory: initTheme,
    deps: [ThemeService],
    multi: true,
  },
],
```

- [ ] **Step 3: Verify TypeScript build passes**

```bash
cd /Users/amtoc/amtocbot-site
npx tsc --noEmit
```

Expected: zero errors. If `provideEcharts` import fails with "Module not found", the ngx-echarts version may not match Angular 21 — check `npm ls ngx-echarts` and install `@latest` if needed.

- [ ] **Step 4: Commit**

```bash
cd /Users/amtoc/amtocbot-site
git add package.json package-lock.json src/app/app.config.ts
git commit -m "feat: add ngx-echarts for QA dashboard charts"
```

---

## Task 7: QA Trend line chart component

**Files:**
- Create: `src/app/features/dashboard/qa-tab/qa-trend.component.ts`

The `/api/dashboard/qa/history/trend` endpoint already exists (Phase 3). It returns:

```json
{
  "runs": [
    { "run_id": 1, "finished_at": "2026-04-20T10:00:00Z", "total_pass": 280, "total_fail": 12, "total_na": 8, "total_checks": 300 },
    { "run_id": 2, "finished_at": "2026-04-21T10:00:00Z", "total_pass": 290, "total_fail": 8, "total_na": 2, "total_checks": 300 }
  ],
  "limit": 30
}
```

- [ ] **Step 1: Create the trend component**

Create `/Users/amtoc/amtocbot-site/src/app/features/dashboard/qa-tab/qa-trend.component.ts`:

```typescript
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';

interface TrendRun {
  run_id: number;
  finished_at: string;
  total_pass: number;
  total_fail: number;
  total_na: number;
  total_checks: number;
}

@Component({
  selector: 'app-qa-trend',
  standalone: true,
  imports: [CommonModule, NgxEchartsDirective],
  template: `
    <div class="qa-trend-chart">
      <h3 class="chart-title">QA Run Trend (last 30 runs)</h3>
      @if (loading) {
        <div class="chart-loading">Loading trend data…</div>
      } @else if (error) {
        <div class="chart-error">{{ error }}</div>
      } @else {
        <div echarts [options]="chartOptions" class="echart" style="height:280px;width:100%"></div>
      }
    </div>
  `,
  styles: [`
    .qa-trend-chart { padding: 8px 0; }
    .chart-title { font-size: 14px; font-weight: 500; margin: 0 0 12px; color: var(--mat-sys-on-surface); }
    .chart-loading, .chart-error { height: 280px; display: flex; align-items: center; justify-content: center;
      font-size: 13px; color: var(--mat-sys-outline); }
    .chart-error { color: var(--mat-sys-error); }
  `],
})
export class QaTrendComponent implements OnInit {
  private http = inject(HttpClient);

  loading = true;
  error: string | null = null;
  chartOptions: EChartsOption = {};

  ngOnInit(): void {
    this.http.get<{ runs: TrendRun[] }>('/api/dashboard/qa/history/trend?limit=30').subscribe({
      next: ({ runs }) => {
        this.loading = false;
        if (!runs.length) { this.error = 'No run history yet.'; return; }
        const labels = runs.map(r => r.finished_at.slice(5, 10)); // MM-DD
        this.chartOptions = {
          tooltip: { trigger: 'axis' },
          legend: { data: ['Pass', 'Fail', 'N/A'], bottom: 0 },
          grid: { left: 40, right: 20, top: 20, bottom: 36 },
          xAxis: { type: 'category', data: labels, axisLabel: { rotate: 45, fontSize: 11 } },
          yAxis: { type: 'value', name: 'Checks', nameTextStyle: { fontSize: 11 } },
          series: [
            { name: 'Pass', type: 'line', smooth: true, data: runs.map(r => r.total_pass),
              lineStyle: { color: '#4caf50' }, itemStyle: { color: '#4caf50' }, areaStyle: { opacity: 0.08 } },
            { name: 'Fail', type: 'line', smooth: true, data: runs.map(r => r.total_fail),
              lineStyle: { color: '#f44336' }, itemStyle: { color: '#f44336' }, areaStyle: { opacity: 0.08 } },
            { name: 'N/A', type: 'line', smooth: true, data: runs.map(r => r.total_na),
              lineStyle: { color: '#9e9e9e', type: 'dashed' }, itemStyle: { color: '#9e9e9e' } },
          ],
        };
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.error ?? 'Failed to load trend data.';
      },
    });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/amtoc/amtocbot-site
npx tsc --noEmit
```

Expected: zero errors. If `EChartsOption` import path errors, change `import type { EChartsOption } from 'echarts'` to `import type { EChartsOption } from 'echarts/types/dist/shared'`.

- [ ] **Step 3: Commit**

```bash
cd /Users/amtoc/amtocbot-site
git add src/app/features/dashboard/qa-tab/qa-trend.component.ts
git commit -m "feat(qa-dashboard): add QA trend line chart component"
```

---

## Task 8: QA Heatmap component

**Files:**
- Create: `src/app/features/dashboard/qa-tab/qa-heatmap.component.ts`

The `/api/dashboard/qa/history/heatmap` endpoint already exists (Phase 3). It returns:

```json
{
  "heatmap": [
    { "week": "2026-04-20", "check_type": "live_url_200", "total": 50, "fail": 3 },
    { "week": "2026-04-20", "check_type": "watermarked", "total": 50, "fail": 0 }
  ],
  "check_types": ["in_tracker", "tracker_url_valid", "live_url_200", ...]
}
```

- [ ] **Step 1: Create the heatmap component**

Create `/Users/amtoc/amtocbot-site/src/app/features/dashboard/qa-tab/qa-heatmap.component.ts`:

```typescript
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';

interface HeatCell {
  week: string;
  check_type: string;
  total: number;
  fail: number;
}

@Component({
  selector: 'app-qa-heatmap',
  standalone: true,
  imports: [CommonModule, NgxEchartsDirective],
  template: `
    <div class="qa-heatmap-chart">
      <h3 class="chart-title">Failure Heatmap — Check Type × Week</h3>
      @if (loading) {
        <div class="chart-loading">Loading heatmap…</div>
      } @else if (error) {
        <div class="chart-error">{{ error }}</div>
      } @else {
        <div echarts [options]="chartOptions" class="echart" [style.height]="chartHeight" style="width:100%"></div>
      }
    </div>
  `,
  styles: [`
    .qa-heatmap-chart { padding: 8px 0; }
    .chart-title { font-size: 14px; font-weight: 500; margin: 0 0 12px; color: var(--mat-sys-on-surface); }
    .chart-loading, .chart-error { height: 320px; display: flex; align-items: center; justify-content: center;
      font-size: 13px; color: var(--mat-sys-outline); }
    .chart-error { color: var(--mat-sys-error); }
  `],
})
export class QaHeatmapComponent implements OnInit {
  private http = inject(HttpClient);

  loading = true;
  error: string | null = null;
  chartOptions: EChartsOption = {};
  chartHeight = '320px';

  ngOnInit(): void {
    this.http.get<{ heatmap: HeatCell[]; check_types: string[] }>('/api/dashboard/qa/history/heatmap?weeks=8').subscribe({
      next: ({ heatmap, check_types }) => {
        this.loading = false;
        if (!heatmap.length) { this.error = 'No heatmap data yet.'; return; }

        // Collect unique weeks (x-axis) and check types (y-axis)
        const weeks = [...new Set(heatmap.map(c => c.week))].sort();
        const checks = check_types; // already ordered from API

        // Build [weekIdx, checkIdx, failCount] triples for scatter series
        const data: [number, number, number][] = [];
        for (const cell of heatmap) {
          const xi = weeks.indexOf(cell.week);
          const yi = checks.indexOf(cell.check_type);
          if (xi >= 0 && yi >= 0) data.push([xi, yi, cell.fail]);
        }

        const maxFail = Math.max(...data.map(d => d[2]), 1);
        this.chartHeight = `${Math.max(280, checks.length * 28 + 60)}px`;

        this.chartOptions = {
          tooltip: {
            formatter: (p: any) => {
              const [xi, yi, fail] = p.data as [number, number, number];
              return `${checks[yi]}<br/>${weeks[xi]}<br/>Failures: <b>${fail}</b>`;
            },
          },
          grid: { left: 160, right: 20, top: 20, bottom: 60 },
          xAxis: {
            type: 'category', data: weeks.map(w => w.slice(5)), // MM-DD
            axisLabel: { rotate: 45, fontSize: 11 },
          },
          yAxis: {
            type: 'category', data: checks,
            axisLabel: { fontSize: 11 },
          },
          visualMap: {
            min: 0, max: maxFail, calculable: true,
            orient: 'horizontal', left: 'center', bottom: 0,
            inRange: { color: ['#f5f5f5', '#ffcdd2', '#f44336'] },
          },
          series: [{
            name: 'Failures',
            type: 'scatter',
            data,
            symbolSize: (val: [number, number, number]) => {
              const ratio = val[2] / maxFail;
              return Math.max(4, Math.round(ratio * 28));
            },
            itemStyle: { opacity: 0.85 },
          }],
        };
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.error ?? 'Failed to load heatmap data.';
      },
    });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/amtoc/amtocbot-site
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/amtoc/amtocbot-site
git add src/app/features/dashboard/qa-tab/qa-heatmap.component.ts
git commit -m "feat(qa-dashboard): add QA failure heatmap component"
```

---

## Task 9: QA tab shell and wire into dashboard

**Files:**
- Create: `src/app/features/dashboard/qa-tab/qa-tab.component.ts`
- Modify: `src/app/features/dashboard/dashboard.component.ts`

- [ ] **Step 1: Create the QA tab shell component**

Create `/Users/amtoc/amtocbot-site/src/app/features/dashboard/qa-tab/qa-tab.component.ts`:

```typescript
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { QaTrendComponent } from './qa-trend.component';
import { QaHeatmapComponent } from './qa-heatmap.component';

interface QaRun {
  id: number;
  source: string;
  started_at: string;
  finished_at: string | null;
  total_checks: number;
  total_pass: number;
  total_fail: number;
  total_na: number;
}

@Component({
  selector: 'app-qa-tab',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule, MatButtonModule, MatSelectModule, MatFormFieldModule,
    MatProgressBarModule, MatChipsModule,
    QaTrendComponent, QaHeatmapComponent,
  ],
  template: `
    <div class="qa-tab-container">

      <!-- Latest run summary -->
      <div class="qa-header-row">
        <h2 class="section-title">QA Traceability</h2>
        @if (latestRun()) {
          <div class="run-summary-chips">
            <mat-chip class="chip-pass">{{ latestRun()!.total_pass }} pass</mat-chip>
            <mat-chip class="chip-fail">{{ latestRun()!.total_fail }} fail</mat-chip>
            <mat-chip class="chip-na">{{ latestRun()!.total_na }} n/a</mat-chip>
            <span class="run-meta">Run #{{ latestRun()!.id }} · {{ latestRun()!.source }} · {{ latestRun()!.finished_at | date:'MMM d, HH:mm' }}</span>
          </div>
        }
      </div>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
      }

      <!-- Charts row -->
      <div class="charts-grid">
        <mat-card class="chart-card">
          <mat-card-content>
            <app-qa-trend></app-qa-trend>
          </mat-card-content>
        </mat-card>
        <mat-card class="chart-card">
          <mat-card-content>
            <app-qa-heatmap></app-qa-heatmap>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Matrix placeholder — Phase 6 full implementation -->
      <mat-card class="matrix-placeholder-card">
        <mat-card-content>
          <p class="placeholder-text">
            Full QA matrix (content × check grid, acknowledgements, sign-off) coming in Phase 6.
          </p>
        </mat-card-content>
      </mat-card>

    </div>
  `,
  styles: [`
    .qa-tab-container { padding: 16px; }
    .qa-header-row { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
    .section-title { font-size: 18px; font-weight: 500; margin: 0; }
    .run-summary-chips { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .run-meta { font-size: 12px; color: var(--mat-sys-outline); }
    .chip-pass { background: #e8f5e9 !important; color: #2e7d32 !important; }
    .chip-fail { background: #ffebee !important; color: #c62828 !important; }
    .chip-na  { background: #f5f5f5 !important; color: #616161 !important; }
    .charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
    @media (max-width: 900px) { .charts-grid { grid-template-columns: 1fr; } }
    .chart-card, .matrix-placeholder-card { border-radius: 8px; }
    .placeholder-text { color: var(--mat-sys-outline); font-size: 13px; text-align: center; padding: 24px 0; margin: 0; }
  `],
})
export class QaTabComponent implements OnInit {
  private http = inject(HttpClient);

  loading = signal(true);
  latestRun = signal<QaRun | null>(null);

  ngOnInit(): void {
    this.http.get<{ runs: QaRun[] }>('/api/dashboard/qa/runs?limit=1').subscribe({
      next: ({ runs }) => {
        this.loading.set(false);
        this.latestRun.set(runs[0] ?? null);
      },
      error: () => this.loading.set(false),
    });
  }
}
```

- [ ] **Step 2: Add QaTabComponent import to dashboard.component.ts**

In `dashboard.component.ts`, add to the imports array and add a new `<mat-tab>` for QA.

Find the line:
```typescript
import { TutorialComponent } from './tutorial/tutorial.component';
import { TutorialService } from './tutorial/tutorial.service';
```

Add after it:
```typescript
import { QaTabComponent } from './qa-tab/qa-tab.component';
```

In the `@Component` `imports` array, add `QaTabComponent` alongside the other tab components:
```typescript
imports: [
  // ... existing imports ...
  ReferralsTabComponent,
  AdminTabComponent,
  AuditLogTabComponent,
  TutorialComponent,
  QaTabComponent,   // ← add this
],
```

In the template, find the last `</mat-tab>` before `</mat-tab-group>` and add after it:

```html
<!-- QA Tab — qa.view permission -->
@if (auth.hasPermission('qa.view')) {
  <mat-tab label="QA">
    <div class="tab-content">
      <app-qa-tab></app-qa-tab>
    </div>
  </mat-tab>
}
```

- [ ] **Step 3: Verify TypeScript build is clean**

```bash
cd /Users/amtoc/amtocbot-site
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Run wrangler dev and smoke-test the QA tab**

```bash
cd /Users/amtoc/amtocbot-site
npx wrangler pages dev dist/amtocbot-site/browser --port 8790
```

Build first if needed: `npx ng build`.

Navigate to `http://localhost:8790/dashboard`. Log in as a user with `qa.view` permission. Click the "QA" tab. Verify:
- Run summary chips appear (or loading bar if no runs yet)
- Trend chart renders with axes (empty series is fine if no history)
- Heatmap chart renders (or "No heatmap data yet" message)
- No console errors in DevTools

- [ ] **Step 5: Commit**

```bash
cd /Users/amtoc/amtocbot-site
git add src/app/features/dashboard/qa-tab/
git add src/app/features/dashboard/dashboard.component.ts
git commit -m "feat(qa-dashboard): wire QA tab with trend chart + heatmap into dashboard"
```

---

## Self-Review

### Spec coverage

| Requirement | Task |
|---|---|
| Install graphifyy | Task 1 |
| Scan amtocsoft-content | Task 2 |
| CLAUDE.md directive for amtocsoft-content | Task 3 |
| PostToolUse hook for amtocsoft-content | Task 3 |
| Scan amtocbot-site | Task 4 |
| CLAUDE.md for amtocbot-site | Task 5 |
| PostToolUse hook for amtocbot-site | Task 5 |
| ngx-echarts installed + wired | Task 6 |
| Trend line chart | Task 7 |
| Heatmap chart | Task 8 |
| QA tab visible in dashboard | Task 9 |
| Permission-gated (qa.view) | Task 9 |

### Placeholder scan

No TBDs, no "implement later", no "similar to Task N". All code blocks are complete. All commands have expected output.

### Type consistency

- `QaTrendComponent` selector: `app-qa-trend` — used as `<app-qa-trend>` in QaTabComponent ✓
- `QaHeatmapComponent` selector: `app-qa-heatmap` — used as `<app-qa-heatmap>` in QaTabComponent ✓
- `QaTabComponent` selector: `app-qa-tab` — used as `<app-qa-tab>` in dashboard template ✓
- `latestRun()!.total_pass` — `QaRun.total_pass: number` defined in Task 9 ✓
- `auth.hasPermission('qa.view')` — existing AuthService method, already in use on other tabs ✓
