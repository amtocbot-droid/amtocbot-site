# Multi-Role Dashboard: Admin + Superadmin Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `superadmin` role and unlock all dashboard features for admin and superadmin users.

**Architecture:** Extend the permission map in auth.ts, add DB migration for the new role, fill API gaps, then wire up Angular UI permission checks.

**Tech Stack:** Angular 21, Cloudflare Pages Functions, D1 (SQLite), TypeScript

---

## Overview of Changes

The existing permission model short-circuits `admin` with `if (user.role === 'admin') return true`. Adding `superadmin` requires threading that same bypass through every hard-coded `user.role !== 'admin'` guard (found in 10+ files), adding 4 new superadmin-only permissions, creating a DB migration, adding an audit log API endpoint, and updating the Angular frontend to show superadmin-specific UI (audit log tab, ability to edit admin roles).

**Superadmin vs Admin — what's different:**

| Capability | admin | superadmin |
|---|---|---|
| All dashboard features | ✅ | ✅ |
| Manage tester/approver/reviewer users | ✅ | ✅ |
| Change admin roles | ❌ | ✅ |
| Invite as superadmin | ❌ | ✅ |
| View audit logs (all users) | ❌ | ✅ |
| View active sessions | ❌ | ✅ |
| Permanently delete content | ❌ | ✅ |
| Manage site_config | ✅ | ✅ |
| Pause/resume automation | ✅ | ✅ |

---

## Part 1 — Backend: Permission System

### Task 1 — Extend `Role`, `VALID_ROLES`, and `ROLE_PERMISSIONS` in auth.ts

**File:** `functions/api/_shared/auth.ts`

- [ ] Replace the top section of the file (the Role type, VALID_ROLES, ROLE_PERMISSIONS, hasPermission, requirePermission):

```typescript
export type Role = 'superadmin' | 'admin' | 'tester' | 'approver' | 'reviewer';
export const VALID_ROLES: readonly string[] = [
  'superadmin', 'admin', 'tester', 'approver', 'reviewer',
] as const;

export type Permission =
  | 'dashboard.view'
  | 'issues.create' | 'issues.update_status' | 'issues.assign' | 'issues.close' | 'issues.comment'
  | 'content.qa.update' | 'content.qa.approve' | 'content.qa.reject'
  | 'users.manage'
  | 'users.manage_admins'
  | 'content.delete'
  | 'audit.view'
  | 'sessions.view';

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  superadmin: [], // superadmin bypasses the map — gets all permissions
  admin:    [],   // admin bypasses the map — gets all permissions except superadmin-only
  tester:   ['dashboard.view', 'issues.create', 'issues.update_status', 'issues.comment', 'content.qa.update'],
  approver: ['dashboard.view', 'issues.close', 'issues.comment', 'content.qa.approve', 'content.qa.reject'],
  reviewer: ['dashboard.view', 'issues.comment'],
};

export function hasPermission(user: SessionUser, perm: Permission): boolean {
  if (user.role === 'superadmin') return true;
  if (user.role === 'admin') {
    // These permissions are superadmin-only — explicitly deny for admin
    const superadminOnly: Permission[] = ['users.manage_admins', 'audit.view', 'sessions.view'];
    if (superadminOnly.includes(perm)) return false;
    return true;
  }
  const perms = ROLE_PERMISSIONS[user.role as Role];
  return perms ? perms.includes(perm) : false;
}

export function requirePermission(user: SessionUser | null, perm: Permission): Response | null {
  if (!user) return jsonResponse({ error: 'Authentication required' }, 401);
  if (!hasPermission(user, perm)) return jsonResponse({ error: 'Insufficient permissions' }, 403);
  return null;
}
```

- [ ] Run `npx tsc --noEmit` — expect 0 new errors from this change alone.

---

### Task 2 — Fix all hard-coded `role !== 'admin'` guards across admin endpoints

Replace every instance of:
```typescript
if (!user || user.role !== 'admin') {
  return jsonResponse({ error: 'Admin access required' }, 403);
}
```
With:
```typescript
if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
  return jsonResponse({ error: 'Admin access required' }, 403);
}
```

And every `user.role === 'admin'` allow-check with:
```typescript
user.role === 'admin' || user.role === 'superadmin'
```

