import { Component, inject, signal, computed, OnInit } from '@angular/core';
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
import { MatDividerModule } from '@angular/material/divider';
import { AuthService, type Permission } from '../../shared/services/auth.service';
import { DashboardService, type DashboardStats, type ContentItem, type ContentDetail, type ContentFeedback, type CreateContentBody, type Issue, type IssueComment, type DashboardUser } from './dashboard.service';
import { ReferralsTabComponent } from './referrals-tab/referrals-tab.component';
import { AdminTabComponent } from './admin-tab/admin-tab.component';
import { AuditLogTabComponent } from './audit-log-tab/audit-log-tab.component';
import { TutorialComponent } from './tutorial/tutorial.component';
import { TutorialService } from './tutorial/tutorial.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatButtonModule, MatIconModule, MatTabsModule, MatTableModule,
    MatSelectModule, MatFormFieldModule, MatInputModule, MatChipsModule,
    MatProgressBarModule, MatDialogModule, MatSnackBarModule, MatDividerModule,
    ReferralsTabComponent,
    AdminTabComponent,
    AuditLogTabComponent,
    TutorialComponent,
  ],
  template: `
    <div class="dashboard-container">
      <div class="dashboard-header">
        <h1>Dashboard</h1>
        <span class="role-badge">{{ auth.role() }}</span>
        <span class="user-name">{{ auth.username() }}</span>
        <button mat-stroked-button class="help-btn" (click)="tutorial.start()" aria-label="Help tour">
          <mat-icon>help_outline</mat-icon> Help
        </button>
      </div>

      <!-- Tutorial overlay -->
      <app-tutorial />

      @if (loading()) {
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
      }

      <mat-tab-group [(selectedIndex)]="selectedTabIndex" (selectedTabChange)="onTabChange($event.index)" animationDuration="200ms">
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
              @if (auth.hasRole('admin', 'superadmin')) {
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

            @if (showCreateContent) {
              <!-- Create Content Form -->
              <mat-card class="create-content-card">
                <mat-card-header>
                  <mat-card-title>New Content</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Title *</mat-label>
                    <input matInput [(ngModel)]="newContent.title" placeholder="Enter content title" />
                  </mat-form-field>
                  <div class="form-row">
                    <mat-form-field appearance="outline">
                      <mat-label>Type *</mat-label>
                      <mat-select [(ngModel)]="newContent.type">
                        <mat-option value="blog">Blog</mat-option>
                        <mat-option value="video">Video</mat-option>
                        <mat-option value="short">Short</mat-option>
                        <mat-option value="podcast">Podcast</mat-option>
                      </mat-select>
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Date *</mat-label>
                      <input matInput type="date" [(ngModel)]="newContent.date" />
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Level</mat-label>
                      <mat-select [(ngModel)]="newContent.level">
                        <mat-option value="">— None —</mat-option>
                        <mat-option value="Beginner">Beginner</mat-option>
                        <mat-option value="Intermediate">Intermediate</mat-option>
                        <mat-option value="Advanced">Advanced</mat-option>
                        <mat-option value="Professional">Professional</mat-option>
                      </mat-select>
                    </mat-form-field>
                  </div>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Topic / Tags</mat-label>
                    <input matInput [(ngModel)]="newContent.topic" placeholder="e.g. TypeScript, AI" />
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>External URL</mat-label>
                    <input matInput [(ngModel)]="newContent.external_url" placeholder="https://..." />
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Body / Draft Content</mat-label>
                    <textarea matInput [(ngModel)]="newContent.body_draft" rows="6" placeholder="Paste draft body text here..."></textarea>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Reviewer Instructions</mat-label>
                    <textarea matInput [(ngModel)]="newContent.reviewer_instructions" rows="3" placeholder="Instructions for testers: what to check, focus areas..."></textarea>
                  </mat-form-field>
                  <div class="form-actions">
                    <button mat-raised-button color="primary" (click)="createContent()" [disabled]="!newContent.title || !newContent.type || !newContent.date">
                      <mat-icon>add</mat-icon> Create Content
                    </button>
                    <button mat-stroked-button (click)="showCreateContent = false">Cancel</button>
                  </div>
                </mat-card-content>
              </mat-card>
            } @else if (selectedContent()) {
              <!-- Content Detail Panel -->
              <mat-card class="content-detail-card">
                <mat-card-content>
                  <!-- Header row -->
                  <div class="detail-header">
                    <button mat-stroked-button (click)="selectedContent.set(null); contentFeedback.set([])">
                      <mat-icon>arrow_back</mat-icon> Back to list
                    </button>
                    <span class="qa-chip qa-{{ selectedContent()!.qa_status }}">{{ selectedContent()!.qa_status }}</span>
                    <span class="type-chip type-{{ selectedContent()!.type }}">{{ selectedContent()!.type }}</span>
                  </div>

                  <!-- Content metadata -->
                  <h2 class="content-title">{{ selectedContent()!.title }}</h2>
                  <div class="content-meta">
                    <span>{{ selectedContent()!.date }}</span>
                    @if (selectedContent()!.level) { <span class="meta-sep">·</span> <span>{{ selectedContent()!.level }}</span> }
                    @if (selectedContent()!.topic) { <span class="meta-sep">·</span> <span>{{ selectedContent()!.topic }}</span> }
                  </div>

                  <!-- Reviewer Instructions — highlighted block -->
                  @if (selectedContent()!.reviewer_instructions) {
                    <div class="reviewer-instructions">
                      <div class="ri-label"><mat-icon>assignment</mat-icon> Reviewer Instructions</div>
                      <div class="ri-body">{{ selectedContent()!.reviewer_instructions }}</div>
                    </div>
                  }

                  <!-- Body draft or external URL -->
                  @if (selectedContent()!.description) {
                    <div class="body-draft">
                      <h4>Draft Content</h4>
                      <pre class="draft-text">{{ selectedContent()!.description }}</pre>
                    </div>
                  }
                  @if (selectedContent()!.external_url) {
                    <div class="external-link">
                      <mat-icon>open_in_new</mat-icon>
                      <a [href]="selectedContent()!.external_url" target="_blank" rel="noopener">View External Content</a>
                    </div>
                  }
                  @if (!selectedContent()!.description && !selectedContent()!.external_url) {
                    <p class="no-body">No body draft or external URL provided.</p>
                  }

                  <mat-divider style="margin: 16px 0"></mat-divider>

                  <!-- QA Actions -->
                  <div class="issue-actions">
                    @if (auth.hasPermission('content.qa.update') && (selectedContent()!.qa_status === 'draft' || selectedContent()!.qa_status === 'flagged' || selectedContent()!.qa_status === 'rejected')) {
                      <button mat-raised-button color="primary" (click)="changeQASelected('in_review')">Submit for Review</button>
                    }
                    @if (auth.hasPermission('content.qa.update') && selectedContent()!.qa_status !== 'flagged') {
                      <button mat-stroked-button color="warn" (click)="changeQASelected('flagged')">Flag</button>
                    }
                    @if (auth.hasPermission('content.qa.approve') && selectedContent()!.qa_status === 'in_review') {
                      <button mat-raised-button color="primary" (click)="changeQASelected('approved')">Approve</button>
                      <button mat-stroked-button color="warn" (click)="changeQASelected('rejected')">Reject</button>
                    }
                    @if (auth.hasRole('admin', 'superadmin') && selectedContent()!.qa_status === 'approved') {
                      <button mat-raised-button color="accent" (click)="changeQASelected('published')">Publish</button>
                    }
                    @if (auth.hasPermission('content.delete')) {
                      <button mat-stroked-button color="warn" (click)="deleteContentPermanently(selectedContent()!.id)">
                        <mat-icon>delete_forever</mat-icon> Delete Permanently
                      </button>
                    }
                  </div>

                  <mat-divider style="margin: 16px 0"></mat-divider>

                  <!-- Feedback Thread -->
                  <h3>Feedback <span class="feedback-count">({{ contentFeedback().length }})</span></h3>

                  @for (fb of contentFeedback(); track fb.id) {
                    <div class="feedback-item feedback-{{ fb.status }}">
                      <div class="feedback-meta">
                        <strong>{{ fb.username }}</strong>
                        <span class="comment-time">{{ fb.created_at | date:'short' }}</span>
                        <span class="qa-chip qa-{{ fb.status }}" style="font-size:10px;">{{ fb.status }}</span>
                        @if (auth.hasPermission('content.qa.approve') && fb.status === 'open') {
                          <button mat-button color="primary" class="resolve-btn" (click)="resolveFeedback(fb.id, 'resolved')">Resolve</button>
                        }
                        @if (auth.hasPermission('content.qa.approve') && fb.status === 'resolved') {
                          <button mat-button class="resolve-btn" (click)="resolveFeedback(fb.id, 'open')">Reopen</button>
                        }
                      </div>
                      <p class="feedback-body">{{ fb.body }}</p>
                    </div>
                  }

                  @if (contentFeedback().length === 0) {
                    <p class="no-feedback">No feedback yet.</p>
                  }

                  <!-- Add Feedback -->
                  @if (auth.hasPermission('content.qa.update')) {
                    <div class="add-comment">
                      <mat-form-field appearance="outline" class="full-width">
                        <mat-label>Add feedback</mat-label>
                        <textarea matInput [(ngModel)]="newFeedback" rows="3" placeholder="Describe what you checked, issues found, suggestions..."></textarea>
                      </mat-form-field>
                      <button mat-raised-button color="primary" (click)="addFeedback()" [disabled]="!newFeedback.trim()">Post Feedback</button>
                    </div>
                  }

                </mat-card-content>
              </mat-card>
            } @else {
              <!-- Filters + Content List -->
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
                @if (auth.hasPermission('content.qa.update')) {
                  <button mat-raised-button color="primary" (click)="showCreateContent = true">
                    <mat-icon>add</mat-icon> New Content
                  </button>
                }
              </div>

              <!-- QA Status summary bar -->
              @if (contentItems().length > 0) {
                <div class="qa-summary-bar">
                  @for (s of qaStatusSummary(); track s.status) {
                    <span class="qa-summary-pill qa-{{ s.status }}" (click)="contentQAFilter = s.status; loadContent()">
                      {{ s.count }} {{ s.label }}
                    </span>
                  }
                  <span class="qa-summary-total">{{ contentItems().length }} total</span>
                </div>
              }

              <table mat-table [dataSource]="contentItems()" class="full-width-table qa-table">
                <ng-container matColumnDef="title">
                  <th mat-header-cell *matHeaderCellDef>Title</th>
                  <td mat-cell *matCellDef="let item" class="title-td">
                    <a class="issue-link" (click)="selectContent(item.id)">{{ item.title }}</a>
                  </td>
                </ng-container>
                <ng-container matColumnDef="type">
                  <th mat-header-cell *matHeaderCellDef>Type</th>
                  <td mat-cell *matCellDef="let item">
                    <span class="type-chip type-{{ item.type }}">{{ item.type }}</span>
                  </td>
                </ng-container>
                <ng-container matColumnDef="date">
                  <th mat-header-cell *matHeaderCellDef>Date</th>
                  <td mat-cell *matCellDef="let item" class="date-td">{{ item.date }}</td>
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
                    <div class="action-group">
                      @if (auth.hasPermission('content.qa.update') && (item.qa_status === 'draft' || item.qa_status === 'flagged' || item.qa_status === 'rejected')) {
                        <button class="qa-action-btn qa-action-submit" (click)="$event.stopPropagation(); changeQA(item, 'in_review')">
                          <mat-icon>rate_review</mat-icon> Review
                        </button>
                      }
                      @if (auth.hasPermission('content.qa.update') && item.qa_status !== 'flagged') {
                        <button class="qa-action-btn qa-action-flag" (click)="$event.stopPropagation(); changeQA(item, 'flagged')">
                          <mat-icon>flag</mat-icon>
                        </button>
                      }
                      @if (auth.hasPermission('content.qa.approve') && item.qa_status === 'in_review') {
                        <button class="qa-action-btn qa-action-approve" (click)="$event.stopPropagation(); changeQA(item, 'approved')">
                          <mat-icon>check</mat-icon> Approve
                        </button>
                        <button class="qa-action-btn qa-action-reject" (click)="$event.stopPropagation(); changeQA(item, 'rejected')">
                          <mat-icon>close</mat-icon> Reject
                        </button>
                      }
                      @if (auth.hasRole('admin', 'superadmin') && item.qa_status === 'approved') {
                        <button class="qa-action-btn qa-action-publish" (click)="$event.stopPropagation(); changeQA(item, 'published')">
                          <mat-icon>publish</mat-icon> Publish
                        </button>
                      }
                      @if (auth.hasPermission('issues.create')) {
                        <button class="qa-action-btn qa-action-bug" title="Report Issue" (click)="$event.stopPropagation(); reportIssueFromContent(item)">
                          <mat-icon>bug_report</mat-icon>
                        </button>
                      }
                    </div>
                  </td>
                </ng-container>
                <tr mat-header-row *matHeaderRowDef="contentColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: contentColumns;"
                    (click)="selectContent(row.id)"
                    class="clickable-row qa-row"
                    [class]="'qa-row qa-row-' + row.qa_status"></tr>
              </table>
            }

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
                <mat-card-header>
                  <mat-card-title>{{ newIssue.content_id ? 'Report Issue' : 'New Issue' }}</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  @if (newIssue.content_id) {
                    <div class="linked-content-banner">
                      <mat-icon>link</mat-icon>
                      <span>Linked to: <strong>{{ newIssue.contentTitle }}</strong></span>
                    </div>
                  }
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Title</mat-label>
                    <input matInput [(ngModel)]="newIssue.title" />
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Description</mat-label>
                    <textarea matInput [(ngModel)]="newIssue.description" rows="3" placeholder="Describe the issue..."></textarea>
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
                    <button mat-stroked-button (click)="cancelNewIssue()">Cancel</button>
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
        @if (auth.hasRole('admin', 'superadmin')) {
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
        @if ((auth.role() === 'admin' || auth.role() === 'superadmin')) {
          <mat-tab label="Referrals">
            <div class="tab-content">
              <app-referrals-tab />
            </div>
          </mat-tab>
        }

        <!-- Admin Controls Tab — admin only -->
        @if ((auth.role() === 'admin' || auth.role() === 'superadmin')) {
          <mat-tab label="Admin Controls">
            <div class="tab-content">
              <app-admin-tab />
            </div>
          </mat-tab>
        }

        @if (auth.hasPermission('audit.view')) {
          <mat-tab label="Audit Log">
            <div class="tab-content">
              <app-audit-log-tab />
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
    .user-name { color: #94a3b8; font-size: 14px; flex: 1; }
    .help-btn { margin-left: auto; color: #94a3b8; border-color: #334155; font-size: 13px; }
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
    /* QA / status chips — semantic colour palette */
    .qa-draft      { background: rgba(71,85,105,0.35);   color: #94a3b8;  border: 1px solid rgba(71,85,105,0.5);   }
    .qa-in_review  { background: rgba(245,158,11,0.2);   color: #fbbf24;  border: 1px solid rgba(245,158,11,0.4);  }
    .qa-approved   { background: rgba(34,197,94,0.2);    color: #4ade80;  border: 1px solid rgba(34,197,94,0.4);   }
    .qa-published  { background: rgba(6,182,212,0.2);    color: #22d3ee;  border: 1px solid rgba(6,182,212,0.4);   }
    .qa-flagged    { background: rgba(249,115,22,0.2);   color: #fb923c;  border: 1px solid rgba(249,115,22,0.4);  }
    .qa-rejected   { background: rgba(239,68,68,0.2);    color: #f87171;  border: 1px solid rgba(239,68,68,0.4);   }
    .qa-open       { background: rgba(245,158,11,0.2);   color: #fbbf24;  border: 1px solid rgba(245,158,11,0.4);  }
    .qa-in_progress{ background: rgba(59,130,246,0.2);   color: #60a5fa;  border: 1px solid rgba(59,130,246,0.4);  }
    .qa-resolved   { background: rgba(34,197,94,0.2);    color: #4ade80;  border: 1px solid rgba(34,197,94,0.4);   }
    .qa-closed     { background: rgba(71,85,105,0.35);   color: #94a3b8;  border: 1px solid rgba(71,85,105,0.5);   }
    .qa-wont_fix   { background: rgba(107,114,128,0.25); color: #9ca3af;  border: 1px solid rgba(107,114,128,0.4); }
    .severity-critical { background: #dc2626; color: #fff; }
    .severity-high { background: #ef4444; color: #fff; }
    .severity-medium { background: #f59e0b; color: #000; }
    .severity-low { background: #22c55e; color: #fff; }

    /* Content create / detail */
    .create-content-card { margin-bottom: 16px; }
    .content-detail-card { margin-bottom: 16px; }
    .detail-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
    .content-title { margin: 0 0 8px 0; font-size: 22px; font-weight: 700; }
    .content-meta { color: #94a3b8; font-size: 13px; margin-bottom: 16px; }
    .meta-sep { margin: 0 4px; }
    .reviewer-instructions {
      background: #422006; border: 1px solid #f59e0b; border-radius: 8px;
      padding: 16px; margin: 16px 0;
    }
    .ri-label { display: flex; align-items: center; gap: 6px; font-weight: 700; color: #f59e0b; margin-bottom: 8px; font-size: 14px; }
    .ri-label mat-icon { font-size: 18px; height: 18px; width: 18px; }
    .ri-body { color: #fde68a; white-space: pre-wrap; line-height: 1.6; }
    .body-draft { margin: 16px 0; }
    .body-draft h4 { margin: 0 0 8px 0; color: #94a3b8; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
    .draft-text { white-space: pre-wrap; background: #1e293b; padding: 16px; border-radius: 8px; font-family: inherit; font-size: 14px; line-height: 1.6; max-height: 400px; overflow-y: auto; margin: 0; }
    .external-link { display: flex; align-items: center; gap: 6px; margin: 12px 0; color: #3b82f6; }
    .external-link a { color: #3b82f6; text-decoration: none; }
    .external-link a:hover { text-decoration: underline; }
    .no-body { color: #64748b; font-style: italic; }
    .feedback-count { font-size: 14px; color: #64748b; font-weight: 400; }
    .feedback-item { padding: 12px; margin: 8px 0; border-radius: 8px; background: #1e293b; }
    .feedback-open { border-left: 3px solid #f59e0b; }
    .feedback-resolved { border-left: 3px solid #22c55e; opacity: 0.7; }
    .feedback-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
    .feedback-body { margin: 0; white-space: pre-wrap; font-size: 14px; line-height: 1.5; }
    .resolve-btn { height: 24px; font-size: 11px; line-height: 24px; padding: 0 8px; }
    .no-feedback { color: #64748b; font-style: italic; font-size: 14px; }
    .linked-content-banner {
      display: flex; align-items: center; gap: 8px;
      background: #1e3a5f; border: 1px solid #3b82f6; border-radius: 8px;
      padding: 10px 14px; margin-bottom: 14px; font-size: 13px; color: #93c5fd;
    }
    .linked-content-banner mat-icon { font-size: 16px; height: 16px; width: 16px; color: #3b82f6; }
    .linked-content-banner strong { color: #e2e8f0; }

    /* ── QA status summary bar ─── */
    .qa-summary-bar {
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
      padding: 10px 0 8px; margin-bottom: 4px;
    }
    .qa-summary-pill {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 3px 10px; border-radius: 10px; font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.4px; cursor: pointer; transition: opacity 0.15s;
    }
    .qa-summary-pill:hover { opacity: 0.8; }
    .qa-summary-total { margin-left: auto; color: #475569; font-size: 12px; }

    /* ── QA table row color coding ─── */
    .qa-table .qa-row { border-left: 3px solid transparent; transition: border-color 0.15s; }
    .qa-table .qa-row-flagged   { border-left-color: #f97316 !important; }
    .qa-table .qa-row-rejected  { border-left-color: #ef4444 !important; }
    .qa-table .qa-row-in_review { border-left-color: #f59e0b !important; }
    .qa-table .qa-row-approved  { border-left-color: #22c55e !important; }
    .qa-table .qa-row-draft     { border-left-color: #475569 !important; }
    .qa-table .qa-row-published { border-left-color: #22d3ee !important; }
    .qa-table .qa-row-flagged td   { background: rgba(249,115,22,0.04); }
    .qa-table .qa-row-rejected td  { background: rgba(239,68,68,0.04); }
    .qa-table .qa-row-in_review td { background: rgba(245,158,11,0.04); }

    .title-td { max-width: 320px; }
    .date-td { white-space: nowrap; color: #64748b; font-size: 12px; }

    /* ── QA action buttons ─── */
    .action-group { display: flex; align-items: center; gap: 5px; flex-wrap: nowrap; }
    .qa-action-btn {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 3px 9px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer;
      border: 1px solid transparent; white-space: nowrap; transition: all 0.15s;
    }
    .qa-action-btn mat-icon { font-size: 13px; height: 13px; width: 13px; }
    .qa-action-submit  { background: rgba(59,130,246,0.12);  color: #60a5fa;  border-color: rgba(59,130,246,0.3);  }
    .qa-action-flag    { background: rgba(249,115,22,0.12);  color: #fb923c;  border-color: rgba(249,115,22,0.3);  }
    .qa-action-approve { background: rgba(34,197,94,0.12);   color: #4ade80;  border-color: rgba(34,197,94,0.3);   }
    .qa-action-reject  { background: rgba(239,68,68,0.12);   color: #f87171;  border-color: rgba(239,68,68,0.3);   }
    .qa-action-publish { background: rgba(34,211,238,0.12);  color: #22d3ee;  border-color: rgba(34,211,238,0.3);  }
    .qa-action-bug     { background: rgba(239,68,68,0.08);   color: #f87171;  border-color: rgba(239,68,68,0.2);   padding: 3px 6px; }
    .qa-action-btn:hover { filter: brightness(1.15); }
  `],
})
export class DashboardComponent implements OnInit {
  auth = inject(AuthService);
  tutorial = inject(TutorialService);
  private svc = inject(DashboardService);
  private snackBar = inject(MatSnackBar);

