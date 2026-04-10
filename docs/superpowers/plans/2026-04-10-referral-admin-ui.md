# Referral Admin UI + Audit Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an audit log to amtocsoft.com's referral system, expose it via two new admin API endpoints, proxy those calls through amtocbot's worker (keeping the admin key server-side), and surface everything in a new "Referrals" tab in the amtocbot.com dashboard (admin-only).

**Architecture:** amtocsoft `_worker.js` gains `audit_log` writes on every referral action, plus `GET /api/admin/referrals` and `GET /api/admin/audit`. amtocbot adds a `functions/api/proxy/amtocsoft.ts` Pages Function that gates on the existing session auth and forwards calls to amtocsoft with the `X-Admin-Key` secret header injected server-side. The Angular `ReferralsTabComponent` talks only to `/api/proxy/amtocsoft` — the admin key never touches the browser bundle.

**Tech Stack:** Cloudflare D1, Cloudflare Pages Functions (TypeScript), Angular 19 standalone components, `signal()`, `fetch`.

**Repos:**
- amtocsoft: `/Users/amtoc/amtocsoft/www/`
- amtocbot-site: `/Users/amtoc/amtocbot-site/`

---

## File Map

| File | Action | Repo |
|---|---|---|
| `www/schema.sql` | Add `audit_log` table + indexes | amtocsoft |
| `www/_worker.js` | Add audit writes + `GET /api/admin/referrals` + `GET /api/admin/audit` | amtocsoft |
| `functions/api/proxy/amtocsoft.ts` | Create — session-gated proxy to amtocsoft admin endpoints | amtocbot-site |
| `wrangler.toml` | Add `AMTOCSOFT_ADMIN_KEY` secret comment (actual secret added via wrangler CLI) | amtocbot-site |
| `src/app/features/dashboard/referrals-tab/referrals-tab.component.ts` | Create | amtocbot-site |
| `src/app/features/dashboard/dashboard.component.ts` | Add Referrals tab (admin only) | amtocbot-site |

---

## Task 1: audit_log Schema + Worker Endpoints + Audit Writes (amtocsoft repo)

**Files:**
- Modify: `/Users/amtoc/amtocsoft/www/schema.sql`
- Modify: `/Users/amtoc/amtocsoft/www/_worker.js`

- [ ] **Step 1: Append `audit_log` table to `/Users/amtoc/amtocsoft/www/schema.sql`**

```sql
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  code TEXT,
  actor TEXT,
  result TEXT,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_code ON audit_log(code);
```

- [ ] **Step 2: Apply the schema to the remote D1 database**

```bash
cd /Users/amtoc/amtocsoft/www
npx wrangler d1 execute amtocsoft-db --remote --command="
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  code TEXT,
  actor TEXT,
  result TEXT,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_code ON audit_log(code);"
```

Expected: `Executed 2 queries ... success: true`

- [ ] **Step 3: Add `writeAudit` helper at top of `_worker.js` (after existing helpers)**

Find the line `async function handleCheckout(request, env) {` and add this helper function immediately before it:

```javascript
async function writeAudit(env, action, code, actor, result, detail) {
  try {
    await env.DB.prepare(
      'INSERT INTO audit_log (action, code, actor, result, detail) VALUES (?, ?, ?, ?, ?)'
    ).bind(action, code ?? null, actor ?? null, result ?? null, detail ? JSON.stringify(detail) : null).run();
  } catch (e) {
    console.error('audit write failed:', e);
  }
}
```

- [ ] **Step 4: Add audit writes to existing handlers in `_worker.js`**

**In `handleAdminReferral`:** after the `INSERT INTO referral_codes` statement succeeds, add:
```javascript
await writeAudit(env, 'code_created', code, request.headers.get('CF-Connecting-IP') || 'unknown', 'success', { discount_cents, type });
```

**In `handleReferralValidate`:** after the `const row = await env.DB.prepare(...)` call:
- If `!row`: add `await writeAudit(env, 'code_validated', code, request.headers.get('CF-Connecting-IP') || 'unknown', 'invalid', null);`
- If `row.used`: add `await writeAudit(env, 'code_validated', code, request.headers.get('CF-Connecting-IP') || 'unknown', 'already_used', null);`
- If valid: add `await writeAudit(env, 'code_validated', code, request.headers.get('CF-Connecting-IP') || 'unknown', 'valid', null);`

