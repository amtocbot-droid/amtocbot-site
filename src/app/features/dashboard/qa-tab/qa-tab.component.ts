import { Component, inject, signal, computed, OnInit, DestroyRef } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { QaMatrixComponent } from './qa-matrix.component';
import { QaTodosComponent } from './qa-todos.component';
import { QaSignoffComponent } from './qa-signoff.component';
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

const CONTENT_KINDS = ['', 'tale', 'podcast', 'video', 'blog', 'tutorial', 'linkedin_article'] as const;

@Component({
  selector: 'app-qa-tab',
  standalone: true,
  imports: [
    DatePipe, FormsModule,
    MatCardModule, MatButtonModule, MatSelectModule, MatFormFieldModule,
    MatProgressBarModule, MatChipsModule, MatTabsModule, MatDividerModule, MatIconModule,
    QaMatrixComponent, QaTodosComponent, QaSignoffComponent,
    QaTrendComponent, QaHeatmapComponent,
  ],
  template: `
    <div class="qa-tab-container">

      <!-- Header row: title + run selector + kind filter -->
      <div class="qa-header-row">
        <h2 class="section-title">QA Traceability</h2>

        <div class="selectors-row">
          <mat-form-field appearance="outline" class="run-selector">
            <mat-label>Run</mat-label>
            <mat-select [value]="selectedRunId()" (valueChange)="selectedRunId.set($event)">
              <mat-option [value]="null">Latest</mat-option>
              @for (run of runs(); track run.id) {
                <mat-option [value]="run.id">
                  #{{ run.id }} · {{ run.source }} · {{ run.finished_at | date:'MMM d, HH:mm' }}
                </mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="kind-selector">
            <mat-label>Kind</mat-label>
            <mat-select [value]="kindFilter()" (valueChange)="kindFilter.set($event)">
              @for (k of contentKinds; track k) {
                <mat-option [value]="k">{{ k || 'All kinds' }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>
      </div>

      <!-- Latest run summary chips -->
      @if (latestRun()) {
        <div class="run-summary-chips">
          <mat-chip class="chip-pass">{{ latestRun()!.total_pass }} pass</mat-chip>
          <mat-chip class="chip-fail">{{ latestRun()!.total_fail }} fail</mat-chip>
          <mat-chip class="chip-na">{{ latestRun()!.total_na }} n/a</mat-chip>
          <span class="run-meta">
            Run #{{ latestRun()!.id }} · {{ latestRun()!.source }}
            @if (latestRun()!.finished_at) {
              · {{ latestRun()!.finished_at | date:'MMM d, HH:mm' }}
            }
          </span>
        </div>
      }

      @if (loading()) {
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
      }

      <!-- Main content: tabbed view -->
      <mat-tab-group animationDuration="150ms" class="qa-inner-tabs">

        <!-- Matrix tab -->
        <mat-tab label="Matrix">
          <div class="inner-tab-content">
            <app-qa-matrix
              [runId]="selectedRunId()"
              [kindFilter]="kindFilter()">
            </app-qa-matrix>
          </div>
        </mat-tab>

        <!-- Priority Fixes tab -->
        <mat-tab label="Priority Fixes">
          <div class="inner-tab-content side-by-side">
            <mat-card class="side-card">
              <mat-card-content>
                <app-qa-todos></app-qa-todos>
              </mat-card-content>
            </mat-card>
            <mat-card class="side-card">
              <mat-card-content>
                <app-qa-signoff></app-qa-signoff>
              </mat-card-content>
            </mat-card>
          </div>
        </mat-tab>

        <!-- History tab -->
        <mat-tab label="History">
          <div class="inner-tab-content charts-grid">
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
        </mat-tab>

      </mat-tab-group>

    </div>
  `,
  styles: [`
    .qa-tab-container { padding: 16px; }
    .qa-header-row { display: flex; align-items: flex-start; gap: 16px; flex-wrap: wrap; margin-bottom: 8px; }
    .section-title { font-size: 18px; font-weight: 500; margin: 0; line-height: 56px; }
    .selectors-row { display: flex; gap: 12px; flex-wrap: wrap; }
    .run-selector { min-width: 240px; }
    .kind-selector { min-width: 160px; }
    .run-summary-chips { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
    .run-meta { font-size: 12px; color: var(--mat-sys-outline); }
    .chip-pass { background: #e8f5e9 !important; color: #2e7d32 !important; }
    .chip-fail { background: #ffebee !important; color: #c62828 !important; }
    .chip-na  { background: #f5f5f5 !important; color: #616161 !important; }
    .qa-inner-tabs { margin-top: 8px; }
    .inner-tab-content { padding: 16px 0; }
    .side-by-side { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    @media (max-width: 900px) { .side-by-side { grid-template-columns: 1fr; } }
    .side-card { border-radius: 8px; }
    .charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    @media (max-width: 900px) { .charts-grid { grid-template-columns: 1fr; } }
    .chart-card { border-radius: 8px; }
  `],
})
export class QaTabComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);

  readonly contentKinds = CONTENT_KINDS;

  loading = signal(true);
  runs = signal<QaRun[]>([]);
  selectedRunId = signal<number | null>(null);
  kindFilter = signal('');

  latestRun = computed(() => [...this.runs()].sort((a, b) => b.id - a.id)[0] ?? null);

  ngOnInit(): void {
    this.http.get<{ runs: QaRun[] }>('/api/dashboard/qa/runs?limit=20')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ runs }) => { this.loading.set(false); this.runs.set(runs); },
        error: () => this.loading.set(false),
      });
  }
}
