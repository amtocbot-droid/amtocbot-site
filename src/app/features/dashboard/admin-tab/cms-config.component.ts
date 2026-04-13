import { Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AdminService, ConfigRow } from './admin.service';

@Component({
  selector: 'app-cms-config',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatButtonModule, MatIconModule, MatTableModule,
    MatFormFieldModule, MatInputModule, MatSnackBarModule,
  ],
  template: `
    <mat-card class="config-card">
      <mat-card-header>
        <mat-card-title>Site Configuration</mat-card-title>
        <button mat-stroked-button (click)="load()" [disabled]="loading()" class="refresh-btn">
          <mat-icon>refresh</mat-icon> Refresh
        </button>
      </mat-card-header>
      <mat-card-content>
        @if (loading()) {
          <div class="loading-bar"></div>
        }
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Key</th>
                <th>Value</th>
                <th>Updated By</th>
                <th>Updated At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (row of configRows(); track row.key) {
                <tr>
                  <td class="mono key-cell">{{ row.key }}</td>
                  <td class="value-cell">
                    @if (editingKey() === row.key) {
                      <div class="inline-edit">
                        <mat-form-field appearance="outline" class="edit-field">
                          <input matInput [(ngModel)]="editValue" (keydown.enter)="save(row.key)" />
                        </mat-form-field>
                        <button mat-raised-button color="primary" (click)="save(row.key)" class="save-btn">Save</button>
                        <button mat-button (click)="cancelEdit()">Cancel</button>
                      </div>
                    } @else {
                      <span class="value-text" [title]="row.value">{{ truncate(row.value, 60) }}</span>
                    }
                  </td>
                  <td class="muted mono">{{ row.updated_by || '—' }}</td>
                  <td class="muted">{{ row.updated_at ? formatDate(row.updated_at) : '—' }}</td>
                  <td>
                    @if (editingKey() !== row.key) {
                      <button mat-icon-button (click)="startEdit(row)" title="Edit">
                        <mat-icon>edit</mat-icon>
                      </button>
                    }
                  </td>
                </tr>
              }
              @if (configRows().length === 0 && !loading()) {
                <tr><td colspan="5" class="empty-cell">No config rows found.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .config-card mat-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.75rem;
    }
    .config-card mat-card-title { font-size: 1rem; }
    .refresh-btn { margin-left: auto; }

    .loading-bar {
      height: 3px;
      background: linear-gradient(90deg, #3b82f6 0%, #60a5fa 50%, #3b82f6 100%);
      background-size: 200%;
      animation: shimmer 1.2s infinite;
      border-radius: 2px;
      margin-bottom: 0.75rem;
    }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

    .table-wrap { overflow-x: auto; margin-top: 0.75rem; }
    .data-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    .data-table th {
      text-align: left;
      padding: 0.6rem 0.75rem;
      border-bottom: 2px solid rgba(148,163,184,0.2);
      color: #94a3b8;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      white-space: nowrap;
    }
    .data-table td {
      padding: 0.6rem 0.75rem;
      border-bottom: 1px solid rgba(148,163,184,0.1);
      color: #e2e8f0;
    }
    .data-table tr:hover td { background: rgba(59,130,246,0.05); }
    .empty-cell { text-align: center; color: #94a3b8; padding: 2rem; }

    .mono { font-family: monospace; font-size: 0.82rem; }
    .muted { color: #94a3b8; }
    .key-cell { color: #60a5fa; font-weight: 600; white-space: nowrap; }
    .value-cell { max-width: 300px; }
    .value-text { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: default; }

    .inline-edit { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .edit-field { flex: 1; min-width: 180px; }
    .save-btn { white-space: nowrap; }
  `],
})
export class CmsConfigComponent implements OnInit {
  private adminSvc = inject(AdminService);
  private snack = inject(MatSnackBar);

  configRows = signal<ConfigRow[]>([]);
  editingKey = signal<string | null>(null);
  editValue = '';
  loading = signal(false);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.adminSvc.getCmsConfig().subscribe({
      next: (res) => {
        this.configRows.set(res.config ?? []);
        this.loading.set(false);
      },
      error: (e) => {
        this.snack.open(e.message ?? 'Failed to load config', 'Dismiss', { duration: 4000 });
        this.loading.set(false);
      },
    });
  }

  startEdit(row: ConfigRow): void {
    this.editingKey.set(row.key);
    this.editValue = row.value;
  }

  cancelEdit(): void {
    this.editingKey.set(null);
    this.editValue = '';
  }

  save(key: string): void {
    this.adminSvc.updateCmsConfig(key, this.editValue).subscribe({
      next: (res) => {
        if (res.success) {
          this.configRows.update(rows =>
            rows.map(r => r.key === key ? { ...r, value: this.editValue, updated_at: new Date().toISOString(), updated_by: 'admin' } : r)
          );
          this.editingKey.set(null);
          this.editValue = '';
          this.snack.open('Config updated', 'Dismiss', { duration: 3000 });
        } else {
          this.snack.open('Update failed', 'Dismiss', { duration: 4000 });
        }
      },
      error: (e) => {
        this.snack.open(e.message ?? 'Update failed', 'Dismiss', { duration: 4000 });
      },
    });
  }

  truncate(val: string, len: number): string {
    if (!val) return '—';
    return val.length > len ? val.slice(0, len) + '…' : val;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}