**In `handleCheckout`:** after the referral code is marked used (the `UPDATE referral_codes SET used=1` line), add:
```javascript
await writeAudit(env, 'code_redeemed', referral_code, request.headers.get('CF-Connecting-IP') || 'unknown', 'success', { module });
```

**In `handleAdminReview`:** after the `UPDATE reviews SET approved=?` statement, add:
```javascript
await writeAudit(env, 'review_moderated', null, request.headers.get('CF-Connecting-IP') || 'unknown', 'success', { id, approved });
```

- [ ] **Step 5: Add `GET /api/admin/referrals` handler to `_worker.js`**

Add this function before the `export default {` line:

```javascript
async function handleAdminReferrals(request, env) {
  const check = requireAdmin(request, env);
  if (check) return check;
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);
  const usedFilter = url.searchParams.get('used'); // '0', '1', or null for all
  const typeFilter = url.searchParams.get('type'); // 'manual', 'auto', or null

  let where = 'WHERE 1=1';
  const binds = [];
  if (usedFilter === '0' || usedFilter === '1') { where += ' AND used = ?'; binds.push(parseInt(usedFilter, 10)); }
  if (typeFilter === 'manual' || typeFilter === 'auto') { where += ' AND type = ?'; binds.push(typeFilter); }

  const countQuery = `SELECT COUNT(*) as total FROM referral_codes ${where}`;
  const rowsQuery = `SELECT code, type, creator_email, discount_cents, used, used_by, used_at, created_at FROM referral_codes ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`;

  const [countRow, rows] = await Promise.all([
    env.DB.prepare(countQuery).bind(...binds).first(),
    env.DB.prepare(rowsQuery).bind(...binds, limit, offset).all(),
  ]);

  return json({ items: rows.results || [], total: countRow?.total ?? 0 });
}
```

- [ ] **Step 6: Add `GET /api/admin/audit` handler to `_worker.js`**

```javascript
async function handleAdminAudit(request, env) {
  const check = requireAdmin(request, env);
  if (check) return check;
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);
  const actionFilter = url.searchParams.get('action');
  const codeFilter = url.searchParams.get('code');

  let where = 'WHERE 1=1';
  const binds = [];
  if (actionFilter) { where += ' AND action = ?'; binds.push(actionFilter); }
  if (codeFilter) { where += ' AND code = ?'; binds.push(codeFilter); }

  const countQuery = `SELECT COUNT(*) as total FROM audit_log ${where}`;
  const rowsQuery = `SELECT id, action, code, actor, result, detail, created_at FROM audit_log ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`;

  const [countRow, rows] = await Promise.all([
    env.DB.prepare(countQuery).bind(...binds).first(),
    env.DB.prepare(rowsQuery).bind(...binds, limit, offset).all(),
  ]);

  return json({ items: rows.results || [], total: countRow?.total ?? 0 });
}
```

- [ ] **Step 7: Register the two new routes in the `fetch` handler**

In the `export default { async fetch(request, env, ctx) {` block, add these two lines alongside the existing `if (path === '/api/admin/referral'...` line:

```javascript
if (path === '/api/admin/referrals' && method === 'GET') return handleAdminReferrals(request, env);
if (path === '/api/admin/audit' && method === 'GET') return handleAdminAudit(request, env);
```

- [ ] **Step 8: Deploy amtocsoft worker**

```bash
cd /Users/amtoc/amtocsoft/www
npx wrangler pages deploy . --project-name=amtocsoft --commit-dirty=true 2>&1 | tail -5
```

Expected: `Deployment complete!`

- [ ] **Step 9: Smoke test both new endpoints**

```bash
# Test referrals list (replace with your actual admin key)
curl -s "https://amtocsoft.com/api/admin/referrals" \
  -H "X-Admin-Key: 1eafc24e502169cccbe9e912b4a06769" | python3 -m json.tool | head -20

# Test audit log
curl -s "https://amtocsoft.com/api/admin/audit" \
  -H "X-Admin-Key: 1eafc24e502169cccbe9e912b4a06769" | python3 -m json.tool | head -20
```

Expected: `{"items": [...], "total": N}` for both.

- [ ] **Step 10: Commit amtocsoft changes**

```bash
cd /Users/amtoc/amtocsoft
git add www/schema.sql www/_worker.js
git commit -m "feat: add audit_log table and GET /api/admin/referrals + /api/admin/audit endpoints"
```

---

