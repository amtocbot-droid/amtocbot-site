import { Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AdminService, JobStatus, AutomationRun } from './admin.service';

@Component({
  selector: 'app-automation-controls',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule, MatButtonModule, MatIconModule, MatTableModule,
    MatChipsModule, MatSnackBarModule,
  ],
  template: `
    <div class="automation-tab">

      <!-- Global Controls -->
      <mat-card class="global-card">
        <mat-card-header>
          <mat-card-title>Automation Control</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="global-btns">
            <button mat-raised-button color="warn" (click)="pauseAll()" [disabled]="loading()">
              <mat-icon>pause_circle</mat-icon> Pause All
            </button>
            <button mat-raised-button color="primary" (click)="resumeAll()" [disabled]="loading()">
              <mat-icon>play_circle</mat-icon> Resume All
            </button>
            <button mat-icon-button (click)="loadStatus()" [disabled]="loading()" title="Refresh">
              <mat-icon>refresh</mat-icon>
            </button>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Per-Job Cards -->
      <div class="jobs-grid">
        @for (entry of jobEntries(); track entry[0]) {
          <mat-card class="job-card">
            <mat-card-header>
              <mat-card-title class="job-name">{{ entry[0] }}</mat-card-title>
              <div class="job-badges">
                @if (entry[1].paused) {
                  <span class="badge badge-paused">PAUSED</span>
                } @else {
                  <span class="badge badge-running">RUNNING</span>
                }
                @if (entry[1].trigger_requested) {
                  <span class="badge badge-trigger">TRIGGER PENDING</span>
                }
              </div>
            </mat-card-header>
            <mat-card-content>
              @if (entry[1].last_run) {
                <div class="last-run">
                  <span class="muted">Last run:</span>
                  <span>{{ formatDate(entry[1].last_run) }}</span>
                  @if (entry[1].last_status) {
                    <span class="status-chip" [class]="'chip-' + entry[1].last_status">{{ entry[1].last_status }}</span>
                  }
                </div>
              }
              <div class="job-actions">
                <button mat-stroked-button color="warn"
                  (click)="pauseJob(entry[0])"
                  [disabled]="loading() || entry[1].paused">
                  <mat-icon>pause</mat-icon> Pause
                </button>
                <button mat-stroked-button color="primary"
                  (click)="resumeJob(entry[0])"
                  [disabled]="loading() || !entry[1].paused">
                  <mat-icon>play_arrow</mat-icon> Resume
                </button>
                <button mat-stroked-button
                  (click)="triggerJob(entry[0])"
                  [disabled]="loading() || entry[1].trigger_requested">
                  <mat-icon>bolt</mat-icon> Trigger
                </button>
              </div>
            </mat-card-content>
          </mat-card>
        }
        @if (jobEntries().length === 0 && !loading()) {
          <p class="muted empty-msg">No automation jobs found.</p>
        }
      </div>

      <!-- Recent Runs -->
      <mat-card class="runs-card">
        <mat-card-header>
          <mat-card-title>Recent Runs</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Status</th>
                  <th>Summary</th>
                  <th>Started At</th>
                </tr>
              </thead>
              <tbody>
                @for (run of recentRuns(); track run.id) {
                  <tr>
                    <td class="mono">{{ run.job }}</td>
                    <td>
                      <span class="status-chip" [class]="'chip-' + run.status">{{ run.status }}</span>
                    </td>
                    <td class="muted summary-cell">{{ run.summary || '—' }}</td>
                    <td class="muted">{{ formatDate(run.started_at) }}</td>
                  </tr>
                }
                @if (recentRuns().length === 0 && !loading()) {
                  <tr><td colspan="4" class="empty-cell">No recent runs.</td></tr>
                }
              </tbody>
            </table>
          </div>
        </mat-card-content>
      </mat-card>

    </div>
  `,
  styles: [`
    .automation-tab { display: flex; flex-direction: column; gap: 1.5rem; padding: 1.5rem 0; }

    .global-card mat-card-title { font-size: 1rem; }
    .global-btns { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; padding-top: 0.5rem; }
    .global-btns button mat-icon { margin-right: 4px; }

    .jobs-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
    .job-card mat-card-header { display: flex; flex-direction: column; gap: 0.5rem; }
    .job-name { font-size: 0.95rem; font-family: monospace; color: #60a5fa; }
    .job-badges { display: flex; gap: 0.4rem; flex-wrap: wrap; }

    .badge {
      display: inline-block;
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .badge-paused { background: rgba(239,68,68,0.15); color: #ef4444; border: 1px solid rgba(239,68,68,0.3); }
    .badge-running { background: rgba(34,197,94,0.15); color: #22c55e; border: 1px solid rgba(34,197,94,0.3); }
    .badge-trigger { background: rgba(245,158,11,0.15); color: #f59e0b; border: 1px solid rgba(245,158,11,0.3); }

    .last-run { display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; margin-bottom: 0.75rem; }
    .job-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.5rem; }
    .job-actions button mat-icon { font-size: 18px; margin-right: 2px; }

    .status-chip {
      display: inline-block;
      padding: 0.1rem 0.45rem;
      border-radius: 4px;
      font-size: 0.72rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    .chip-success, .chip-completed { background: rgba(34,197,94,0.15); color: #22c55e; }
    .chip-error, .chip-failed { background: rgba(239,68,68,0.15); color: #ef4444; }
    .chip-running { background: rgba(59,130,246,0.15); color: #3b82f6; }
    .chip-skipped { background: rgba(148,163,184,0.15); color: #94a3b8; }

    .runs-card mat-card-title { font-size: 1rem; }
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
    .summary-cell { max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .mono { font-family: monospace; font-size: 0.82rem; }
    .muted { color: #94a3b8; }
    .empty-msg { color: #94a3b8; font-size: 0.9rem; grid-column: 1 / -1; }
  `],
})
export class AutomationControlsComponent implements OnInit {
  private adminSvc = inject(AdminService);
  private snack = inject(MatSnackBar);

