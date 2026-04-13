import { Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AdminService, SocialPost } from './admin.service';

@Component({
  selector: 'app-social-queue',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatButtonModule, MatIconModule, MatTableModule,
    MatChipsModule, MatFormFieldModule, MatInputModule, MatSnackBarModule,
  ],
  template: `
    <mat-card class="social-card">
      <mat-card-header>
        <mat-card-title>Social Queue</mat-card-title>
        <div class="header-actions">
          <button mat-stroked-button (click)="sync()" [disabled]="loading()" class="sync-btn">
            <mat-icon>sync</mat-icon> Sync
          </button>
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
                <th>Content Title</th>
                <th>Platform</th>
                <th>Status</th>
                <th>Draft Preview</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (post of posts(); track post.id) {
                <tr class="main-row" (click)="toggleExpand(post.id)">
                  <td class="title-cell" [title]="post.title">
                    <span class="clickable">{{ truncate(post.title, 45) }}</span>
                  </td>
                  <td>
                    <span class="platform-badge" [class]="'platform-' + post.platform">{{ post.platform }}</span>
                  </td>
                  <td>
                    <span class="status-chip" [class]="'status-' + post.status">{{ post.status }}</span>
                  </td>
                  <td class="preview-cell muted">{{ draftPreview(post) }}</td>
                  <td class="actions-cell" (click)="$event.stopPropagation()">
                    @if (editingPost() === post.id) {
                      <div class="inline-edit">
                        <mat-form-field appearance="outline" class="draft-field">
                          <textarea matInput [(ngModel)]="draftEditValue" rows="3"></textarea>
                        </mat-form-field>
                        <div class="edit-btns">
                          <button mat-raised-button color="primary" (click)="saveDraft(post)">Save</button>
                          <button mat-button (click)="cancelEdit()">Cancel</button>
                        </div>
                      </div>
                    } @else {
                      <div class="action-btns">
                        @if (post.status === 'pending' || post.status === 'skipped') {
                          <button mat-stroked-button class="action-btn mark-btn" (click)="markPosted(post)">
                            <mat-icon>check</mat-icon> Posted
                          </button>
                        }
                        @if (post.status === 'pending') {
                          <button mat-stroked-button class="action-btn skip-btn" (click)="skipPost(post)">
                            <mat-icon>skip_next</mat-icon> Skip
                          </button>
                        }
                        <button mat-icon-button class="edit-icon-btn" (click)="startEdit(post)" title="Edit draft">
                          <mat-icon>edit_note</mat-icon>
                        </button>
                        <button mat-icon-button (click)="toggleExpand(post.id)" title="Toggle preview">
                          <mat-icon>{{ expandedId() === post.id ? 'expand_less' : 'expand_more' }}</mat-icon>
                        </button>
                      </div>
                    }
                  </td>
                </tr>
                @if (expandedId() === post.id && editingPost() !== post.id) {
                  <tr class="expanded-row">
                    <td colspan="5">
                      <div class="expanded-body">{{ post.draft_body || 'No draft body.' }}</div>
                    </td>
                  </tr>
                }
              }
              @if (posts().length === 0 && !loading()) {
                <tr><td colspan="5" class="empty-cell">No social posts in queue.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .social-card mat-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.75rem;
    }
    .social-card mat-card-title { font-size: 1rem; }
    .header-actions { display: flex; align-items: center; gap: 0.5rem; margin-left: auto; }
    .sync-btn mat-icon { margin-right: 4px; }

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
    .main-row { cursor: pointer; }
    .main-row:hover td { background: rgba(59,130,246,0.05); }
    .expanded-row td { background: rgba(30,41,59,0.6); padding: 0 0.75rem 0.75rem; border-bottom: 2px solid rgba(148,163,184,0.15); }
    .empty-cell { text-align: center; color: #94a3b8; padding: 2rem; }

    .title-cell { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .clickable { cursor: pointer; }
    .clickable:hover { color: #60a5fa; }
    .preview-cell { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.8rem; }

    .platform-badge {
      display: inline-block;
      padding: 0.12rem 0.45rem;
      border-radius: 4px;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    .platform-linkedin { background: rgba(10,102,194,0.2); color: #60a5fa; }
    .platform-x, .platform-twitter { background: rgba(29,161,242,0.15); color: #38bdf8; }
    .platform-youtube { background: rgba(255,0,0,0.15); color: #f87171; }
    .platform-tiktok { background: rgba(105,201,208,0.15); color: #67e8f9; }

    .status-chip {
      display: inline-block;
      padding: 0.12rem 0.45rem;
      border-radius: 4px;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    .status-pending { background: rgba(245,158,11,0.15); color: #f59e0b; }
    .status-posted { background: rgba(34,197,94,0.15); color: #22c55e; }
    .status-skipped { background: rgba(148,163,184,0.15); color: #94a3b8; }

    .actions-cell { white-space: nowrap; }
    .action-btns { display: flex; align-items: center; gap: 0.25rem; }
    .action-btn { font-size: 0.72rem; padding: 0 8px; height: 28px; line-height: 28px; }
    .action-btn mat-icon { font-size: 14px; height: 14px; width: 14px; margin-right: 2px; }
    .mark-btn { color: #22c55e; border-color: rgba(34,197,94,0.4); }
    .mark-btn:hover { background: rgba(34,197,94,0.1); }
    .skip-btn { color: #94a3b8; border-color: rgba(148,163,184,0.3); }
    .skip-btn:hover { background: rgba(148,163,184,0.1); }
    .edit-icon-btn { color: #94a3b8; }

    .expanded-body {
      white-space: pre-wrap;
      font-size: 0.83rem;
      color: #cbd5e1;
      line-height: 1.6;
      padding: 0.75rem 0;
      max-height: 200px;
      overflow-y: auto;
    }

    .inline-edit { display: flex; flex-direction: column; gap: 0.5rem; padding: 0.5rem 0; }
    .draft-field { width: 100%; }
    .edit-btns { display: flex; gap: 0.5rem; }

    .muted { color: #94a3b8; }
  `],
})
export class SocialQueueComponent implements OnInit {
  private adminSvc = inject(AdminService);
  private snack = inject(MatSnackBar);