## Task 2: amtocbot Proxy Endpoint

**Files:**
- Create: `/Users/amtoc/amtocbot-site/functions/api/proxy/amtocsoft.ts`
- Modify: `/Users/amtoc/amtocbot-site/wrangler.toml`

This endpoint:
1. Validates the caller is an authenticated admin (existing session cookie)
2. Reads the action + params from the request body
3. Forwards to `https://amtocsoft.com/api/admin/{action}` with `X-Admin-Key` added
4. Returns the response JSON as-is

- [ ] **Step 1: Create `functions/api/proxy/amtocsoft.ts`**

```typescript
/**
 * POST /api/proxy/amtocsoft
 * Proxies admin calls to amtocsoft.com, injecting X-Admin-Key server-side.
 * Requires: authenticated admin session on amtocbot.com.
 *
 * Request body:
 *   { "endpoint": "/api/admin/referrals", "method": "GET", "params": { "limit": 20, "offset": 0 } }
 *   { "endpoint": "/api/admin/referral", "method": "POST", "body": { "code": "LAUNCH10", "discount_cents": 1000 } }
 *   { "endpoint": "/api/admin/audit", "method": "GET", "params": { "limit": 20, "offset": 0 } }
 */
import { getSessionUser, jsonResponse, corsHeaders, type Env } from '../_shared/auth';

const ALLOWED_ENDPOINTS = [
  '/api/admin/referrals',
  '/api/admin/referral',
  '/api/admin/audit',
  '/api/admin/review',
] as const;

type AllowedEndpoint = (typeof ALLOWED_ENDPOINTS)[number];

interface ProxyRequestBody {
  endpoint: AllowedEndpoint;
  method?: string;
  params?: Record<string, string | number>;
  body?: Record<string, unknown>;
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: corsHeaders });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const db = env.ENGAGE_DB;

  // 1. Require authenticated admin
  const user = await getSessionUser(request, db);
  if (!user) return jsonResponse({ error: 'Authentication required' }, 401);
  if (user.role !== 'admin') return jsonResponse({ error: 'Admin access required' }, 403);

  // 2. Parse and validate body
  let body: ProxyRequestBody;
  try {
    body = await request.json() as ProxyRequestBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { endpoint, method = 'GET', params, body: forwardBody } = body;

  if (!ALLOWED_ENDPOINTS.includes(endpoint as AllowedEndpoint)) {
    return jsonResponse({ error: `Endpoint not allowed: ${endpoint}` }, 400);
  }

  // 3. Build target URL with query params
  const baseUrl = 'https://amtocsoft.com';
  const targetUrl = new URL(baseUrl + endpoint);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      targetUrl.searchParams.set(k, String(v));
    }
  }

  // 4. Forward request with admin key injected
  const adminKey = (env as unknown as { AMTOCSOFT_ADMIN_KEY: string }).AMTOCSOFT_ADMIN_KEY;
  if (!adminKey) return jsonResponse({ error: 'Proxy not configured' }, 500);

  const fetchOptions: RequestInit = {
    method,
    headers: {
      'X-Admin-Key': adminKey,
      'Content-Type': 'application/json',
    },
  };
  if (forwardBody && method !== 'GET') {
    fetchOptions.body = JSON.stringify(forwardBody);
  }

  const upstream = await fetch(targetUrl.toString(), fetchOptions);
  const data = await upstream.json();

  return jsonResponse(data, upstream.status);
};
```

- [ ] **Step 2: Add `AMTOCSOFT_ADMIN_KEY` secret comment to `wrangler.toml`**

Open `/Users/amtoc/amtocbot-site/wrangler.toml` and append:

```toml
# Secrets (set via: npx wrangler pages secret put AMTOCSOFT_ADMIN_KEY --project-name=amtocbot-site)
# AMTOCSOFT_ADMIN_KEY — forwarded as X-Admin-Key to amtocsoft.com admin endpoints
```

- [ ] **Step 3: Set the secret via wrangler CLI**

```bash
cd /Users/amtoc/amtocbot-site
echo "1eafc24e502169cccbe9e912b4a06769" | npx wrangler pages secret put AMTOCSOFT_ADMIN_KEY --project-name=amtocbot-site
```