  jobs = signal<Record<string, JobStatus>>({});
  jobEntries = signal<[string, JobStatus][]>([]);
  recentRuns = signal<AutomationRun[]>([]);
  loading = signal(false);

  ngOnInit(): void {
    this.loadStatus();
  }

  loadStatus(): void {
    this.loading.set(true);
    this.adminSvc.getAutomationStatus().subscribe({
      next: (res) => {
        this.jobs.set(res.jobs ?? {});
        this.jobEntries.set(Object.entries(res.jobs ?? {}) as [string, JobStatus][]);
        this.recentRuns.set((res.recentRuns ?? []).slice(0, 10));
        this.loading.set(false);
      },
      error: (e) => {
        this.snack.open(e.message ?? 'Failed to load automation status', 'Dismiss', { duration: 4000 });
        this.loading.set(false);
      },
    });
  }

  private reloadAfterAction(): void {
    setTimeout(() => this.loadStatus(), 1000);
  }

  pauseJob(job: string): void {
    this.loading.set(true);
    this.adminSvc.pauseJob(job).subscribe({
      next: () => { this.snack.open(`Paused: ${job}`, 'Dismiss', { duration: 2000 }); this.reloadAfterAction(); },
      error: (e) => { this.snack.open(e.message ?? 'Failed', 'Dismiss', { duration: 4000 }); this.loading.set(false); },
    });
  }

  resumeJob(job: string): void {
    this.loading.set(true);
    this.adminSvc.resumeJob(job).subscribe({
      next: () => { this.snack.open(`Resumed: ${job}`, 'Dismiss', { duration: 2000 }); this.reloadAfterAction(); },
      error: (e) => { this.snack.open(e.message ?? 'Failed', 'Dismiss', { duration: 4000 }); this.loading.set(false); },
    });
  }

  triggerJob(job: string): void {
    this.loading.set(true);
    this.adminSvc.triggerJob(job).subscribe({
      next: () => { this.snack.open(`Trigger requested: ${job}`, 'Dismiss', { duration: 2000 }); this.reloadAfterAction(); },
      error: (e) => { this.snack.open(e.message ?? 'Failed', 'Dismiss', { duration: 4000 }); this.loading.set(false); },
    });
  }

  pauseAll(): void {
    this.loading.set(true);
    this.adminSvc.pauseAll().subscribe({
      next: (res) => { this.snack.open(`Paused ${res.paused} jobs`, 'Dismiss', { duration: 2000 }); this.reloadAfterAction(); },
      error: (e) => { this.snack.open(e.message ?? 'Failed', 'Dismiss', { duration: 4000 }); this.loading.set(false); },
    });
  }

  resumeAll(): void {
    this.loading.set(true);
    this.adminSvc.resumeAll().subscribe({
      next: (res) => { this.snack.open(`Resumed ${res.resumed} jobs`, 'Dismiss', { duration: 2000 }); this.reloadAfterAction(); },
      error: (e) => { this.snack.open(e.message ?? 'Failed', 'Dismiss', { duration: 4000 }); this.loading.set(false); },
    });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}