  loading = signal(false);
  stats = signal<DashboardStats | null>(null);
  contentItems = signal<ContentItem[]>([]);
  issues = signal<Issue[]>([]);
  users = signal<DashboardUser[]>([]);
  selectedIssue = signal<Issue | null>(null);
  issueComments = signal<IssueComment[]>([]);

  // Content detail + feedback
  selectedContent = signal<ContentDetail | null>(null);
  contentFeedback = signal<ContentFeedback[]>([]);
  showCreateContent = false;
  newContent: CreateContentBody = { title: '', type: 'blog', date: new Date().toISOString().slice(0, 10) };
  newFeedback = '';

  contentColumns = ['title', 'type', 'date', 'qa_status', 'actions'];
  issueColumns = ['title', 'type', 'severity', 'status', 'assignee', 'created'];
  userColumns = ['username', 'email', 'role', 'invited_by', 'created_at'];

  // Tab index (for programmatic switching)
  selectedTabIndex = 0;

  // Filters
  contentTypeFilter = '';
  contentQAFilter = '';
  issueStatusFilter = '';
  issueSeverityFilter = '';

  // New issue form (content_id + contentTitle are optional, used when reporting from a content row)
  showNewIssue = false;
  newIssue: { title: string; description: string; type: string; severity: string; content_id?: string; contentTitle?: string } =
    { title: '', description: '', type: 'bug', severity: 'medium' };
  newComment = '';
  inviteForm = { username: '', email: '', role: 'tester' };

