import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AdminService, PublishingItem } from './admin.service';

@Component({
  selector: 'app-publishing-queue',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatButtonModule, MatIconModule, MatTableModule,
    MatChipsModule, MatSnackBarModule,
  ],
  template: `
    <mat-card class="queue-card">
      <mat-card-header>
        <mat-card-title>Publishing Queue</mat-card-title>
        <div class="header-actions">
          <div class="filter-toggle">
            <button mat-stroked-button [class.active-filter]="filter === 'all'" (click)="setFilter('all')">All</button>
            <button mat-stroked-button [class.active-filter]="filter === 'unpublished'" (click)="setFilter('unpublished')">Unpublished Only</button>
          </div>
          <button mat-icon-button (click)="load()" [disabled]="loading()" title="Refresh">
            <mat-icon>refresh</mat-icon>
          </button>
        </div>
      </mat-card-header>
      <mat-card-content>
        @if (loading()) {
          <div class="loading-bar"></div>
        }
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>QA Status</th>
                <th>Blogger</th>
                <th>LinkedIn</th>
                <th>X / Twitter</th>
              </tr>
            </thead>
            <tbody>
              @for (item of filteredItems(); track item.id) {
                <tr>
                  <td class="title-cell" [title]="item.title">{{ truncate(item.title, 50) }}</td>
                  <td><span class="type-badge">{{ item.type }}</span></td>
                  <td>
                    <span class="qa-chip" [class]="'qa-' + item.qa_status">{{ item.qa_status }}</span>
                  </td>
                  <td>
                    @if (item.blogger_posted) {
                      <div class="posted-cell">
                        <mat-icon class="check-icon">check_circle</mat-icon>
                        <span class="muted date-text">{{ item.blogger_posted_at ? formatDate(item.blogger_posted_at) : '' }}</span>
                      </div>
                    } @else {
                      <button mat-stroked-button class="mark-btn" (click)="mark(item, 'blogger')">Mark Posted</button>
                    }
                  </td>
                  <td>
                    @if (item.linkedin_posted) {
                      <div class="posted-cell">
                        <mat-icon class="check-icon">check_circle</mat-icon>
                        <span class="muted date-text">{{ item.linkedin_posted_at ? formatDate(item.linkedin_posted_at) : '' }}</span>
                      </div>
                    } @else {
                      <button mat-stroked-button class="mark-btn" (click)="mark(item, 'linkedin')">Mark Posted</button>
                    }
                  </td>
                  <td>
                    @if (item.x_posted) {
                      <div class="posted-cell">
                        <mat-icon class="check-icon">check_circle</mat-icon>
                        <span class="muted date-text">{{ item.x_posted_at ? formatDate(item.x_posted_at) : '' }}</span>
                      </div>
                    } @else {
                      <button mat-stroked-button class="mark-btn" (click)="mark(item, 'x')">Mark Posted</button>
                    }
                  </td>
                </tr>
              }
              @if (filteredItems().length === 0 && !loading()) {
                <tr><td colspan="6" class="empty-cell">No items found.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .queue-card mat-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.75rem;
    }
    .queue-card mat-card-title { font-size: 1rem; }
    .header-actions { display: flex; align-items: center; gap: 0.75rem; margin-left: auto; }
    .filter-toggle { display: flex; gap: 0; }
    .filter-toggle button { border-radius: 0; border-color: rgba(148,163,184,0.3); color: #94a3b8; font-size: 0.8rem; }
    .filter-toggle button:first-child { border-radius: 4px 0 0 4px; }
    .filter-toggle button:last-child { border-radius: 0 4px 4px 0; }
    .filter-toggle button.active-filter { background: rgba(59,130,246,0.15); color: #60a5fa; border-color: #3b82f6; }

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
    .title-cell { max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .type-badge {
      display: inline-block;
      padding: 0.12rem 0.45rem;
      border-radius: 4px;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      background: rgba(99,102,241,0.15);
      color: #818cf8;
    }

    .qa-chip {
      display: inline-block;
      padding: 0.12rem 0.45rem;
      border-radius: 4px;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    .qa-approved { background: rgba(34,197,94,0.15); color: #22c55e; }
    .qa-pending { background: rgba(245,158,11,0.15); color: #f59e0b; }
    .qa-rejected { background: rgba(239,68,68,0.15); color: #ef4444; }
    .qa-draft { background: rgba(148,163,184,0.15); color: #94a3b8; }

    .posted-cell { display: flex; align-items: center; gap: 0.35rem; }
    .check-icon { color: #22c55e; font-size: 18px; height: 18px; width: 18px; }
    .date-text { font-size: 0.75rem; white-space: nowrap; }
    .mark-btn { font-size: 0.75rem; padding: 0 8px; height: 28px; line-height: 28px; color: #f59e0b; border-color: rgba(245,158,11,0.4); }
    .mark-btn:hover { background: rgba(245,158,11,0.1); }

    .muted { color: #94a3b8; }
  `],
})
export class PublishingQueueComponent implements OnInit {
  private adminSvc = inject(AdminService);
  private snack = inject(MatSnackBar);

  items = signal<PublishingItem[]>([]);
  loading = signal(false);
  filter: 'all' | 'unpublished' = 'unpublished';

  filteredItems = computed(() => {
    if (this.filter === 'all') return this.items();
    return this.items().filter(i => !i.blogger_posted || !i.linkedin_posted || !i.x_posted);
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.adminSvc.getPublishingQueue().subscribe({
      next: (res) => { this.items.set(res.items ?? []); this.loading.set(false); },
      error: (e) => { this.snack.open(e.message ?? 'Failed to load queue', 'Dismiss', { duration: 4000 }); this.loading.set(false); },
    });
  }

  setFilter(f: 'all' | 'unpublished'): void {
    this.filter = f;
  }

  mark(item: PublishingItem, platform: string): void {
    this.adminSvc.markCrossPost(item.id, platform, 'mark_posted').subscribe({
      next: (res) => {
        if (res.success) {
          const now = new Date().toISOString();
          this.items.update(rows => rows.map(r => {
            if (r.id !== item.id) return r;
            const updated = { ...r };
            if (platform === 'blogger') { updated.blogger_posted = true; updated.blogger_posted_at = now; }
            if (platform === 'linkedin') { updated.linkedin_posted = true; updated.linkedin_posted_at = now; }
            if (platform === 'x') { updated.x_posted = true; updated.x_posted_at = now; }
            return updated;
          }));
          this.snack.open(`Marked as posted on ${platform}`, 'Dismiss', { duration: 2000 });
        }
      },
      error: (e) => { this.snack.open(e.message ?? 'Failed', 'Dismiss', { duration: 4000 }); },
    });
  }

  truncate(val: string, len: number): string {
    if (!val) return '—';
    return val.length > len ? val.slice(0, len) + '…' : val;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric' });
  }
}
