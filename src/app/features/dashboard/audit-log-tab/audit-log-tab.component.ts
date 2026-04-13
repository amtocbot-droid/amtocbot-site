import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
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
    CommonModule, DatePipe, FormsModule,
    MatCardModule, MatButtonModule, MatIconModule, MatTableModule,
    MatFormFieldModule, MatInputModule, MatSnackBarModule,
  ],
  template: `
    <div class="audit-container">
      <div class="filters-row">
        <mat-form-field appearance="outline">
          <mat-label>Filter by username</mat-label>
          <input matInput [(ngModel)]="usernameFilter" (ngModelChange)="onFilterChange()" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Filter by action</mat-label>
          <input matInput [(ngModel)]="actionFilter" (ngModelChange)="onFilterChange()" />
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

  private filterTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit() { this.load(); }

  onFilterChange() {
    if (this.filterTimer) clearTimeout(this.filterTimer);
    this.filterTimer = setTimeout(() => { this.offset.set(0); this.load(); }, 400);
  }

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
