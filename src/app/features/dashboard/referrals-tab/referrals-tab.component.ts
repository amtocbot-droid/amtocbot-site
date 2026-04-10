import { Component, signal, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';

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

const ACTION_LABELS: Record<string, string> = {
  code_created: 'Code Created',
  code_validated: 'Code Validated',
  code_redeemed: 'Code Redeemed',
  review_moderated: 'Review Moderated',
};

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
    MatSelectModule, MatSnackBarModule, MatProgressBarModule,
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
                    <td>{{ '$' + (c.discount_cents / 100) }}</td>
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
