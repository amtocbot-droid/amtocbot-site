import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService, type Permission } from '../../shared/services/auth.service';
import { DashboardService, type DashboardStats, type ContentItem, type Issue, type IssueComment, type DashboardUser } from './dashboard.service';
import { ReferralsTabComponent } from './referrals-tab/referrals-tab.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatButtonModule, MatIconModule, MatTabsModule, MatTableModule,
    MatSelectModule, MatFormFieldModule, MatInputModule, MatChipsModule,
    MatProgressBarModule, MatDialogModule, MatSnackBarModule,
    ReferralsTabComponent,
  ],
  template: `
    <div class="dashboard-container">
      <div class="dashboard-header">
        <h1>Dashboard</h1>
        <span class="role-badge">{{ auth.role() }}</span>
        <span class="user-name">{{ auth.username() }}</span>
      </div>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
      }

      <mat-tab-group (selectedTabChange)="onTabChange($event.index)" animationDuration="200ms">
        <!-- Overview Tab -->
        <mat-tab label="Overview">
          <div class="tab-content">
            <div class="stats-grid">
              <mat-card class="stat-card">
                <mat-card-content>
                  <div class="stat-value">{{ stats()?.openIssues ?? '-' }}</div>
                  <div class="stat-label">Open Issues</div>
                </mat-card-content>
              </mat-card>
              <mat-card class="stat-card">
                <mat-card-content>
                  <div class="stat-value">{{ stats()?.pendingApprovals ?? '-' }}</div>
                  <div class="stat-label">Pending Approvals</div>
                </mat-card-content>
              </mat-card>
              <mat-card class="stat-card">
                <mat-card-content>
                  <div class="stat-value">{{ stats()?.totalContent ?? '-' }}</div>
                  <div class="stat-label">Total Content</div>
                </mat-card-content>
              </mat-card>
              @if (auth.hasRole('admin')) {
                <mat-card class="stat-card">
                  <mat-card-content>
                    <div class="stat-value">{{ stats()?.totalUsers ?? '-' }}</div>
                    <div class="stat-label">Users</div>
                  </mat-card-content>
                </mat-card>
              }
              @if (auth.hasRole('tester')) {
                <mat-card class="stat-card">
                  <mat-card-content>
                    <div class="stat-value">{{ stats()?.assignedToMe ?? '-' }}</div>
                    <div class="stat-label">Assigned to Me</div>
                  </mat-card-content>
                </mat-card>
              }
            </div>

            <!-- Recent Activity -->
            <mat-card class="activity-card">
              <mat-card-header><mat-card-title>Recent Activity</mat-card-title></mat-card-header>
              <mat-card-content>
                <div class="activity-list">
                  @for (a of stats()?.recentActivity || []; track a.created_at) {
                    <div class="activity-item">
                      <span class="activity-user">{{ a.username }}</span>
                      <span class="activity-action">{{ a.action }}</span>
                      <span class="activity-time">{{ a.created_at | date:'short' }}</span>
                    </div>
                  }
                </div>
              </mat-card-content>
            </mat-card>
          </div>
        </mat-tab>

        <!-- Content QA Tab -->
        <mat-tab label="Content QA">
          <div class="tab-content">
            <div class="filters-row">
              <mat-form-field appearance="outline">
                <mat-label>Type</mat-label>
                <mat-select [(value)]="contentTypeFilter" (selectionChange)="loadContent()">
                  <mat-option value="">All</mat-option>
                  <mat-option value="blog">Blog</mat-option>
                  <mat-option value="video">Video</mat-option>
                  <mat-option value="short">Short</mat-option>
                  <mat-option value="podcast">Podcast</mat-option>
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>QA Status</mat-label>
                <mat-select [(value)]="contentQAFilter" (selectionChange)="loadContent()">
                  <mat-option value="">All</mat-option>
                  <mat-option value="draft">Draft</mat-option>
                  <mat-option value="in_review">In Review</mat-option>
                  <mat-option value="approved">Approved</mat-option>
                  <mat-option value="published">Published</mat-option>
                  <mat-option value="flagged">Flagged</mat-option>
                  <mat-option value="rejected">Rejected</mat-option>
                </mat-select>
              </mat-form-field>
            </div>

            <table mat-table [dataSource]="contentItems()" class="full-width-table">
              <ng-container matColumnDef="title">
                <th mat-header-cell *matHeaderCellDef>Title</th>
                <td mat-cell *matCellDef="let item">{{ item.title }}</td>
              </ng-container>
              <ng-container matColumnDef="type">
                <th mat-header-cell *matHeaderCellDef>Type</th>
                <td mat-cell *matCellDef="let item">
                  <span class="type-chip type-{{ item.type }}">{{ item.type }}</span>
                </td>
              </ng-container>
              <ng-container matColumnDef="date">
                <th mat-header-cell *matHeaderCellDef>Date</th>
                <td mat-cell *matCellDef="let item">{{ item.date }}</td>
              </ng-container>
              <ng-container matColumnDef="qa_status">
                <th mat-header-cell *matHeaderCellDef>QA Status</th>
                <td mat-cell *matCellDef="let item">
                  <span class="qa-chip qa-{{ item.qa_status }}">{{ item.qa_status }}</span>
                </td>
              </ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef>Actions</th>
                <td mat-cell *matCellDef="let item">
                  @if (auth.hasPermission('content.qa.update') && (item.qa_status === 'draft' || item.qa_status === 'flagged' || item.qa_status === 'rejected')) {
                    <button mat-stroked-button color="primary" (click)="changeQA(item, 'in_review')">Submit for Review</button>
                  }
                  @if (auth.hasPermission('content.qa.update') && item.qa_status !== 'flagged') {
                    <button mat-stroked-button color="warn" (click)="changeQA(item, 'flagged')">Flag</button>
                  }
                  @if (auth.hasPermission('content.qa.approve') && item.qa_status === 'in_review') {
                    <button mat-stroked-button color="primary" (click)="changeQA(item, 'approved')">Approve</button>
                    <button mat-stroked-button color="warn" (click)="changeQA(item, 'rejected')">Reject</button>
                  }
                  @if (auth.hasRole('admin') && item.qa_status === 'approved') {
                    <button mat-stroked-button color="accent" (click)="changeQA(item, 'published')">Publish</button>
                  }
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="contentColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: contentColumns;"></tr>
            </table>
          </div>
        </mat-tab>

        <!-- Issues Tab -->
        <mat-tab label="Issues">
          <div class="tab-content">
            <div class="filters-row">
              <mat-form-field appearance="outline">
                <mat-label>Status</mat-label>
                <mat-select [(value)]="issueStatusFilter" (selectionChange)="loadIssues()">
                  <mat-option value="">All</mat-option>
                  <mat-option value="open">Open</mat-option>
                  <mat-option value="in_progress">In Progress</mat-option>
                  <mat-option value="resolved">Resolved</mat-option>
                  <mat-option value="closed">Closed</mat-option>
                  <mat-option value="wont_fix">Won't Fix</mat-option>
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Severity</mat-label>
                <mat-select [(value)]="issueSeverityFilter" (selectionChange)="loadIssues()">
                  <mat-option value="">All</mat-option>
                  <mat-option value="critical">Critical</mat-option>
                  <mat-option value="high">High</mat-option>
                  <mat-option value="medium">Medium</mat-option>
                  <mat-option value="low">Low</mat-option>
                </mat-select>
              </mat-form-field>
              @if (auth.hasPermission('issues.create')) {
                <button mat-raised-button color="primary" (click)="showNewIssue = true">
                  <mat-icon>add</mat-icon> New Issue
                </button>
              }
            </div>

            <!-- New Issue Form -->
            @if (showNewIssue) {
              <mat-card class="new-issue-card">
                <mat-card-header><mat-card-title>New Issue</mat-card-title></mat-card-header>
                <mat-card-content>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Title</mat-label>
                    <input matInput [(ngModel)]="newIssue.title" />
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Description</mat-label>
                    <textarea matInput [(ngModel)]="newIssue.description" rows="3"></textarea>
                  </mat-form-field>
                  <div class="form-row">
                    <mat-form-field appearance="outline">
                      <mat-label>Type</mat-label>
                      <mat-select [(value)]="newIssue.type">
                        <mat-option value="bug">Bug</mat-option>
                        <mat-option value="task">Task</mat-option>
                        <mat-option value="content_fix">Content Fix</mat-option>
                        <mat-option value="video_sync">Video Sync</mat-option>
                        <mat-option value="quality">Quality</mat-option>
                      </mat-select>
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Severity</mat-label>
                      <mat-select [(value)]="newIssue.severity">
                        <mat-option value="low">Low</mat-option>
                        <mat-option value="medium">Medium</mat-option>
                        <mat-option value="high">High</mat-option>
                        <mat-option value="critical">Critical</mat-option>
                      </mat-select>
                    </mat-form-field>
                  </div>
                  <div class="form-actions">
                    <button mat-raised-button color="primary" (click)="createIssue()" [disabled]="!newIssue.title">Create</button>
                    <button mat-stroked-button (click)="showNewIssue = false">Cancel</button>
                  </div>
                </mat-card-content>
              </mat-card>
            }

            <!-- Issue Detail -->
            @if (selectedIssue()) {
              <mat-card class="issue-detail-card">
                <mat-card-header>
                  <mat-card-title>#{{ selectedIssue()!.id }} {{ selectedIssue()!.title }}</mat-card-title>
                  <mat-card-subtitle>
                    <span class="severity-chip severity-{{ selectedIssue()!.severity }}">{{ selectedIssue()!.severity }}</span>
                    <span class="qa-chip qa-{{ selectedIssue()!.status }}">{{ selectedIssue()!.status }}</span>
                    by {{ selectedIssue()!.creator_name }} &middot; {{ selectedIssue()!.created_at | date:'short' }}
                  </mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  @if (selectedIssue()!.description) {
                    <p class="issue-desc">{{ selectedIssue()!.description }}</p>
                  }
                  @if (selectedIssue()!.content_title) {
                    <p class="linked-content">Linked: {{ selectedIssue()!.content_title }}</p>
                  }

                  <!-- Status actions -->
                  <div class="issue-actions">
                    @if (auth.hasPermission('issues.update_status') && selectedIssue()!.status === 'open') {
                      <button mat-stroked-button (click)="updateIssueStatus(selectedIssue()!.id, 'in_progress')">Start</button>
                    }
                    @if (auth.hasPermission('issues.update_status') && selectedIssue()!.status === 'in_progress') {
                      <button mat-stroked-button color="primary" (click)="updateIssueStatus(selectedIssue()!.id, 'resolved')">Resolve</button>
                    }
                    @if (auth.hasPermission('issues.close') && (selectedIssue()!.status === 'resolved' || selectedIssue()!.status === 'open')) {
                      <button mat-stroked-button color="accent" (click)="updateIssueStatus(selectedIssue()!.id, 'closed')">Close</button>
                      <button mat-stroked-button color="warn" (click)="updateIssueStatus(selectedIssue()!.id, 'wont_fix')">Won't Fix</button>
                    }
                    <button mat-stroked-button (click)="selectedIssue.set(null); issueComments.set([])">Back to list</button>
                  </div>

                  <!-- Comments -->
                  <h3>Comments</h3>
                  @for (c of issueComments(); track c.id) {
                    <div class="comment">
                      <strong>{{ c.username }}</strong>
                      <span class="comment-time">{{ c.created_at | date:'short' }}</span>
                      <p>{{ c.body }}</p>
                    </div>
                  }
                  @if (auth.hasPermission('issues.comment')) {
                    <div class="add-comment">
                      <mat-form-field appearance="outline" class="full-width">
                        <mat-label>Add comment</mat-label>
                        <textarea matInput [(ngModel)]="newComment" rows="2"></textarea>
                      </mat-form-field>
                      <button mat-raised-button color="primary" (click)="addComment()" [disabled]="!newComment">Post</button>
                    </div>
                  }
                </mat-card-content>
              </mat-card>
            } @else {
              <!-- Issues List -->
              <table mat-table [dataSource]="issues()" class="full-width-table">
                <ng-container matColumnDef="title">
                  <th mat-header-cell *matHeaderCellDef>Title</th>
                  <td mat-cell *matCellDef="let issue">
                    <a class="issue-link" (click)="selectIssue(issue.id)">#{{ issue.id }} {{ issue.title }}</a>
                  </td>
                </ng-container>
                <ng-container matColumnDef="type">
                  <th mat-header-cell *matHeaderCellDef>Type</th>
                  <td mat-cell *matCellDef="let issue">{{ issue.type }}</td>
                </ng-container>
                <ng-container matColumnDef="severity">
                  <th mat-header-cell *matHeaderCellDef>Severity</th>
                  <td mat-cell *matCellDef="let issue">
                    <span class="severity-chip severity-{{ issue.severity }}">{{ issue.severity }}</span>
                  </td>
                </ng-container>
                <ng-container matColumnDef="status">
                  <th mat-header-cell *matHeaderCellDef>Status</th>
                  <td mat-cell *matCellDef="let issue">
                    <span class="qa-chip qa-{{ issue.status }}">{{ issue.status }}</span>
                  </td>
                </ng-container>
                <ng-container matColumnDef="assignee">
                  <th mat-header-cell *matHeaderCellDef>Assignee</th>
                  <td mat-cell *matCellDef="let issue">{{ issue.assignee_name || '—' }}</td>
                </ng-container>
                <ng-container matColumnDef="created">
                  <th mat-header-cell *matHeaderCellDef>Created</th>
                  <td mat-cell *matCellDef="let issue">{{ issue.created_at | date:'shortDate' }}</td>
                </ng-container>
                <tr mat-header-row *matHeaderRowDef="issueColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: issueColumns;" (click)="selectIssue(row.id)" class="clickable-row"></tr>
              </table>
            }
          </div>
        </mat-tab>

        <!-- Users Tab (admin only) -->
        @if (auth.hasRole('admin')) {
          <mat-tab label="Users">
            <div class="tab-content">
              <mat-card class="invite-card">
                <mat-card-header>
                  <mat-card-title>Invite User</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <div class="invite-form">
                    <mat-form-field>
                      <mat-label>Username</mat-label>
                      <input matInput [(ngModel)]="inviteForm.username" placeholder="e.g. johndoe" />
                    </mat-form-field>
                    <mat-form-field>
                      <mat-label>Email</mat-label>
                      <input matInput [(ngModel)]="inviteForm.email" placeholder="user@example.com" type="email" />
                    </mat-form-field>
                    <mat-form-field>
                      <mat-label>Role</mat-label>
                      <mat-select [(ngModel)]="inviteForm.role">
                        <mat-option value="tester">tester</mat-option>
                        <mat-option value="approver">approver</mat-option>
                        <mat-option value="reviewer">reviewer</mat-option>
                        <mat-option value="admin">admin</mat-option>
                        <mat-option value="member">member</mat-option>
                      </mat-select>
                    </mat-form-field>
                    <button mat-raised-button color="primary" (click)="inviteUser()" [disabled]="!inviteForm.username || !inviteForm.email">
                      <mat-icon>person_add</mat-icon> Invite
                    </button>
                  </div>
                </mat-card-content>
              </mat-card>
              <table mat-table [dataSource]="users()" class="full-width-table">
                <ng-container matColumnDef="username">
                  <th mat-header-cell *matHeaderCellDef>Username</th>
                  <td mat-cell *matCellDef="let u">{{ u.username }}</td>
                </ng-container>
                <ng-container matColumnDef="email">
                  <th mat-header-cell *matHeaderCellDef>Email</th>
                  <td mat-cell *matCellDef="let u">{{ u.email }}</td>
                </ng-container>
                <ng-container matColumnDef="role">
                  <th mat-header-cell *matHeaderCellDef>Role</th>
                  <td mat-cell *matCellDef="let u">
                    <mat-select [value]="u.role" (selectionChange)="changeUserRole(u.id, $event.value)" class="inline-select">
                      <mat-option value="admin">admin</mat-option>
                      <mat-option value="tester">tester</mat-option>
                      <mat-option value="approver">approver</mat-option>
                      <mat-option value="reviewer">reviewer</mat-option>
                      <mat-option value="member">member</mat-option>
                    </mat-select>
                  </td>
                </ng-container>
                <ng-container matColumnDef="invited_by">
                  <th mat-header-cell *matHeaderCellDef>Invited By</th>
                  <td mat-cell *matCellDef="let u">{{ u.invited_by || '—' }}</td>
                </ng-container>
                <ng-container matColumnDef="created_at">
                  <th mat-header-cell *matHeaderCellDef>Joined</th>
                  <td mat-cell *matCellDef="let u">{{ u.created_at | date:'shortDate' }}</td>
                </ng-container>
                <tr mat-header-row *matHeaderRowDef="userColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: userColumns;"></tr>
              </table>
            </div>
          </mat-tab>
        }

        <!-- Referrals Tab — admin only -->
        @if (auth.role() === 'admin') {
          <mat-tab label="Referrals">
            <div class="tab-content">
              <app-referrals-tab />
            </div>
          </mat-tab>
        }
      </mat-tab-group>
    </div>
  `,
  styles: [`
    .dashboard-container { max-width: 1200px; margin: 0 auto; padding: 24px 16px; }
    .dashboard-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
    .dashboard-header h1 { margin: 0; font-size: 28px; }
    .role-badge {
      background: #3b82f6; color: #fff; padding: 4px 12px; border-radius: 12px;
      font-size: 12px; font-weight: 600; text-transform: uppercase;
    }
    .user-name { color: #94a3b8; font-size: 14px; }
    .tab-content { padding: 16px 0; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .stat-card { text-align: center; }
    .stat-value { font-size: 32px; font-weight: 700; color: #3b82f6; }
    .stat-label { font-size: 13px; color: #94a3b8; margin-top: 4px; }
    .activity-card { margin-top: 16px; }
    .activity-list { max-height: 300px; overflow-y: auto; }
    .activity-item { display: flex; gap: 8px; padding: 8px 0; border-bottom: 1px solid #1e293b; font-size: 13px; }
    .activity-user { font-weight: 600; min-width: 80px; }
    .activity-action { flex: 1; }
    .activity-time { color: #94a3b8; white-space: nowrap; }
    .filters-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 8px; }
    .filters-row mat-form-field { width: 160px; }
    .full-width-table { width: 100%; }
    .full-width { width: 100%; }
    .form-row { display: flex; gap: 12px; }
    .form-actions { display: flex; gap: 8px; margin-top: 8px; }
    .new-issue-card { margin-bottom: 16px; }
    .issue-detail-card { margin-bottom: 16px; }
    .issue-desc { white-space: pre-wrap; background: #1e293b; padding: 12px; border-radius: 8px; }
    .linked-content { color: #3b82f6; font-size: 13px; }
    .issue-actions { display: flex; gap: 8px; margin: 16px 0; }
    .comment { padding: 12px 0; border-bottom: 1px solid #1e293b; }
    .comment-time { color: #94a3b8; font-size: 12px; margin-left: 8px; }
    .add-comment { margin-top: 16px; }
    .clickable-row { cursor: pointer; }
    .clickable-row:hover { background: rgba(255,255,255,0.04); }
    .issue-link { color: #3b82f6; cursor: pointer; text-decoration: none; }
    .issue-link:hover { text-decoration: underline; }
    .inline-select { width: 120px; }
    .invite-card { margin-bottom: 16px; }
    .invite-form { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    .invite-form mat-form-field { width: 180px; }

    /* Chips */
    .type-chip, .qa-chip, .severity-chip {
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
    .qa-open { background: #f59e0b; color: #000; }
    .qa-in_progress { background: #3b82f6; color: #fff; }
    .qa-resolved { background: #22c55e; color: #fff; }
    .qa-closed { background: #475569; color: #fff; }
    .qa-wont_fix { background: #6b7280; color: #fff; }
    .severity-critical { background: #dc2626; color: #fff; }
    .severity-high { background: #ef4444; color: #fff; }
    .severity-medium { background: #f59e0b; color: #000; }
    .severity-low { background: #22c55e; color: #fff; }
  `],
})
export class DashboardComponent implements OnInit {
  auth = inject(AuthService);
  private svc = inject(DashboardService);
  private snackBar = inject(MatSnackBar);