- [ ] `functions/api/admin/cms.ts` — replace raw role check in both `onRequestGet` and `onRequestPost` with `requirePermission(user, 'users.manage')` (see Task 11 for the cleaner version)
- [ ] `functions/api/admin/automation/status.ts` — fix role check
- [ ] `functions/api/admin/automation/pause.ts` — fix role check
- [ ] `functions/api/admin/automation/resume.ts` — fix role check
- [ ] `functions/api/admin/automation/trigger.ts` — fix role check
- [ ] `functions/api/admin/calendar/_shared.ts` — fix role check
- [ ] `functions/api/admin/calendar/proposals.ts` — fix role check
- [ ] `functions/api/admin/calendar/items/[id].ts` — fix role check
- [ ] `functions/api/admin/calendar/proposals/[id].ts` — fix role check
- [ ] `functions/api/admin/calendar/proposals/[id]/regenerate.ts` — fix role check
- [ ] `functions/api/admin/calendar/proposals/[id]/approve.ts` — fix role check
- [ ] `functions/api/admin/content/index.ts` — fix role check
- [ ] `functions/api/admin/content/import.ts` — fix role portion of the check
- [ ] `functions/api/proxy/amtocsoft.ts` — fix role check

- [ ] Run: `grep -rn "role !== 'admin'" functions/api/` — should return 0 results after this task.

---

### Task 3 — Fix `stats.ts` totalUsers branch

**File:** `functions/api/dashboard/stats.ts`

- [ ] Find: `if (user.role === 'admin')`
- [ ] Replace with:
```typescript
if (user.role === 'admin' || user.role === 'superadmin') {
```

---

### Task 4 — Fix `auth/invite.ts` for superadmin

**File:** `functions/api/auth/invite.ts`

- [ ] Replace the caller role check:
```typescript
if (!caller || (caller.role !== 'admin' && caller.role !== 'superadmin')) {
  return jsonResponse({ error: 'Admin access required' }, 403);
}
```

- [ ] Add role assignment guard after the role check (prevent admin from creating superadmin):
```typescript
// Only superadmin can assign the superadmin role
const allowedInviteRoles = VALID_ROLES.filter(r =>
  r !== 'superadmin' || caller.role === 'superadmin'
);
const role = body.role && allowedInviteRoles.includes(body.role) ? body.role : 'member';
```

---

### Task 5 — Fix `dashboard/users/[id].ts` role-change guard

**File:** `functions/api/dashboard/users/[id].ts`

- [ ] Replace validation block with:
```typescript
const body = await request.json() as { role?: string };

const isCallerSuperadmin = user.role === 'superadmin';
const assignableRoles = isCallerSuperadmin
  ? [...VALID_ROLES, 'member']
  : [...VALID_ROLES.filter(r => r !== 'superadmin'), 'member'];

if (!body.role || !assignableRoles.includes(body.role)) {
  return jsonResponse(
    { error: `Invalid role. Must be one of: ${assignableRoles.join(', ')}` },
    400,
  );
}

// Fetch target user
const target = await db.prepare(
  'SELECT id, username, role FROM users WHERE id = ?'
).bind(userId).first<{ id: number; username: string; role: string }>();
if (!target) return jsonResponse({ error: 'User not found' }, 404);

// Only superadmin can change a superadmin's role
if (target.role === 'superadmin' && user.role !== 'superadmin') {
  return jsonResponse({ error: 'Only superadmin can modify another superadmin\'s role' }, 403);
}

// Prevent self-demotion
if (userId === user.user_id && body.role !== user.role) {
  return jsonResponse({ error: 'Cannot change your own role' }, 400);
}
```

- [ ] Remove any duplicate `target` lookup later in the function.

---

### Task 6 — Fix `content/[id]/index.ts` reviewer_instructions guard

**File:** `functions/api/dashboard/content/[id]/index.ts`

- [ ] Find: `user.role === 'admin'` in the reviewer_instructions block
- [ ] Replace with: `(user.role === 'admin' || user.role === 'superadmin')`

---

### Task 7 — Add audit log API endpoint (superadmin only)

**New file:** `functions/api/admin/audit/index.ts`

- [ ] Create the file:

```typescript
// GET /api/admin/audit — Full audit log viewer (superadmin only)
import { Env, getSessionUser, requirePermission, jsonResponse, optionsHandler } from '../../_shared/auth';

export const onRequestOptions = optionsHandler;

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const db = env.ENGAGE_DB;

  const user = await getSessionUser(request, db);
  const denied = requirePermission(user, 'audit.view');
  if (denied) return denied;

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 500);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);
  const username = url.searchParams.get('username');
  const action = url.searchParams.get('action');

  let sql = `SELECT id, user_id, username, action, detail, ip_address, created_at
             FROM audit_logs WHERE 1=1`;
  const binds: unknown[] = [];

  if (username) { sql += ' AND username = ?'; binds.push(username); }
  if (action)   { sql += ' AND action LIKE ?'; binds.push(`%${action}%`); }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  binds.push(limit, offset);

  const { results } = await db.prepare(sql).bind(...binds).all();
  const countRow = await db.prepare('SELECT COUNT(*) as total FROM audit_logs')
    .first<{ total: number }>();

  return jsonResponse({
    items: results || [],
    meta: { limit, offset, total: countRow?.total || 0 },
  });
};
```

---

### Task 8 — Add sessions viewer API endpoint (superadmin only)

**New file:** `functions/api/admin/sessions/index.ts`

- [ ] Create the file:

```typescript
// GET /api/admin/sessions — Active session viewer (superadmin only)
import { Env, getSessionUser, requirePermission, jsonResponse, optionsHandler } from '../../_shared/auth';

export const onRequestOptions = optionsHandler;

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const db = env.ENGAGE_DB;

  const user = await getSessionUser(request, db);
  const denied = requirePermission(user, 'sessions.view');
  if (denied) return denied;

  const { results } = await db.prepare(`
    SELECT s.id, s.user_id, u.username, u.role, s.verified,
           s.created_at, s.expires_at
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.verified = 1 AND s.expires_at > datetime('now')
    ORDER BY s.created_at DESC
    LIMIT 200
  `).all();

  return jsonResponse({ sessions: results || [] });
};
```

---

### Task 9 — Add permanent delete to `content/[id]/index.ts` (superadmin only)

**File:** `functions/api/dashboard/content/[id]/index.ts`

- [ ] Add `onRequestDelete` export at the bottom of the file:

```typescript
export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  const db = env.ENGAGE_DB;
  const user = await getSessionUser(request, db);
  const denied = requirePermission(user, 'content.delete');
  if (denied) return denied;

  const id = params['id'] as string;
  if (!id) return jsonResponse({ error: 'Content ID required' }, 400);

  const existing = await db.prepare('SELECT id, title FROM content WHERE id = ?')
    .bind(id).first<{ id: string; title: string }>();
  if (!existing) return jsonResponse({ error: 'Content not found' }, 404);

  await db.prepare('DELETE FROM content WHERE id = ?').bind(id).run();

  await logAudit(db, user!, 'content.deleted_permanently',
    JSON.stringify({ id, title: existing.title }), request);

  return jsonResponse({ success: true, id });
};
```

- [ ] Ensure `logAudit` is in the imports at the top of the file.

---

### Task 10 — DB migration 007

**New file:** `migrations/007-superadmin-role.sql`

- [ ] Create the file:

```sql
-- Migration 007: superadmin role
-- Apply: npx wrangler d1 execute engage-db --file=migrations/007-superadmin-role.sql --remote

-- SQLite TEXT columns have no enum constraints — no DDL change needed.
-- This migration documents the new role value and records the schema version.

-- To promote an existing admin to superadmin (run once, adjust username):
-- UPDATE users SET role = 'superadmin' WHERE username = 'amtoc';

INSERT OR IGNORE INTO schema_version (version, description)
VALUES (7, 'superadmin role: extended permission system, audit log API, sessions viewer API, permanent delete API');
```

- [ ] Apply migration:
```bash
npx wrangler d1 execute engage-db --file=migrations/007-superadmin-role.sql --remote
```

- [ ] Promote bootstrap account:
```bash
npx wrangler d1 execute engage-db --remote \
  --command="UPDATE users SET role = 'superadmin' WHERE username = 'amtoc'"
```

- [ ] Verify:
```bash
npx wrangler d1 execute engage-db --remote \
  --command="SELECT username, role FROM users ORDER BY created_at LIMIT 10"
```

---

### Task 11 — Refactor `cms.ts` to use `requirePermission` (cleaner approach)

**File:** `functions/api/admin/cms.ts`

- [ ] Add `requirePermission` to the import line
- [ ] Replace both raw role checks with:
```typescript
const user = await getSessionUser(request, db);
const denied = requirePermission(user, 'users.manage');
if (denied) return denied;
```

---

## Part 2 — Angular Frontend

### Task 12 — Update `auth.service.ts` to add `superadmin` role

**File:** `src/app/shared/services/auth.service.ts`