  posts = signal<SocialPost[]>([]);
  expandedId = signal<number | null>(null);
  editingPost = signal<number | null>(null);
  draftEditValue = '';
  loading = signal(false);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.adminSvc.getSocialQueue().subscribe({
      next: (res) => { this.posts.set(res.posts ?? []); this.loading.set(false); },
      error: (e) => { this.snack.open(e.message ?? 'Failed to load social queue', 'Dismiss', { duration: 4000 }); this.loading.set(false); },
    });
  }

  sync(): void {
    this.loading.set(true);
    this.adminSvc.syncSocialQueue().subscribe({
      next: (res) => { this.snack.open(`Synced ${res.synced} posts`, 'Dismiss', { duration: 3000 }); this.load(); },
      error: (e) => { this.snack.open(e.message ?? 'Sync failed', 'Dismiss', { duration: 4000 }); this.loading.set(false); },
    });
  }

  toggleExpand(id: number): void {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }

  startEdit(post: SocialPost): void {
    this.editingPost.set(post.id);
    this.draftEditValue = post.draft_body ?? '';
    this.expandedId.set(null);
  }

  cancelEdit(): void {
    this.editingPost.set(null);
    this.draftEditValue = '';
  }

  saveDraft(post: SocialPost): void {
    this.adminSvc.updateSocialPost(post.content_id, post.platform, post.status, this.draftEditValue).subscribe({
      next: (res) => {
        if (res.success) {
          this.posts.update(all => all.map(p => p.id === post.id ? { ...p, draft_body: this.draftEditValue } : p));
          this.editingPost.set(null);
          this.snack.open('Draft updated', 'Dismiss', { duration: 2000 });
        }
      },
      error: (e) => { this.snack.open(e.message ?? 'Failed', 'Dismiss', { duration: 4000 }); },
    });
  }

  markPosted(post: SocialPost): void {
    this.adminSvc.updateSocialPost(post.content_id, post.platform, 'posted').subscribe({
      next: (res) => {
        if (res.success) {
          const now = new Date().toISOString();
          this.posts.update(all => all.map(p => p.id === post.id ? { ...p, status: 'posted', posted_at: now } : p));
          this.snack.open('Marked as posted', 'Dismiss', { duration: 2000 });
        }
      },
      error: (e) => { this.snack.open(e.message ?? 'Failed', 'Dismiss', { duration: 4000 }); },
    });
  }

  skipPost(post: SocialPost): void {
    this.adminSvc.updateSocialPost(post.content_id, post.platform, 'skipped').subscribe({
      next: (res) => {
        if (res.success) {
          this.posts.update(all => all.map(p => p.id === post.id ? { ...p, status: 'skipped' } : p));
          this.snack.open('Post skipped', 'Dismiss', { duration: 2000 });
        }
      },
      error: (e) => { this.snack.open(e.message ?? 'Failed', 'Dismiss', { duration: 4000 }); },
    });
  }

  draftPreview(post: SocialPost): string {
    if (!post.draft_body) return '—';
    return post.draft_body.length > 80 ? post.draft_body.slice(0, 80) + '…' : post.draft_body;
  }

  truncate(val: string, len: number): string {
    if (!val) return '—';
    return val.length > len ? val.slice(0, len) + '…' : val;
  }
}