  loading = signal(false);
  stats = signal<DashboardStats | null>(null);
  contentItems = signal<ContentItem[]>([]);
  issues = signal<Issue[]>([]);
  users = signal<DashboardUser[]>([]);
  selectedIssue = signal<Issue | null>(null);
  issueComments = signal<IssueComment[]>([]);

  contentColumns = ['title', 'type', 'date', 'qa_status', 'actions'];
  issueColumns = ['title', 'type', 'severity', 'status', 'assignee', 'created'];
  userColumns = ['username', 'email', 'role', 'invited_by', 'created_at'];

  // Filters
  contentTypeFilter = '';
  contentQAFilter = '';
  issueStatusFilter = '';
  issueSeverityFilter = '';

  // New issue form
  showNewIssue = false;
  newIssue = { title: '', description: '', type: 'bug', severity: 'medium' };
  newComment = '';
  inviteForm = { username: '', email: '', role: 'tester' };

  ngOnInit() {
    this.loadStats();
  }

  onTabChange(index: number) {
    if (index === 0) this.loadStats();
    else if (index === 1) this.loadContent();
    else if (index === 2) this.loadIssues();
    else if (index === 3) this.loadUsers();
  }

  loadStats() {
    this.loading.set(true);
    this.svc.getStats().subscribe({
      next: s => { this.stats.set(s); this.loading.set(false); },
      error: () => { this.toast('Failed to load stats'); this.loading.set(false); },
    });
  }