Expected: `✨ Success! Uploaded secret AMTOCSOFT_ADMIN_KEY.`

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/amtoc/amtocbot-site
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/amtoc/amtocbot-site
git add functions/api/proxy/amtocsoft.ts wrangler.toml
git commit -m "feat: add /api/proxy/amtocsoft — admin-gated proxy to amtocsoft admin endpoints"
```

---

## Task 3: ReferralsTabComponent + Dashboard Integration

**Files:**
- Create: `src/app/features/dashboard/referrals-tab/referrals-tab.component.ts`
- Modify: `src/app/features/dashboard/dashboard.component.ts`

- [ ] **Step 1: Create `src/app/features/dashboard/referrals-tab/referrals-tab.component.ts`**

```typescript
import { Component, signal, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatRadioModule } from '@angular/material/radio';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';

interface ReferralCode {
  code: string;
  type: 'manual' | 'auto';
  creator_email: string | null;
  discount_cents: number;
  used: number;
  used_by: string | null;
  used_at: string | null;
  created_at: string;
}

interface AuditEntry {
  id: number;
  action: string;
  code: string | null;
  actor: string | null;
  result: string | null;
  detail: string | null;
  created_at: string;
}

interface ProxyResponse<T> {
  items: T[];
  total: number;
}

const PAGE_SIZE = 20;

// Action labels for display
const ACTION_LABELS: Record<string, string> = {
  code_created: 'Code Created',
  code_validated: 'Code Validated',
  code_redeemed: 'Code Redeemed',
  review_moderated: 'Review Moderated',
};

// Result badge colors
const RESULT_COLORS: Record<string, string> = {
  success: '#22c55e',
  valid: '#22c55e',
  invalid: '#ef4444',
  already_used: '#f59e0b',
};

