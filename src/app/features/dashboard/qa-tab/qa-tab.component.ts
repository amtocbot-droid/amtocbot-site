import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { QaTrendComponent } from './qa-trend.component';
import { QaHeatmapComponent } from './qa-heatmap.component';

interface QaRun {
  id: number;
  source: string;
  started_at: string;
  finished_at: string | null;
  total_checks: number;
  total_pass: number;
  total_fail: number;
  total_na: number;
}

@Component({
  selector: 'app-qa-tab',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule, MatProgressBarModule, MatChipsModule,
    QaTrendComponent, QaHeatmapComponent,
  ],
  template: `
    <div class="qa-tab-container">

      <div class="qa-header-row">
        <h2 class="section-title">QA Traceability</h2>
        @if (latestRun()) {
          <div class="run-summary-chips">
            <mat-chip class="chip-pass">{{ latestRun()!.total_pass }} pass</mat-chip>
            <mat-chip class="chip-fail">{{ latestRun()!.total_fail }} fail</mat-chip>
            <mat-chip class="chip-na">{{ latestRun()!.total_na }} n/a</mat-chip>
            <span class="run-meta">Run #{{ latestRun()!.id }} · {{ latestRun()!.source }} · {{ latestRun()!.finished_at | date:'MMM d, HH:mm' }}</span>
          </div>
        }
      </div>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
      }

      <div class="charts-grid">
        <mat-card class="chart-card">
          <mat-card-content>
            <app-qa-trend></app-qa-trend>
          </mat-card-content>
        </mat-card>
        <mat-card class="chart-card">
          <mat-card-content>
            <app-qa-heatmap></app-qa-heatmap>
          </mat-card-content>
        </mat-card>
      </div>

      <mat-card class="matrix-placeholder-card">
        <mat-card-content>
          <p class="placeholder-text">
            Full QA matrix (content × check grid, acknowledgements, sign-off) coming in Phase 6.
          </p>
        </mat-card-content>
      </mat-card>

    </div>
  `,
  styles: [`
    .qa-tab-container { padding: 16px; }
    .qa-header-row { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
    .section-title { font-size: 18px; font-weight: 500; margin: 0; }
    .run-summary-chips { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .run-meta { font-size: 12px; color: var(--mat-sys-outline); }
    .chip-pass { background: #e8f5e9 !important; color: #2e7d32 !important; }
    .chip-fail { background: #ffebee !important; color: #c62828 !important; }
    .chip-na  { background: #f5f5f5 !important; color: #616161 !important; }
    .charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
    @media (max-width: 900px) { .charts-grid { grid-template-columns: 1fr; } }
    .chart-card, .matrix-placeholder-card { border-radius: 8px; }
    .placeholder-text { color: var(--mat-sys-outline); font-size: 13px; text-align: center; padding: 24px 0; margin: 0; }
  `],
})
export class QaTabComponent implements OnInit {
  private http = inject(HttpClient);

  loading = signal(true);
  latestRun = signal<QaRun | null>(null);

  ngOnInit(): void {
    this.http.get<{ runs: QaRun[] }>('/api/dashboard/qa/runs?limit=1').subscribe({
      next: ({ runs }) => {
        this.loading.set(false);
        this.latestRun.set(runs[0] ?? null);
      },
      error: () => this.loading.set(false),
    });
  }
}