  ngOnInit() {
    this.loadStats();
    // Auto-start tutorial for first-time visitors per role
    setTimeout(() => this.tutorial.maybeAutoStart(), 500);
  }

  onTabChange(index: number) {
    // Tab order: 0=Overview, 1=ContentQA, 2=Issues, 3=Users(admin), 4=Referrals(admin), 5=AdminControls(admin)
    // For non-admins: 0=Overview, 1=ContentQA, 2=Issues
    if (index === 0) this.loadStats();
    else if (index === 1) this.loadContent();
    else if (index === 2) this.loadIssues();
    else if (index === 3 && this.auth.hasRole('admin', 'superadmin')) this.loadUsers();
    // Referrals (index 4) and Admin Controls (index 5) load themselves
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

  selectContent(id: string) {
    this.svc.getContent(id).subscribe({
      next: r => {
        this.selectedContent.set(r.content);
        this.loadContentFeedback(id);
      },
      error: () => this.toast('Failed to load content'),
    });
  }

  loadContentFeedback(contentId: string) {
    this.svc.listContentFeedback(contentId).subscribe({
      next: r => this.contentFeedback.set(r.items),
      error: () => {},
    });
  }

  createContent() {
    if (!this.newContent.title || !this.newContent.type || !this.newContent.date) return;
    this.svc.createContent(this.newContent).subscribe({
      next: (r) => {
        this.toast('Content created');
        this.showCreateContent = false;
        this.newContent = { title: '', type: 'blog', date: new Date().toISOString().slice(0, 10) };
        this.loadContent();
      },
      error: (e) => this.toast(e.error?.error || 'Failed to create content'),
    });
  }

  addFeedback() {
    const content = this.selectedContent();
    if (!content || !this.newFeedback.trim()) return;
    this.svc.addContentFeedback(content.id, this.newFeedback).subscribe({
      next: (r) => {
        this.contentFeedback.update(f => [...f, r.item]);
        this.newFeedback = '';
      },
      error: () => this.toast('Failed to add feedback'),
    });
  }

  resolveFeedback(feedbackId: number, status: 'open' | 'resolved') {
    const content = this.selectedContent();
    if (!content) return;
    this.svc.resolveContentFeedback(content.id, feedbackId, status).subscribe({
      next: () => this.loadContentFeedback(content.id),
      error: (e) => this.toast(e.error?.error || 'Failed to update feedback'),
    });
  }

  changeQASelected(newStatus: string) {
    const content = this.selectedContent();
    if (!content) return;
    this.svc.updateContentQA(content.id, newStatus).subscribe({
      next: (r) => {
        this.toast(`QA status → ${newStatus}`);
        this.selectedContent.update(c => c ? { ...c, qa_status: r.qa_status } : null);
        this.loadContent();
      },
      error: (e) => this.toast(e.error?.error || 'Failed to update QA status'),
    });
  }

  deleteContentPermanently(id: string): void {
    if (!confirm('Permanently delete this content? This cannot be undone.')) return;
    this.svc.deleteContent(id).subscribe({
      next: () => {
        this.toast('Content permanently deleted');
        this.selectedContent.set(null);
        this.contentFeedback.set([]);
        this.loadContent();
      },
      error: (e: { error?: { error?: string } }) =>
        this.toast(e?.error?.error || 'Failed to delete content'),
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

  reportIssueFromContent(item: ContentItem) {
    const typeLabel = item.type.charAt(0).toUpperCase() + item.type.slice(1);
    this.newIssue = {
      title: `[${typeLabel}] ${item.title}`,
      description: '',
      type: 'content_fix',
      severity: 'medium',
      content_id: item.id,
      contentTitle: item.title,
    };
    this.showNewIssue = true;
    // Switch to Issues tab (index 2 for all roles)
    this.selectedTabIndex = 2;
    if (this.issues().length === 0) this.loadIssues();
  }

  cancelNewIssue() {
    this.showNewIssue = false;
    this.newIssue = { title: '', description: '', type: 'bug', severity: 'medium' };
  }

  createIssue() {
    const { contentTitle, ...payload } = this.newIssue;
    this.svc.createIssue(payload).subscribe({
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
    if (!this.auth.hasRole('admin', 'superadmin')) return;
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

  qaStatusSummary = computed(() => {
    const counts: Record<string, number> = {};
    for (const item of this.contentItems()) {
      counts[item.qa_status] = (counts[item.qa_status] ?? 0) + 1;
    }
    const order = ['flagged', 'rejected', 'in_review', 'draft', 'approved', 'published'];
    const labels: Record<string, string> = {
      flagged: 'Flagged', rejected: 'Rejected', in_review: 'In Review',
      draft: 'Draft', approved: 'Approved', published: 'Published',
    };
    return order
      .filter(s => counts[s])
      .map(s => ({ status: s, label: labels[s] ?? s, count: counts[s] }));
  });

  private toast(msg: string) {
    this.snackBar.open(msg, 'OK', { duration: 3000 });
  }
}
