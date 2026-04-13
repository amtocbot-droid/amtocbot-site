import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../shared/services/auth.service';
import { DashboardService, type ContentItem } from '../dashboard/dashboard.service';

interface IssueForm {
  title: string;
  description: string;
  type: string;
  severity: string;
  content_id?: string;
  contentTitle?: string;
  contentType?: string;
}

const TYPE_META: Record<string, { label: string; color: string; icon: string }> = {
  blog:    { label: 'Blog',    color: '#3b82f6', icon: '📝' },
  video:   { label: 'Video',   color: '#ef4444', icon: '🎬' },
  short:   { label: 'Short',   color: '#f59e0b', icon: '⚡' },
  podcast: { label: 'Podcast', color: '#8b5cf6', icon: '🎙️' },
};

const QA_META: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label: 'Draft',      color: '#94a3b8', bg: 'rgba(71,85,105,0.3)'  },
  in_review: { label: 'In Review',  color: '#fbbf24', bg: 'rgba(245,158,11,0.2)' },
  approved:  { label: 'Approved',   color: '#4ade80', bg: 'rgba(34,197,94,0.2)'  },
  published: { label: 'Published',  color: '#22d3ee', bg: 'rgba(6,182,212,0.2)'  },
  flagged:   { label: 'Flagged',    color: '#fb923c', bg: 'rgba(249,115,22,0.25)'},
  rejected:  { label: 'Rejected',   color: '#f87171', bg: 'rgba(239,68,68,0.2)'  },
};

const ISSUE_TYPES = [
  { value: 'content_fix', label: 'Content Fix', icon: 'edit',         color: '#3b82f6' },
  { value: 'bug',         label: 'Bug',          icon: 'bug_report',   color: '#ef4444' },
  { value: 'quality',     label: 'Quality',      icon: 'star_rate',    color: '#8b5cf6' },
  { value: 'video_sync',  label: 'Video Sync',   icon: 'sync',         color: '#f97316' },
  { value: 'task',        label: 'Task',          icon: 'check_circle', color: '#64748b' },
];

const SEVERITIES = [
  { value: 'low',      label: 'Low',      desc: 'Minor polish or cosmetic',       icon: 'check_circle_outline', color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.4)'   },
  { value: 'medium',   label: 'Medium',   desc: 'Noticeable, fix soon',           icon: 'info',                 color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.4)'  },
  { value: 'high',     label: 'High',     desc: 'Major error or broken feature',  icon: 'warning',              color: '#f97316', bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.4)'  },
  { value: 'critical', label: 'Critical', desc: 'Blocks publishing or site down', icon: 'error',                color: '#ef4444', bg: 'rgba(239,68,68,0.15)',   border: 'rgba(239,68,68,0.5)'   },
];