  loadContent() {
    this.loading.set(true);
    this.svc.listContent({ type: this.contentTypeFilter || undefined, qa_status: this.contentQAFilter || undefined }).subscribe({
      next: r => { this.contentItems.set(r.items); this.loading.set(false); },
      error: () => { this.toast('Failed to load content'); this.loading.set(false); },
    });
  }

  changeQA(item: ContentItem, newStatus: string) {
    this.svc.updateContentQA(item.id, newStatus).subscribe({
      next: () => { this.toast(`QA status → ${newStatus}`); this.loadContent(); },
      error: (e) => this.toast(e.error?.error || 'Failed to update QA status'),
    });
  }

  loadIssues() {
    this.loading.set(true);
    this.selectedIssue.set(null);
    this.issueComments.set([]);
    this.svc.listIssues({ status: this.issueStatusFilter || undefined, severity: this.issueSeverityFilter || undefined }).subscribe({
      next: r => { this.issues.set(r.items); this.loading.set(false); },
      error: () => { this.toast('Failed to load issues'); this.loading.set(false); },
    });
  }

  selectIssue(id: number) {
    this.svc.getIssue(id).subscribe({
      next: r => { this.selectedIssue.set(r.issue); this.issueComments.set(r.comments); },
      error: () => this.toast('Failed to load issue'),
    });
  }