@Component({
  selector: 'app-referrals-tab',
  standalone: true,
  imports: [
    FormsModule,
    MatCardModule, MatButtonModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatRadioModule, MatSnackBarModule, MatProgressBarModule, MatChipsModule,
  ],
  template: `
    <div class="referrals-tab">

      <!-- ── Create Code ── -->
      <mat-card class="create-card">
        <mat-card-header>
          <mat-card-title>Create Referral Code</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="create-form">
            <mat-form-field appearance="outline" class="code-input">
              <mat-label>Custom code (leave blank to auto-generate)</mat-label>
              <input matInput [(ngModel)]="newCode" placeholder="e.g. LAUNCH10" maxlength="20" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Discount</mat-label>
              <mat-select [(ngModel)]="newDiscount">
                <mat-option [value]="500">$5 off (modules)</mat-option>
                <mat-option [value]="1000">$10 off (bundle)</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" class="note-input">
              <mat-label>Note (optional)</mat-label>
              <input matInput [(ngModel)]="newNote" placeholder="Internal note" />
            </mat-form-field>
            <button mat-raised-button color="primary" (click)="createCode()" [disabled]="creating()">
              {{ creating() ? 'Creating...' : 'Create Code' }}
            </button>
          </div>
          @if (createdCode()) {
            <div class="created-result">
              <span class="created-label">Code created:</span>
              <span class="created-code" (click)="copyCode(createdCode()!)">
                {{ createdCode() }} 📋
              </span>
            </div>
          }
        </mat-card-content>
      </mat-card>

      <!-- ── Codes Table ── -->
      <mat-card class="table-card">
        <mat-card-header>
          <mat-card-title>Referral Codes</mat-card-title>
          <div class="table-filters">
            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>Status</mat-label>
              <mat-select [(ngModel)]="codesUsedFilter" (ngModelChange)="loadCodes(0)">
                <mat-option value="">All</mat-option>
                <mat-option value="0">Available</mat-option>
                <mat-option value="1">Used</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>Type</mat-label>
              <mat-select [(ngModel)]="codesTypeFilter" (ngModelChange)="loadCodes(0)">
                <mat-option value="">All</mat-option>
                <mat-option value="manual">Manual</mat-option>
                <mat-option value="auto">Auto</mat-option>
              </mat-select>
            </mat-form-field>
          </div>
        </mat-card-header>
        <mat-card-content>
          @if (codesLoading()) { <mat-progress-bar mode="indeterminate"></mat-progress-bar> }
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Code</th><th>Type</th><th>Discount</th><th>Status</th>
                  <th>Created</th><th>Used By</th><th>Used At</th>
                </tr>
              </thead>
              <tbody>
                @for (c of codes(); track c.code) {
                  <tr>
                    <td>
                      <span class="code-cell" (click)="copyCode(c.code)" title="Click to copy">
                        {{ c.code }} 📋
                      </span>
                    </td>
                    <td><span class="type-badge" [class.auto-badge]="c.type === 'auto'">{{ c.type }}</span></td>
                    <td>${{ c.discount_cents / 100 }}</td>
                    <td>
                      <span class="status-badge" [class.used-badge]="c.used === 1">
                        {{ c.used === 1 ? 'Used' : 'Available' }}
                      </span>
                    </td>
                    <td>{{ formatDate(c.created_at) }}</td>
                    <td>{{ c.used_by || '—' }}</td>
                    <td>{{ c.used_at ? formatDate(c.used_at) : '—' }}</td>
                  </tr>
                }
                @if (codes().length === 0 && !codesLoading()) {
                  <tr><td colspan="7" class="empty-cell">No codes found.</td></tr>
                }
              </tbody>
            </table>
          </div>
          <div class="pagination">
            <button mat-button (click)="loadCodes(codesOffset() - PAGE_SIZE)" [disabled]="codesOffset() === 0">← Prev</button>
            <span class="page-info">{{ codesOffset() + 1 }}–{{ Math.min(codesOffset() + PAGE_SIZE, codesTotal()) }} of {{ codesTotal() }}</span>
            <button mat-button (click)="loadCodes(codesOffset() + PAGE_SIZE)" [disabled]="codesOffset() + PAGE_SIZE >= codesTotal()">Next →</button>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- ── Audit Log ── -->
      <mat-card class="table-card">
        <mat-card-header>
          <mat-card-title>Audit Log</mat-card-title>
          <div class="table-filters">
            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>Action</mat-label>
              <mat-select [(ngModel)]="auditActionFilter" (ngModelChange)="loadAudit(0)">
                <mat-option value="">All</mat-option>
                <mat-option value="code_created">Code Created</mat-option>
                <mat-option value="code_validated">Code Validated</mat-option>
                <mat-option value="code_redeemed">Code Redeemed</mat-option>
                <mat-option value="review_moderated">Review Moderated</mat-option>
              </mat-select>
            </mat-form-field>
          </div>
        </mat-card-header>
        <mat-card-content>
          @if (auditLoading()) { <mat-progress-bar mode="indeterminate"></mat-progress-bar> }
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr><th>Timestamp</th><th>Action</th><th>Code</th><th>Actor</th><th>Result</th></tr>
              </thead>
              <tbody>
                @for (e of audit(); track e.id) {
                  <tr>
                    <td class="mono">{{ formatDate(e.created_at) }}</td>
                    <td>{{ actionLabel(e.action) }}</td>
                    <td>
                      @if (e.code) {
                        <span class="code-cell" (click)="copyCode(e.code)" title="Click to copy">{{ e.code }} 📋</span>
                      } @else { <span class="muted">—</span> }
                    </td>
                    <td class="mono muted">{{ e.actor || '—' }}</td>
                    <td>
                      @if (e.result) {
                        <span class="result-badge" [style.background]="resultColor(e.result)">{{ e.result }}</span>
                      } @else { <span class="muted">—</span> }
                    </td>
                  </tr>
                }
                @if (audit().length === 0 && !auditLoading()) {
                  <tr><td colspan="5" class="empty-cell">No audit entries found.</td></tr>
                }
              </tbody>
            </table>
          </div>
          <div class="pagination">
            <button mat-button (click)="loadAudit(auditOffset() - PAGE_SIZE)" [disabled]="auditOffset() === 0">← Prev</button>
            <span class="page-info">{{ auditOffset() + 1 }}–{{ Math.min(auditOffset() + PAGE_SIZE, auditTotal()) }} of {{ auditTotal() }}</span>
            <button mat-button (click)="loadAudit(auditOffset() + PAGE_SIZE)" [disabled]="auditOffset() + PAGE_SIZE >= auditTotal()">Next →</button>
          </div>
        </mat-card-content>
      </mat-card>

    </div>
  `,
  styles: [`
    .referrals-tab { display: flex; flex-direction: column; gap: 1.5rem; padding: 1.5rem 0; }

    .create-card mat-card-title { font-size: 1rem; }
    .create-form { display: flex; gap: 1rem; flex-wrap: wrap; align-items: flex-start; padding-top: 0.75rem; }
    .code-input { flex: 1; min-width: 180px; }
    .note-input { flex: 2; min-width: 200px; }
    .created-result { display: flex; align-items: center; gap: 0.75rem; margin-top: 0.5rem; padding: 0.75rem 1rem; background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); border-radius: 8px; }
    .created-label { font-size: 0.85rem; color: #64748b; }
    .created-code { font-family: monospace; font-size: 1rem; font-weight: 700; cursor: pointer; color: #22c55e; }
    .created-code:hover { text-decoration: underline; }

    .table-card mat-card-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem; }
    .table-card mat-card-title { font-size: 1rem; }
    .table-filters { display: flex; gap: 0.75rem; flex-wrap: wrap; }
    .filter-field { min-width: 130px; }

    .table-wrap { overflow-x: auto; margin-top: 0.75rem; }
    .data-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    .data-table th {
      text-align: left;
      padding: 0.6rem 0.75rem;
      border-bottom: 2px solid var(--border-color, #e2e8f0);
      color: var(--text-secondary, #64748b);
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      white-space: nowrap;
    }
    .data-table td {
      padding: 0.6rem 0.75rem;
      border-bottom: 1px solid var(--border-color, #e2e8f0);
      color: var(--text-primary, #1e293b);
    }
    .data-table tr:hover td { background: var(--bg-surface-hover, #f8fafc); }
    .empty-cell { text-align: center; color: var(--text-secondary, #64748b); padding: 2rem; }

    .code-cell { font-family: monospace; cursor: pointer; font-size: 0.82rem; }
    .code-cell:hover { text-decoration: underline; }
    .mono { font-family: monospace; font-size: 0.8rem; }
    .muted { color: var(--text-secondary, #64748b); }

    .type-badge, .status-badge, .result-badge {
      display: inline-block;
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      font-size: 0.72rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    .type-badge { background: rgba(99,102,241,0.15); color: #6366f1; }
    .auto-badge { background: rgba(249,115,22,0.15); color: #f97316; }
    .status-badge { background: rgba(34,197,94,0.15); color: #22c55e; }
    .used-badge { background: rgba(239,68,68,0.12); color: #ef4444; }
    .result-badge { color: #fff; }

    .pagination {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      margin-top: 1rem;
    }
    .page-info { font-size: 0.85rem; color: var(--text-secondary, #64748b); }
  `],
})
export class ReferralsTabComponent implements OnInit {
  private snack = inject(MatSnackBar);

