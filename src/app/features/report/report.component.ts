import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { AuthService } from '../../shared/services/auth.service';
import { DashboardService, type ContentItem } from '../dashboard/dashboard.service';

interface IssueForm {
  title: string;
  description: string;
  type: string;
  severity: string;
  content_id?: string;
  contentTitle?: string;
}

@Component({
  selector: 'app-report',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatButtonModule, MatIconModule, MatTableModule,
    MatSelectModule, MatFormFieldModule, MatInputModule, MatProgressBarModule,
    MatSnackBarModule, MatChipsModule,
  ],
  template: `
    <div class="report-container">
      <div class="page-header">
        <mat-icon class="header-icon">bug_report</mat-icon>
        <div>
          <h1>Report an Issue</h1>
          <p class="subtitle">Select a content item to report an issue against it, or submit a general issue.</p>
        </div>
        <span class="role-badge">{{ auth.role() }}</span>
      </div>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
      }

      @if (submitted()) {
        <!-- Success state -->
        <mat-card class="success-card">
          <mat-card-content>
            <div class="success-inner">
              <mat-icon class="success-icon">check_circle</mat-icon>
              <h2>Issue Reported</h2>
              <p>Issue <strong>#{{ submittedId() }}</strong> has been created and assigned to the team.</p>
              <div class="success-actions">
                <button mat-raised-button color="primary" (click)="reset()">
                  <mat-icon>add</mat-icon> Report Another
                </button>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      } @else if (showForm()) {
        <!-- Issue Form -->
        <mat-card class="form-card">
          <mat-card-header>
            <mat-card-title>{{ form.content_id ? 'Report Issue' : 'General Issue' }}</mat-card-title>
            @if (form.content_id) {
              <mat-card-subtitle>
                <span class="subtitle-link" (click)="backToList()">← Back to content list</span>
              </mat-card-subtitle>
            }
          </mat-card-header>
          <mat-card-content>

            @if (form.content_id) {
              <div class="linked-banner">
                <mat-icon>link</mat-icon>
                <div>
                  <div class="linked-label">Linked content</div>
                  <div class="linked-title">{{ form.contentTitle }}</div>
                </div>
              </div>
            }

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Issue Title *</mat-label>
              <input matInput [(ngModel)]="form.title" placeholder="Brief summary of the issue" />
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Description</mat-label>
              <textarea matInput [(ngModel)]="form.description" rows="4"
                placeholder="Describe what you found: steps to reproduce, expected vs actual, screenshots info..."></textarea>
            </mat-form-field>

            <div class="form-row">
              <mat-form-field appearance="outline">
                <mat-label>Issue Type</mat-label>
                <mat-select [(value)]="form.type">
                  <mat-option value="content_fix">Content Fix</mat-option>
                  <mat-option value="bug">Bug</mat-option>
                  <mat-option value="quality">Quality</mat-option>
                  <mat-option value="video_sync">Video Sync</mat-option>
                  <mat-option value="task">Task</mat-option>
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Severity</mat-label>
                <mat-select [(value)]="form.severity">
                  <mat-option value="low">Low</mat-option>
                  <mat-option value="medium">Medium</mat-option>
                  <mat-option value="high">High</mat-option>
                  <mat-option value="critical">Critical</mat-option>
                </mat-select>
              </mat-form-field>
            </div>

            <div class="severity-hint severity-{{ form.severity }}">
              @switch (form.severity) {
                @case ('critical') { <mat-icon>error</mat-icon> <span>Critical — blocks publishing or breaks the site</span> }
                @case ('high') { <mat-icon>warning</mat-icon> <span>High — major content error or broken feature</span> }
                @case ('medium') { <mat-icon>info</mat-icon> <span>Medium — noticeable issue, should be fixed soon</span> }
                @case ('low') { <mat-icon>check_circle_outline</mat-icon> <span>Low — minor polish or cosmetic issue</span> }
              }
            </div>

            <div class="form-actions">
              <button mat-raised-button color="primary" (click)="submit()" [disabled]="!form.title.trim() || submitting()">
                <mat-icon>send</mat-icon> Submit Issue
              </button>
              <button mat-stroked-button (click)="backToList()">Cancel</button>
            </div>

          </mat-card-content>
        </mat-card>
      } @else {
        <!-- Content List -->
        <div class="list-header">
          <h2>Content Items</h2>
          <div class="list-actions">
            <button mat-stroked-button (click)="openGeneralIssueForm()">
              <mat-icon>add</mat-icon> General Issue (no content link)
            </button>
          </div>
        </div>

        <mat-card class="list-card">
          <mat-card-content>
            @if (contentItems().length === 0 && !loading()) {
              <div class="empty-state">
                <mat-icon>inbox</mat-icon>
                <p>No content items found.</p>
              </div>
            } @else {
              <table mat-table [dataSource]="contentItems()" class="full-width-table">

                <ng-container matColumnDef="type">
                  <th mat-header-cell *matHeaderCellDef>Type</th>
                  <td mat-cell *matCellDef="let item">
                    <span class="type-chip type-{{ item.type }}">{{ item.type }}</span>
                  </td>
                </ng-container>

                <ng-container matColumnDef="title">
                  <th mat-header-cell *matHeaderCellDef>Title</th>
                  <td mat-cell *matCellDef="let item" class="title-cell">{{ item.title }}</td>
                </ng-container>

                <ng-container matColumnDef="date">
                  <th mat-header-cell *matHeaderCellDef>Date</th>
                  <td mat-cell *matCellDef="let item" class="date-cell">{{ item.date }}</td>
                </ng-container>

                <ng-container matColumnDef="qa_status">
                  <th mat-header-cell *matHeaderCellDef>QA Status</th>
                  <td mat-cell *matCellDef="let item">
                    <span class="qa-chip qa-{{ item.qa_status }}">{{ item.qa_status }}</span>
                  </td>
                </ng-container>

                <ng-container matColumnDef="report">
                  <th mat-header-cell *matHeaderCellDef></th>
                  <td mat-cell *matCellDef="let item">
                    <button mat-stroked-button color="warn" (click)="openForm(item)">
                      <mat-icon>bug_report</mat-icon> Report Issue
                    </button>
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="columns"></tr>
                <tr mat-row *matRowDef="let row; columns: columns;" class="content-row"></tr>
              </table>
            }
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styles: [`
    .report-container { max-width: 1100px; margin: 0 auto; padding: 32px 16px; }
    .page-header {
      display: flex; align-items: flex-start; gap: 16px; margin-bottom: 28px;
    }
    .header-icon { font-size: 36px; height: 36px; width: 36px; color: #ef4444; margin-top: 4px; }
    .page-header h1 { margin: 0 0 4px 0; font-size: 26px; font-weight: 700; }
    .page-header .subtitle { margin: 0; color: #94a3b8; font-size: 14px; }
    .role-badge {
      margin-left: auto; align-self: center;
      background: #3b82f6; color: #fff; padding: 4px 12px; border-radius: 12px;
      font-size: 12px; font-weight: 600; text-transform: uppercase;
    }

    /* List */
    .list-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .list-header h2 { margin: 0; font-size: 18px; }
    .list-card { overflow: hidden; }
    .full-width-table { width: 100%; }
    .title-cell { max-width: 400px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .date-cell { white-space: nowrap; color: #94a3b8; font-size: 13px; }
    .content-row:hover td { background: rgba(59,130,246,0.05); }
    .empty-state { text-align: center; padding: 40px; color: #64748b; }
    .empty-state mat-icon { font-size: 48px; height: 48px; width: 48px; display: block; margin: 0 auto 12px; }

    /* Form */
    .form-card { max-width: 680px; }
    .full-width { width: 100%; }
    .form-row { display: flex; gap: 12px; flex-wrap: wrap; }
    .form-row mat-form-field { flex: 1; min-width: 160px; }
    .form-actions { display: flex; gap: 8px; margin-top: 8px; }
    .subtitle-link { color: #3b82f6; cursor: pointer; font-size: 13px; }
    .subtitle-link:hover { text-decoration: underline; }

    .linked-banner {
      display: flex; align-items: flex-start; gap: 12px;
      background: #1e3a5f; border: 1px solid #3b82f6; border-radius: 8px;
      padding: 12px 16px; margin-bottom: 20px;
    }
    .linked-banner mat-icon { color: #3b82f6; margin-top: 2px; }
    .linked-label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
    .linked-title { font-size: 14px; color: #e2e8f0; font-weight: 500; }

    .severity-hint {
      display: flex; align-items: center; gap: 6px;
      border-radius: 6px; padding: 8px 12px; font-size: 13px; margin-bottom: 12px;
    }
    .severity-hint mat-icon { font-size: 16px; height: 16px; width: 16px; }
    .severity-critical { background: rgba(220,38,38,0.15); color: #fca5a5; border: 1px solid rgba(220,38,38,0.3); }
    .severity-high { background: rgba(239,68,68,0.12); color: #fca5a5; border: 1px solid rgba(239,68,68,0.25); }
    .severity-medium { background: rgba(245,158,11,0.12); color: #fde68a; border: 1px solid rgba(245,158,11,0.25); }
    .severity-low { background: rgba(34,197,94,0.1); color: #86efac; border: 1px solid rgba(34,197,94,0.2); }

    /* Success */
    .success-card { max-width: 480px; margin: 40px auto; }
    .success-inner { text-align: center; padding: 16px 0; }
    .success-icon { font-size: 64px; height: 64px; width: 64px; color: #22c55e; margin-bottom: 12px; }
    .success-inner h2 { margin: 0 0 8px 0; }
    .success-inner p { color: #94a3b8; margin: 0 0 24px 0; }
    .success-actions { display: flex; justify-content: center; gap: 12px; }

    /* Chips */
    .type-chip, .qa-chip {
      display: inline-block; padding: 2px 8px; border-radius: 10px;
      font-size: 11px; font-weight: 600; text-transform: uppercase;
    }
    .type-blog { background: #3b82f6; color: #fff; }
    .type-video { background: #ef4444; color: #fff; }
    .type-short { background: #f59e0b; color: #000; }
    .type-podcast { background: #8b5cf6; color: #fff; }
    .qa-draft { background: #475569; color: #fff; }
    .qa-in_review { background: #f59e0b; color: #000; }
    .qa-approved { background: #22c55e; color: #fff; }
    .qa-published { background: #3b82f6; color: #fff; }
    .qa-flagged { background: #ef4444; color: #fff; }
    .qa-rejected { background: #dc2626; color: #fff; }
  `],
})
export class ReportComponent implements OnInit {
  auth = inject(AuthService);
  private svc = inject(DashboardService);
  private snack = inject(MatSnackBar);

  loading = signal(false);
  submitting = signal(false);
  submitted = signal(false);
  submittedId = signal<number | null>(null);
  showForm = signal(false);
  contentItems = signal<ContentItem[]>([]);

  columns = ['type', 'title', 'date', 'qa_status', 'report'];

  form: IssueForm = { title: '', description: '', type: 'content_fix', severity: 'medium' };

  ngOnInit() {
    this.loadContent();
  }

  loadContent() {
    this.loading.set(true);
    this.svc.listContent({}).subscribe({
      next: r => { this.contentItems.set(r.items); this.loading.set(false); },
      error: () => { this.snack.open('Failed to load content', 'OK', { duration: 3000 }); this.loading.set(false); },
    });
  }

  openForm(item: ContentItem) {
    const typeLabel = item.type.charAt(0).toUpperCase() + item.type.slice(1);
    this.form = {
      title: `[${typeLabel}] ${item.title}`,
      description: '',
      type: 'content_fix',
      severity: 'medium',
      content_id: item.id,
      contentTitle: item.title,
    };
    this.showForm.set(true);
  }

  openGeneralIssueForm() {
    this.form = { title: '', description: '', type: 'content_fix', severity: 'medium' };
    this.showForm.set(true);
  }

  backToList() {
    this.showForm.set(false);
    this.form = { title: '', description: '', type: 'content_fix', severity: 'medium' };
  }

  submit() {
    if (!this.form.title.trim()) return;
    this.submitting.set(true);
    const { contentTitle, ...payload } = this.form;
    this.svc.createIssue(payload).subscribe({
      next: (r: any) => {
        this.submitting.set(false);
        this.submitted.set(true);
        this.submittedId.set(r.id ?? null);
      },
      error: (e: any) => {
        this.snack.open(e.error?.error || 'Failed to submit issue', 'OK', { duration: 4000 });
        this.submitting.set(false);
      },
    });
  }

  reset() {
    this.submitted.set(false);
    this.submittedId.set(null);
    this.showForm.set(false);
    this.form = { title: '', description: '', type: 'content_fix', severity: 'medium' };
  }
}