- [ ] Add `'superadmin'` to the `Role` type:
```typescript
export type Role = 'superadmin' | 'admin' | 'tester' | 'approver' | 'reviewer';
```

- [ ] Add new permissions to the `Permission` type:
```typescript
export type Permission =
  | 'dashboard.view'
  | 'issues.create' | 'issues.update_status' | 'issues.assign' | 'issues.close' | 'issues.comment'
  | 'content.qa.update' | 'content.qa.approve' | 'content.qa.reject'
  | 'users.manage'
  | 'users.manage_admins'
  | 'content.delete'
  | 'audit.view'
  | 'sessions.view';
```

- [ ] Update `ROLE_PERMISSIONS` to include `superadmin: []`

- [ ] Replace `hasPermission` method:
```typescript
hasPermission(perm: Permission): boolean {
  const r = this.role();
  if (!r) return false;
  if (r === 'superadmin') return true;
  if (r === 'admin') {
    const superadminOnly: Permission[] = ['users.manage_admins', 'audit.view', 'sessions.view'];
    if (superadminOnly.includes(perm)) return false;
    return true;
  }
  const perms = ROLE_PERMISSIONS[r];
  return perms ? perms.includes(perm) : false;
}
```

---

### Task 13 — Fix all `hasRole('admin')` and `role() === 'admin'` checks in `dashboard.component.ts`

**File:** `src/app/features/dashboard/dashboard.component.ts`

Run this to find all occurrences:
```bash
grep -n "hasRole('admin')\|role() === 'admin'" src/app/features/dashboard/dashboard.component.ts
```

- [ ] Replace every `auth.hasRole('admin')` with `auth.hasRole('admin', 'superadmin')`
- [ ] Replace every `auth.role() === 'admin'` with `(auth.role() === 'admin' || auth.role() === 'superadmin')`

Key locations:
- totalUsers stat card visibility
- Publish button in content detail
- Publish button in content list table
- Users tab visibility
- Referrals tab visibility
- Admin Controls tab visibility
- `onTabChange` method
- `loadUsers()` guard

---

### Task 14 — Add Audit Log tab to dashboard (superadmin only)

**File:** `src/app/features/dashboard/dashboard.component.ts`

- [ ] Add import at top:
```typescript
import { AuditLogTabComponent } from './audit-log-tab/audit-log-tab.component';
```

- [ ] Add `AuditLogTabComponent` to the `imports: [...]` array in the `@Component` decorator

- [ ] After the Admin Controls `</mat-tab>` closing tag, add:
```html
@if (auth.hasPermission('audit.view')) {
  <mat-tab label="Audit Log">
    <div class="tab-content">
      <app-audit-log-tab />
    </div>
  </mat-tab>
}
```

---

### Task 15 — Create `AuditLogTabComponent`

**New file:** `src/app/features/dashboard/audit-log-tab/audit-log-tab.component.ts`

- [ ] Create the file:

```typescript
import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { HttpClient, HttpParams } from '@angular/common/http';

interface AuditEntry {
  id: number;
  user_id: number;
  username: string;
  action: string;
  detail: string | null;
  ip_address: string;
  created_at: string;
}

@Component({
  selector: 'app-audit-log-tab',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatButtonModule, MatIconModule, MatTableModule,
    MatFormFieldModule, MatInputModule, MatSnackBarModule,
  ],
  template: `
    <div class="audit-container">
      <div class="filters-row">
        <mat-form-field appearance="outline">
          <mat-label>Filter by username</mat-label>
          <input matInput [(ngModel)]="usernameFilter" (ngModelChange)="load()" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Filter by action</mat-label>
          <input matInput [(ngModel)]="actionFilter" (ngModelChange)="load()" />
        </mat-form-field>
        <button mat-icon-button (click)="load()" title="Refresh">
          <mat-icon>refresh</mat-icon>
        </button>
      </div>

      @if (loading()) {
        <div class="loading-text">Loading audit log...</div>
      }

      <table mat-table [dataSource]="entries()" class="full-width-table">
        <ng-container matColumnDef="created_at">
          <th mat-header-cell *matHeaderCellDef>Time</th>
          <td mat-cell *matCellDef="let e" class="mono-sm">{{ e.created_at | date:'short' }}</td>
        </ng-container>
        <ng-container matColumnDef="username">
          <th mat-header-cell *matHeaderCellDef>User</th>
          <td mat-cell *matCellDef="let e">{{ e.username }}</td>
        </ng-container>
        <ng-container matColumnDef="action">
          <th mat-header-cell *matHeaderCellDef>Action</th>
          <td mat-cell *matCellDef="let e" class="mono-sm">{{ e.action }}</td>
        </ng-container>
        <ng-container matColumnDef="detail">
          <th mat-header-cell *matHeaderCellDef>Detail</th>
          <td mat-cell *matCellDef="let e" class="detail-cell">{{ e.detail }}</td>
        </ng-container>
        <ng-container matColumnDef="ip_address">
          <th mat-header-cell *matHeaderCellDef>IP</th>
          <td mat-cell *matCellDef="let e" class="mono-sm">{{ e.ip_address }}</td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="cols"></tr>
        <tr mat-row *matRowDef="let row; columns: cols;"></tr>
      </table>

      <div class="pagination-row">
        <span class="total-label">{{ total() }} total entries</span>
        <button mat-stroked-button [disabled]="offset() === 0" (click)="prevPage()">
          <mat-icon>chevron_left</mat-icon> Prev
        </button>
        <button mat-stroked-button [disabled]="offset() + limit() >= total()" (click)="nextPage()">
          Next <mat-icon>chevron_right</mat-icon>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .audit-container { padding: 16px 0; }
    .filters-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 8px; }
    .filters-row mat-form-field { width: 200px; }
    .full-width-table { width: 100%; }
    .mono-sm { font-family: monospace; font-size: 12px; }
    .detail-cell { max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; color: #94a3b8; }
    .pagination-row { display: flex; align-items: center; gap: 12px; margin-top: 12px; }
    .total-label { flex: 1; color: #64748b; font-size: 13px; }
    .loading-text { color: #94a3b8; padding: 16px 0; }
  `],
})
export class AuditLogTabComponent implements OnInit {
  private http = inject(HttpClient);
  private snack = inject(MatSnackBar);

  entries = signal<AuditEntry[]>([]);
  loading = signal(false);
  total = signal(0);
  offset = signal(0);
  limit = signal(100);
  cols = ['created_at', 'username', 'action', 'detail', 'ip_address'];

  usernameFilter = '';
  actionFilter = '';

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    let params = new HttpParams()
      .set('limit', this.limit().toString())
      .set('offset', this.offset().toString());
    if (this.usernameFilter) params = params.set('username', this.usernameFilter);
    if (this.actionFilter)   params = params.set('action', this.actionFilter);

    this.http.get<{ items: AuditEntry[]; meta: { total: number } }>(
      '/api/admin/audit', { params }
    ).subscribe({
      next: r => {
        this.entries.set(r.items);
        this.total.set(r.meta.total);
        this.loading.set(false);
      },
      error: () => {
        this.snack.open('Failed to load audit log', 'Dismiss', { duration: 3000 });
        this.loading.set(false);
      },
    });
  }

  prevPage() { this.offset.update(o => Math.max(0, o - this.limit())); this.load(); }
  nextPage() { this.offset.update(o => o + this.limit()); this.load(); }
}
```

---

### Task 16 — Update Users tab role selects (superadmin can edit admin roles)

**File:** `src/app/features/dashboard/dashboard.component.ts`

- [ ] Replace the role column `<mat-select>` in the users table:

```html
<ng-container matColumnDef="role">
  <th mat-header-cell *matHeaderCellDef>Role</th>
  <td mat-cell *matCellDef="let u">
    <mat-select
      [value]="u.role"
      [disabled]="u.role === 'superadmin' && !auth.hasPermission('users.manage_admins')"
      (selectionChange)="changeUserRole(u.id, $event.value)"
      class="inline-select">
      @if (auth.hasPermission('users.manage_admins')) {
        <mat-option value="superadmin">superadmin</mat-option>
        <mat-option value="admin">admin</mat-option>
      }
      <mat-option value="tester">tester</mat-option>
      <mat-option value="approver">approver</mat-option>
      <mat-option value="reviewer">reviewer</mat-option>
      <mat-option value="member">member</mat-option>
    </mat-select>
  </td>
</ng-container>
```

- [ ] Replace the Invite User form role `<mat-select>`:

```html
<mat-form-field>
  <mat-label>Role</mat-label>
  <mat-select [(ngModel)]="inviteForm.role">
    @if (auth.hasPermission('users.manage_admins')) {
      <mat-option value="superadmin">superadmin</mat-option>
      <mat-option value="admin">admin</mat-option>
    }
    <mat-option value="tester">tester</mat-option>
    <mat-option value="approver">approver</mat-option>
    <mat-option value="reviewer">reviewer</mat-option>
    <mat-option value="member">member</mat-option>
  </mat-select>
</mat-form-field>
```

---

### Task 17 — Add deleteContent to `dashboard.service.ts` + add delete button to UI

**File:** `src/app/features/dashboard/dashboard.service.ts`

- [ ] Add method after `updateContent`:
```typescript
deleteContent(id: string): Observable<{ success: boolean; id: string }> {
  return this.http.delete<{ success: boolean; id: string }>(`/api/dashboard/content/${id}`);
}
```

**File:** `src/app/features/dashboard/dashboard.component.ts`

- [ ] Add "Delete Permanently" button in content detail QA Actions section:
```html
@if (auth.hasPermission('content.delete')) {
  <button mat-stroked-button color="warn" (click)="deleteContentPermanently(selectedContent()!.id)">
    <mat-icon>delete_forever</mat-icon> Delete Permanently
  </button>
}
```

- [ ] Add handler method:
```typescript
deleteContentPermanently(id: string) {
  if (!confirm('Permanently delete this content? This cannot be undone.')) return;
  this.svc.deleteContent(id).subscribe({
    next: () => {
      this.toast('Content permanently deleted');
      this.selectedContent.set(null);
      this.contentFeedback.set([]);
      this.loadContent();
    },
    error: (e) => this.toast(e.error?.error || 'Failed to delete content'),
  });
}
```

---

### Task 18 — Update route config to accept `superadmin`

**File:** `src/app/app.routes.ts`

- [ ] Find the `/dashboard` and `/report` route definitions with `data: { roles: [...] }`
- [ ] Add `'superadmin'` to each roles array:
```typescript
{ path: 'dashboard', ..., data: { roles: ['superadmin', 'admin', 'tester', 'approver', 'reviewer'] } }
{ path: 'report',    ..., data: { roles: ['superadmin', 'admin', 'tester'] } }
```

---

### Task 19 — TypeScript check

- [ ] Run `npx tsc --noEmit` from `/Users/amtoc/amtocbot-site/`
- [ ] Expected: 0 errors
- [ ] Common issues: any switch on `Role` needs `'superadmin'` case; `ROLE_PERMISSIONS` must have `superadmin` key

---

### Task 20 — Build and deploy

- [ ] Build:
```bash
npx ng build && cp dist/amtocbot-site/browser/index.csr.html dist/amtocbot-site/browser/index.html
```

- [ ] Deploy:
```bash
npx wrangler pages deploy dist/amtocbot-site/browser --project-name=amtocbot-site
```

- [ ] Sync KV:
```bash
curl -s -X POST https://amtocbot.com/api/admin/sync-content
```

---

## Summary of All Changes

| # | File | Action |
|---|------|--------|
| 1 | `functions/api/_shared/auth.ts` | Add `superadmin` to Role, VALID_ROLES, ROLE_PERMISSIONS; fix hasPermission |
| 2 | 14 admin/proxy endpoint files | Replace raw `role !== 'admin'` with dual-role check |
| 3 | `functions/api/dashboard/stats.ts` | Add superadmin to totalUsers branch |
| 4 | `functions/api/auth/invite.ts` | Allow superadmin to invite; block admin from assigning superadmin |
| 5 | `functions/api/dashboard/users/[id].ts` | Superadmin can edit admin roles; protect superadmin rows |
| 6 | `functions/api/dashboard/content/[id]/index.ts` | Fix reviewer_instructions guard + add DELETE handler |
| 7 | NEW `functions/api/admin/audit/index.ts` | Audit log viewer endpoint (superadmin only) |
| 8 | NEW `functions/api/admin/sessions/index.ts` | Active sessions viewer (superadmin only) |
| 9 | NEW `migrations/007-superadmin-role.sql` | Document role, apply to D1 |
| 10 | `functions/api/admin/cms.ts` | Refactor to requirePermission |
| 11 | `src/app/shared/services/auth.service.ts` | Add superadmin to Role, Permission, hasPermission |
| 12 | `src/app/features/dashboard/dashboard.component.ts` | Fix 8+ hasRole checks; add Audit tab; delete button; update role selects |
| 13 | NEW `src/app/features/dashboard/audit-log-tab/audit-log-tab.component.ts` | Audit log viewer component |
| 14 | `src/app/features/dashboard/dashboard.service.ts` | Add deleteContent() |
| 15 | `src/app/app.routes.ts` | Add superadmin to route role arrays |

---

*Plan created: 2026-04-13*