  PAGE_SIZE = PAGE_SIZE;
  Math = Math;

  // Create form
  newCode = '';
  newDiscount = 500;
  newNote = '';
  creating = signal(false);
  createdCode = signal<string | null>(null);

  // Codes table
  codes = signal<ReferralCode[]>([]);
  codesTotal = signal(0);
  codesOffset = signal(0);
  codesLoading = signal(false);
  codesUsedFilter = '';
  codesTypeFilter = '';

  // Audit table
  audit = signal<AuditEntry[]>([]);
  auditTotal = signal(0);
  auditOffset = signal(0);
  auditLoading = signal(false);
  auditActionFilter = '';

  ngOnInit(): void {
    this.loadCodes(0);
    this.loadAudit(0);
  }

  private async proxy(endpoint: string, method = 'GET', params?: Record<string, string | number>, body?: Record<string, unknown>): Promise<unknown> {
    const r = await fetch('/api/proxy/amtocsoft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint, method, params, body }),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
      throw new Error(err.error ?? `HTTP ${r.status}`);
    }
    return r.json();
  }

  async createCode(): Promise<void> {
    this.creating.set(true);
    this.createdCode.set(null);
    try {
      const b: Record<string, unknown> = { discount_cents: this.newDiscount };
      if (this.newCode.trim()) b['code'] = this.newCode.trim().toUpperCase();
      if (this.newNote.trim()) b['note'] = this.newNote.trim();
      const res = await this.proxy('/api/admin/referral', 'POST', undefined, b) as { code?: string; error?: string };
      if (res.code) {
        this.createdCode.set(res.code);
        this.newCode = '';
        this.newNote = '';
        this.loadCodes(0);
        this.loadAudit(0);
        this.snack.open('Code created!', 'Dismiss', { duration: 3000 });
      } else {
        this.snack.open(res.error ?? 'Failed to create code', 'Dismiss', { duration: 4000 });
      }
    } catch (e: unknown) {
      this.snack.open((e as Error).message, 'Dismiss', { duration: 4000 });
    } finally {
      this.creating.set(false);
    }
  }