  createIssue() {
    this.svc.createIssue(this.newIssue).subscribe({
      next: () => {
        this.toast('Issue created');
        this.showNewIssue = false;
        this.newIssue = { title: '', description: '', type: 'bug', severity: 'medium' };
        this.loadIssues();
      },
      error: (e) => this.toast(e.error?.error || 'Failed to create issue'),
    });
  }

  updateIssueStatus(id: number, status: string) {
    this.svc.updateIssue(id, { status }).subscribe({
      next: () => { this.toast(`Status → ${status}`); this.selectIssue(id); this.loadIssues(); },
      error: (e) => this.toast(e.error?.error || 'Failed to update status'),
    });
  }

  addComment() {
    const issue = this.selectedIssue();
    if (!issue || !this.newComment.trim()) return;
    this.svc.addComment(issue.id, this.newComment).subscribe({
      next: (r) => {
        this.issueComments.update(c => [...c, r.comment]);
        this.newComment = '';
      },
      error: () => this.toast('Failed to add comment'),
    });
  }

  loadUsers() {
    if (!this.auth.hasRole('admin')) return;
    this.loading.set(true);
    this.svc.listUsers().subscribe({
      next: r => { this.users.set(r.users); this.loading.set(false); },
      error: () => { this.toast('Failed to load users'); this.loading.set(false); },
    });
  }

  inviteUser() {
    if (!this.inviteForm.username || !this.inviteForm.email) return;
    this.svc.inviteUser(this.inviteForm).subscribe({
      next: (r) => {
        this.toast(r.message);
        this.inviteForm = { username: '', email: '', role: 'tester' };
        this.loadUsers();
      },
      error: (e) => this.toast(e.error?.error || 'Failed to invite user'),
    });
  }

  changeUserRole(userId: number, role: string) {
    this.svc.updateUserRole(userId, role).subscribe({
      next: (r) => this.toast(`${r.username} → ${r.role}`),
      error: (e) => { this.toast(e.error?.error || 'Failed to change role'); this.loadUsers(); },
    });
  }

  private toast(msg: string) {
    this.snackBar.open(msg, 'OK', { duration: 3000 });
  }
}