@Component({
  selector: 'app-report',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatProgressBarModule, MatSnackBarModule],
  template: `
    <div class="report-wrap">

      <!-- ── PAGE HEADER ─────────────────────────────────────── -->
      <div class="page-header">
        <div class="header-left">
          <div class="header-icon-wrap">
            <mat-icon>bug_report</mat-icon>
          </div>
          <div>
            <h1>Report an Issue</h1>
            <p class="header-sub">Pick a content item below to file a linked report, or create a general issue.</p>
          </div>
        </div>
        <div class="header-right">
          <span class="role-pill">{{ auth.role() }}</span>
          <span class="user-pill">{{ auth.username() }}</span>
        </div>
      </div>

      @if (loading()) {
        <div class="progress-bar-wrap">
          <div class="progress-bar"></div>
        </div>
      }

      <!-- ══════════════════════════════════════════════════════ -->
      <!-- SUCCESS STATE                                          -->
      <!-- ══════════════════════════════════════════════════════ -->
      @if (submitted()) {
        <div class="success-screen">
          <div class="success-ring">
            <mat-icon>check_circle</mat-icon>
          </div>
          <h2>Issue Filed!</h2>
          @if (submittedId()) {
            <div class="success-id">#{{ submittedId() }}</div>
          }
          <p>The team has been notified. You'll be able to track progress in the Issues tab.</p>
          <div class="success-actions">
            <button class="btn-primary" (click)="reset()">
              <mat-icon>add</mat-icon> Report Another
            </button>
          </div>
        </div>
      }

      <!-- ══════════════════════════════════════════════════════ -->
      <!-- ISSUE FORM                                             -->
      <!-- ══════════════════════════════════════════════════════ -->
      @else if (showForm()) {
        <div class="form-panel">

          <!-- Back nav -->
          <button class="back-btn" (click)="backToList()">
            <mat-icon>arrow_back</mat-icon> Back to content list
          </button>

          <!-- Linked content banner -->
          @if (form.content_id) {
            <div class="linked-banner" [style.border-color]="typeColor(form.contentType)">
              <div class="linked-accent" [style.background]="typeColor(form.contentType)"></div>
              <div class="linked-inner">
                <span class="linked-label">Linked to</span>
                <span class="type-pill pill-{{ form.contentType }}">{{ typeIcon(form.contentType) }} {{ form.contentType }}</span>
                <span class="linked-title">{{ form.contentTitle }}</span>
              </div>
            </div>
          } @else {
            <div class="linked-banner general-banner">
              <div class="linked-accent" style="background: #64748b"></div>
              <div class="linked-inner">
                <span class="linked-label">General issue — not linked to specific content</span>
              </div>
            </div>
          }

          <div class="form-section">
            <label class="field-label">Issue Title <span class="req">*</span></label>
            <input
              class="text-input"
              [(ngModel)]="form.title"
              placeholder="Short, clear summary of the problem"
              (keydown.enter)="submit()"
            />
          </div>

          <div class="form-section">
            <label class="field-label">Description <span class="opt">(optional but helpful)</span></label>
            <textarea
              class="text-area"
              [(ngModel)]="form.description"
              rows="4"
              placeholder="Steps to reproduce · Expected vs actual · Which section is affected · Suggested fix..."
            ></textarea>
          </div>

          <!-- Issue Type picker -->
          <div class="form-section">
            <label class="field-label">Issue Type</label>
            <div class="type-picker">
              @for (t of issueTypes; track t.value) {
                <button
                  class="type-btn"
                  [class.active]="form.type === t.value"
                  [style.--t-color]="t.color"
                  (click)="form.type = t.value"
                >
                  <mat-icon>{{ t.icon }}</mat-icon>
                  <span>{{ t.label }}</span>
                </button>
              }
            </div>
          </div>

          <!-- Severity picker -->
          <div class="form-section">
            <label class="field-label">Severity</label>
            <div class="severity-picker">
              @for (s of severities; track s.value) {
                <button
                  class="sev-btn"
                  [class.active]="form.severity === s.value"
                  [style.--s-color]="s.color"
                  [style.--s-bg]="s.bg"
                  [style.--s-border]="s.border"
                  (click)="form.severity = s.value"
                >
                  <mat-icon>{{ s.icon }}</mat-icon>
                  <div class="sev-info">
                    <span class="sev-label">{{ s.label }}</span>
                    <span class="sev-desc">{{ s.desc }}</span>
                  </div>
                </button>
              }
            </div>
          </div>

          <!-- Submit -->
          <div class="form-actions">
            <button
              class="btn-submit"
              [class.loading]="submitting()"
              [disabled]="!form.title.trim() || submitting()"
              (click)="submit()"
            >
              @if (submitting()) {
                <span class="spinner"></span> Submitting...
              } @else {
                <mat-icon>send</mat-icon> Submit Issue
              }
            </button>
            <button class="btn-cancel" (click)="backToList()">Cancel</button>
          </div>

        </div>
      }

      <!-- ══════════════════════════════════════════════════════ -->
      <!-- CONTENT CARD GRID                                      -->
      <!-- ══════════════════════════════════════════════════════ -->
      @else {

        <!-- Filter bar -->
        <div class="filter-bar">
          <div class="filter-group">
            <span class="filter-label">Type</span>
            <div class="chip-row">
              <button class="fchip" [class.fchip-active]="typeFilter === ''" (click)="typeFilter = ''">All</button>
              @for (t of typeFilterOpts; track t.value) {
                <button
                  class="fchip fchip-type"
                  [class.fchip-active]="typeFilter === t.value"
                  [style.--fc]="t.color"
                  (click)="typeFilter = t.value"
                >{{ t.icon }} {{ t.label }}</button>
              }
            </div>
          </div>
          <div class="filter-group">
            <span class="filter-label">Status</span>
            <div class="chip-row">
              <button class="fchip" [class.fchip-active]="qaFilter === ''" (click)="qaFilter = ''">All</button>
              @for (s of qaFilterOpts; track s.value) {
                <button
                  class="fchip fchip-qa"
                  [class.fchip-active]="qaFilter === s.value"
                  [style.--fc]="s.color"
                  (click)="qaFilter = s.value"
                >{{ s.label }}</button>
              }
            </div>
          </div>
          <button class="btn-general" (click)="openGeneralIssueForm()">
            <mat-icon>add</mat-icon> General Issue
          </button>
        </div>

        <!-- Stats bar -->
        <div class="stats-bar">
          @if (flaggedCount() > 0) {
            <span class="stat-pill stat-flagged">
              <mat-icon>flag</mat-icon> {{ flaggedCount() }} flagged
            </span>
          }
          @if (inReviewCount() > 0) {
            <span class="stat-pill stat-review">
              <mat-icon>hourglass_empty</mat-icon> {{ inReviewCount() }} in review
            </span>
          }
          <span class="stat-total">{{ filteredItems().length }} items</span>
        </div>

        <!-- Card grid -->
        @if (filteredItems().length === 0 && !loading()) {
          <div class="empty-state">
            <mat-icon>search_off</mat-icon>
            <p>No content matches the selected filters.</p>
            <button class="btn-cancel" (click)="typeFilter = ''; qaFilter = ''">Clear filters</button>
          </div>
        } @else {
          <div class="card-grid">
            @for (item of filteredItems(); track item.id) {
              <div class="content-card" [style.--type-color]="typeColor(item.type)">
                <div class="card-accent"></div>
                <div class="card-top">
                  <span class="type-pill pill-{{ item.type }}">{{ typeIcon(item.type) }} {{ item.type }}</span>
                  <span class="qa-pill" [style.color]="qaColor(item.qa_status)" [style.background]="qaBg(item.qa_status)">
                    {{ qaLabel(item.qa_status) }}
                  </span>
                </div>
                <h3 class="card-title">{{ item.title }}</h3>
                <div class="card-meta">
                  <span>{{ item.date }}</span>
                  @if (item.level) { <span class="meta-sep">·</span> <span>{{ item.level }}</span> }
                  @if (item.topic) { <span class="meta-sep">·</span> <span class="meta-topic">{{ item.topic }}</span> }
                </div>
                <button class="report-btn" (click)="openForm(item)">
                  <mat-icon>bug_report</mat-icon> Report Issue
                </button>
              </div>
            }
          </div>
        }
      }
    </div>
  `,
  styles: [`
    /* ── Layout ─────────────────────────────────────────────── */
    .report-wrap {
      max-width: 1200px; margin: 0 auto; padding: 28px 16px 60px;
      font-family: inherit;
    }

    /* ── Page Header ─────────────────────────────────────────── */
    .page-header {
      display: flex; align-items: center; justify-content: space-between;
      gap: 16px; margin-bottom: 24px; flex-wrap: wrap;
    }
    .header-left { display: flex; align-items: center; gap: 16px; }
    .header-icon-wrap {
      width: 48px; height: 48px; border-radius: 12px;
      background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .header-icon-wrap mat-icon { color: #ef4444; font-size: 24px; height: 24px; width: 24px; }
    .page-header h1 { margin: 0 0 2px; font-size: 22px; font-weight: 700; color: #f1f5f9; }
    .header-sub { margin: 0; font-size: 13px; color: #64748b; }
    .header-right { display: flex; align-items: center; gap: 8px; }
    .role-pill {
      background: #1e3a5f; color: #60a5fa; border: 1px solid rgba(59,130,246,0.3);
      padding: 3px 10px; border-radius: 10px; font-size: 11px; font-weight: 700; text-transform: uppercase;
    }
    .user-pill { color: #64748b; font-size: 13px; }

    /* ── Progress Bar ─────────────────────────────────────────── */
    .progress-bar-wrap { height: 3px; background: #1e293b; border-radius: 2px; margin-bottom: 20px; overflow: hidden; }
    .progress-bar {
      height: 100%;
      background: linear-gradient(90deg, #3b82f6, #60a5fa, #3b82f6);
      background-size: 200%; animation: shimmer 1.2s infinite;
    }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

    /* ── Filter Bar ──────────────────────────────────────────── */
    .filter-bar {
      display: flex; align-items: flex-start; gap: 20px; flex-wrap: wrap;
      background: #0f172a; border: 1px solid #1e293b;
      border-radius: 12px; padding: 14px 18px; margin-bottom: 14px;
    }
    .filter-group { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .filter-label { font-size: 11px; color: #475569; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; }
    .chip-row { display: flex; gap: 6px; flex-wrap: wrap; }

    .fchip {
      padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; cursor: pointer;
      border: 1px solid #334155; background: transparent; color: #94a3b8; transition: all 0.15s;
    }
    .fchip:hover { border-color: #475569; color: #e2e8f0; }
    .fchip-active {
      border-color: var(--fc, #3b82f6) !important;
      background: color-mix(in srgb, var(--fc, #3b82f6) 15%, transparent) !important;
      color: var(--fc, #3b82f6) !important;
    }
    .fchip-type:hover { border-color: var(--fc); color: var(--fc); }
    .fchip-qa:hover { border-color: var(--fc); color: var(--fc); }

    .btn-general {
      margin-left: auto; display: flex; align-items: center; gap: 4px;
      padding: 5px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer;
      border: 1px solid #334155; background: transparent; color: #94a3b8; transition: all 0.15s;
    }
    .btn-general mat-icon { font-size: 16px; height: 16px; width: 16px; }
    .btn-general:hover { border-color: #3b82f6; color: #60a5fa; background: rgba(59,130,246,0.08); }

    /* ── Stats Bar ───────────────────────────────────────────── */
    .stats-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
    .stat-pill {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 3px 10px; border-radius: 10px; font-size: 12px; font-weight: 600;
    }
    .stat-pill mat-icon { font-size: 13px; height: 13px; width: 13px; }
    .stat-flagged { background: rgba(249,115,22,0.15); color: #fb923c; border: 1px solid rgba(249,115,22,0.3); }
    .stat-review  { background: rgba(245,158,11,0.15); color: #fbbf24; border: 1px solid rgba(245,158,11,0.3); }
    .stat-total   { color: #64748b; font-size: 12px; margin-left: auto; }

    /* ── Card Grid ───────────────────────────────────────────── */
    .card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 14px;
    }

    .content-card {
      background: #0f172a; border: 1px solid #1e293b; border-radius: 12px;
      overflow: hidden; display: flex; flex-direction: column;
      transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
      position: relative;
    }
    .content-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.3);
      border-color: color-mix(in srgb, var(--type-color) 40%, #1e293b);
    }
    .card-accent {
      height: 3px; background: var(--type-color, #3b82f6);
      flex-shrink: 0;
    }
    .card-top { display: flex; align-items: center; gap: 8px; padding: 12px 14px 6px; }
    .card-title {
      padding: 4px 14px 6px; margin: 0;
      font-size: 14px; font-weight: 600; color: #e2e8f0; line-height: 1.4;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    }
    .card-meta {
      padding: 2px 14px 10px; font-size: 12px; color: #475569;
      display: flex; align-items: center; gap: 4px; flex-wrap: wrap;
    }
    .meta-sep { color: #334155; }
    .meta-topic { color: #64748b; }
    .report-btn {
      margin: auto 14px 12px; display: flex; align-items: center; justify-content: center; gap: 6px;
      padding: 7px 0; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;
      border: 1px solid color-mix(in srgb, var(--type-color) 50%, transparent);
      background: color-mix(in srgb, var(--type-color) 10%, transparent);
      color: var(--type-color, #3b82f6);
      transition: all 0.15s;
    }
    .report-btn mat-icon { font-size: 16px; height: 16px; width: 16px; }
    .report-btn:hover {
      background: color-mix(in srgb, var(--type-color) 20%, transparent);
      border-color: var(--type-color);
    }

    /* ── Pills ───────────────────────────────────────────────── */
    .type-pill, .qa-pill {
      display: inline-flex; align-items: center; gap: 3px;
      padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 700; text-transform: uppercase;
    }
    .pill-blog    { background: rgba(59,130,246,0.2);  color: #60a5fa;  border: 1px solid rgba(59,130,246,0.3);  }
    .pill-video   { background: rgba(239,68,68,0.2);   color: #f87171;  border: 1px solid rgba(239,68,68,0.3);   }
    .pill-short   { background: rgba(245,158,11,0.2);  color: #fbbf24;  border: 1px solid rgba(245,158,11,0.3);  }
    .pill-podcast { background: rgba(139,92,246,0.2);  color: #a78bfa;  border: 1px solid rgba(139,92,246,0.3);  }
    .qa-pill { border: 1px solid currentColor; font-size: 10px; opacity: 0.85; }

    /* ── Issue Form ──────────────────────────────────────────── */
    .form-panel {
      max-width: 720px;
      background: #0f172a; border: 1px solid #1e293b;
      border-radius: 16px; padding: 28px 32px;
    }
    .back-btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 0; background: none; border: none; cursor: pointer;
      color: #3b82f6; font-size: 13px; font-weight: 500; margin-bottom: 22px;
      transition: color 0.15s;
    }
    .back-btn mat-icon { font-size: 16px; height: 16px; width: 16px; }
    .back-btn:hover { color: #60a5fa; }

    .linked-banner {
      display: flex; align-items: stretch; gap: 0;
      border: 1px solid; border-radius: 10px; overflow: hidden;
      margin-bottom: 22px;
    }
    .linked-accent { width: 4px; flex-shrink: 0; }
    .linked-inner {
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
      padding: 10px 14px; flex: 1;
      background: rgba(255,255,255,0.02);
    }
    .general-banner { border-color: #334155 !important; }
    .general-banner .linked-label { color: #64748b !important; }
    .linked-label { font-size: 11px; color: #64748b; white-space: nowrap; }
    .linked-title { font-size: 13px; color: #e2e8f0; font-weight: 500; flex: 1; min-width: 0; }

    .form-section { margin-bottom: 20px; }
    .field-label { display: block; font-size: 12px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 8px; }
    .req { color: #ef4444; }
    .opt { font-weight: 400; text-transform: none; color: #475569; letter-spacing: 0; }

    .text-input, .text-area {
      width: 100%; padding: 10px 14px; border-radius: 8px;
      background: #1e293b; border: 1px solid #334155; color: #e2e8f0;
      font-size: 14px; font-family: inherit; transition: border-color 0.15s; box-sizing: border-box;
    }
    .text-input:focus, .text-area:focus { outline: none; border-color: #3b82f6; }
    .text-input::placeholder, .text-area::placeholder { color: #475569; }
    .text-area { resize: vertical; min-height: 96px; }

    /* Type picker */
    .type-picker { display: flex; gap: 8px; flex-wrap: wrap; }
    .type-btn {
      display: flex; align-items: center; gap: 6px;
      padding: 7px 14px; border-radius: 8px; font-size: 13px; cursor: pointer;
      border: 1px solid #334155; background: #1e293b; color: #94a3b8;
      transition: all 0.15s; white-space: nowrap;
    }
    .type-btn mat-icon { font-size: 15px; height: 15px; width: 15px; }
    .type-btn:hover { border-color: var(--t-color); color: var(--t-color); background: color-mix(in srgb, var(--t-color) 10%, transparent); }
    .type-btn.active {
      border-color: var(--t-color); color: var(--t-color);
      background: color-mix(in srgb, var(--t-color) 15%, transparent);
      box-shadow: 0 0 0 1px color-mix(in srgb, var(--t-color) 40%, transparent);
    }

    /* Severity picker */
    .severity-picker { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    @media (min-width: 600px) { .severity-picker { grid-template-columns: repeat(4, 1fr); } }
    .sev-btn {
      display: flex; align-items: center; gap: 10px; padding: 10px 12px;
      border-radius: 10px; cursor: pointer; border: 1px solid #334155;
      background: #1e293b; color: #94a3b8; text-align: left; transition: all 0.15s;
    }
    .sev-btn mat-icon { font-size: 18px; height: 18px; width: 18px; flex-shrink: 0; }
    .sev-info { display: flex; flex-direction: column; min-width: 0; }
    .sev-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; }
    .sev-desc { font-size: 11px; color: #64748b; line-height: 1.3; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sev-btn:hover { border-color: var(--s-color); color: var(--s-color); background: var(--s-bg); }
    .sev-btn.active {
      border-color: var(--s-border); color: var(--s-color);
      background: var(--s-bg);
      box-shadow: 0 0 0 1px var(--s-border);
    }
    .sev-btn.active .sev-desc { color: color-mix(in srgb, var(--s-color) 70%, white); }

    /* Form actions */
    .form-actions { display: flex; gap: 10px; align-items: center; margin-top: 24px; }
    .btn-submit {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;
      background: #2563eb; border: 1px solid #3b82f6; color: #fff;
      transition: all 0.15s;
    }
    .btn-submit:hover:not(:disabled) { background: #1d4ed8; }
    .btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-submit mat-icon { font-size: 18px; height: 18px; width: 18px; }
    .btn-submit.loading { opacity: 0.7; }
    .spinner {
      display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff; border-radius: 50%; animation: spin 0.6s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .btn-cancel {
      padding: 9px 18px; border-radius: 8px; font-size: 13px; cursor: pointer;
      background: transparent; border: 1px solid #334155; color: #64748b; transition: all 0.15s;
    }
    .btn-cancel:hover { border-color: #475569; color: #94a3b8; }

    /* ── Success Screen ──────────────────────────────────────── */
    .success-screen {
      max-width: 440px; margin: 60px auto; text-align: center;
      background: #0f172a; border: 1px solid #1e293b; border-radius: 16px; padding: 48px 32px;
    }
    .success-ring {
      width: 72px; height: 72px; border-radius: 50%;
      background: rgba(34,197,94,0.15); border: 2px solid rgba(34,197,94,0.4);
      display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;
    }
    .success-ring mat-icon { font-size: 36px; height: 36px; width: 36px; color: #22c55e; }
    .success-screen h2 { margin: 0 0 6px; font-size: 22px; font-weight: 700; color: #f1f5f9; }
    .success-id {
      display: inline-block; background: #1e293b; border: 1px solid #334155;
      color: #3b82f6; font-size: 20px; font-weight: 700; padding: 6px 20px;
      border-radius: 8px; margin-bottom: 14px; font-family: monospace;
    }
    .success-screen p { color: #64748b; font-size: 14px; margin: 0 0 28px; line-height: 1.6; }
    .success-actions { display: flex; justify-content: center; }
    .btn-primary {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;
      background: #2563eb; border: 1px solid #3b82f6; color: #fff; transition: all 0.15s;
    }
    .btn-primary:hover { background: #1d4ed8; }
    .btn-primary mat-icon { font-size: 18px; height: 18px; width: 18px; }

    /* ── Empty State ─────────────────────────────────────────── */
    .empty-state {
      text-align: center; padding: 60px 24px; color: #475569;
      background: #0f172a; border: 1px dashed #1e293b; border-radius: 12px;
    }
    .empty-state mat-icon { font-size: 48px; height: 48px; width: 48px; display: block; margin: 0 auto 12px; color: #334155; }
    .empty-state p { margin: 0 0 16px; }
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

  typeFilter = '';
  qaFilter = '';

  issueTypes = ISSUE_TYPES;
  severities = SEVERITIES;
  typeFilterOpts = Object.entries(TYPE_META).map(([value, m]) => ({ value, label: m.label, color: m.color, icon: m.icon }));
  qaFilterOpts = Object.entries(QA_META).map(([value, m]) => ({ value, label: m.label, color: m.color }));

  filteredItems = computed(() => {
    let items = this.contentItems();
    if (this.typeFilter) items = items.filter(i => i.type === this.typeFilter);
    if (this.qaFilter)   items = items.filter(i => i.qa_status === this.qaFilter);
    return items;
  });

  flaggedCount  = computed(() => this.contentItems().filter(i => i.qa_status === 'flagged').length);
  inReviewCount = computed(() => this.contentItems().filter(i => i.qa_status === 'in_review').length);

  form: IssueForm = { title: '', description: '', type: 'content_fix', severity: 'medium' };

  ngOnInit() { this.loadContent(); }

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
      contentType: item.type,
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
    const { contentTitle, contentType, ...payload } = this.form;
    this.svc.createIssue(payload).subscribe({
      next: (r: any) => { this.submitting.set(false); this.submitted.set(true); this.submittedId.set(r.id ?? null); },
      error: (e: any) => { this.snack.open(e.error?.error || 'Failed to submit issue', 'OK', { duration: 4000 }); this.submitting.set(false); },
    });
  }

  reset() {
    this.submitted.set(false);
    this.submittedId.set(null);
    this.showForm.set(false);
    this.form = { title: '', description: '', type: 'content_fix', severity: 'medium' };
  }

  typeColor(type?: string) { return type ? (TYPE_META[type]?.color ?? '#3b82f6') : '#3b82f6'; }
  typeIcon(type?: string)  { return type ? (TYPE_META[type]?.icon  ?? '📄') : '📄'; }
  qaLabel(status: string)  { return QA_META[status]?.label ?? status; }
  qaColor(status: string)  { return QA_META[status]?.color ?? '#94a3b8'; }
  qaBg(status: string)     { return QA_META[status]?.bg    ?? 'rgba(71,85,105,0.3)'; }
}