  async loadCodes(offset: number): Promise<void> {
    if (offset < 0) return;
    this.codesLoading.set(true);
    this.codesOffset.set(offset);
    try {
      const params: Record<string, string | number> = { limit: PAGE_SIZE, offset };
      if (this.codesUsedFilter !== '') params['used'] = this.codesUsedFilter;
      if (this.codesTypeFilter) params['type'] = this.codesTypeFilter;
      const res = await this.proxy('/api/admin/referrals', 'GET', params) as ProxyResponse<ReferralCode>;
      this.codes.set(res.items ?? []);
      this.codesTotal.set(res.total ?? 0);
    } catch (e: unknown) {
      this.snack.open((e as Error).message, 'Dismiss', { duration: 4000 });
    } finally {
      this.codesLoading.set(false);
    }
  }

  async loadAudit(offset: number): Promise<void> {
    if (offset < 0) return;
    this.auditLoading.set(true);
    this.auditOffset.set(offset);
    try {
      const params: Record<string, string | number> = { limit: PAGE_SIZE, offset };
      if (this.auditActionFilter) params['action'] = this.auditActionFilter;
      const res = await this.proxy('/api/admin/audit', 'GET', params) as ProxyResponse<AuditEntry>;
      this.audit.set(res.items ?? []);
      this.auditTotal.set(res.total ?? 0);
    } catch (e: unknown) {
      this.snack.open((e as Error).message, 'Dismiss', { duration: 4000 });
    } finally {
      this.auditLoading.set(false);
    }
  }

  async copyCode(code: string): Promise<void> {
    await navigator.clipboard.writeText(code).catch(() => {});
    this.snack.open(`Copied: ${code}`, 'Dismiss', { duration: 2000 });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  actionLabel(action: string): string { return ACTION_LABELS[action] ?? action; }
  resultColor(result: string): string { return RESULT_COLORS[result] ?? '#6b7280'; }
}
```

- [ ] **Step 2: Add the Referrals tab to `dashboard.component.ts`**

Open `/Users/amtoc/amtocbot-site/src/app/features/dashboard/dashboard.component.ts`.

Add to the imports array at the top of the file:
```typescript
import { ReferralsTabComponent } from './referrals-tab/referrals-tab.component';
```

Add `ReferralsTabComponent` to the component's `imports` array inside `@Component({ imports: [..., ReferralsTabComponent] })`.

Locate the `<mat-tab-group>` in the template. After the last existing `</mat-tab>` closing tag and before `</mat-tab-group>`, add:

```html
<!-- Referrals Tab — admin only -->
@if (auth.role() === 'admin') {
  <mat-tab label="Referrals">
    <div class="tab-content">
      <app-referrals-tab />
    </div>
  </mat-tab>
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/amtoc/amtocbot-site
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Full build**

```bash
cd /Users/amtoc/amtocbot-site
npm run build 2>&1 | tail -10
```

Expected: `Application bundle generation complete.`

- [ ] **Step 5: Deploy to Cloudflare Pages**

```bash
cd /Users/amtoc/amtocbot-site
npm run build && npx wrangler pages deploy dist/amtocbot-site/browser --project-name=amtocbot-site 2>&1 | tail -5
```

Expected: `Deployment complete!`

- [ ] **Step 6: Commit**

```bash
cd /Users/amtoc/amtocbot-site
git add src/app/features/dashboard/referrals-tab/referrals-tab.component.ts \
        src/app/features/dashboard/dashboard.component.ts
git commit -m "feat: add Referrals tab to dashboard with code creation, codes table, and audit log"
```

---

## Verification

After all tasks:

- [ ] `GET https://amtocsoft.com/api/admin/referrals` returns `{"items": [...], "total": N}` with admin key
- [ ] `GET https://amtocsoft.com/api/admin/audit` returns `{"items": [], "total": 0}` initially
- [ ] Validate a referral code → audit entry `code_validated` appears
- [ ] Login to amtocbot.com as admin → Dashboard → "Referrals" tab visible
- [ ] Create a code in the tab → code appears in the codes table, audit entry appears
- [ ] Click a code in the table → copies to clipboard
- [ ] Login as non-admin → "Referrals" tab not visible
- [ ] `POST /api/proxy/amtocsoft` without session → 401
- [ ] `POST /api/proxy/amtocsoft` with tester session → 403
