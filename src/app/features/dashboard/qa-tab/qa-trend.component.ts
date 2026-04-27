import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { NgxEchartsDirective } from 'ngx-echarts';

interface TrendRun {
  run_id: number;
  finished_at: string;
  total_pass: number;
  total_fail: number;
  total_na: number;
  total_checks: number;
}

@Component({
  selector: 'app-qa-trend',
  standalone: true,
  imports: [CommonModule, NgxEchartsDirective],
  template: `
    <div class="qa-trend-chart">
      <h3 class="chart-title">QA Run Trend (last 30 runs)</h3>
      @if (loading) {
        <div class="chart-loading">Loading trend data…</div>
      } @else if (error) {
        <div class="chart-error">{{ error }}</div>
      } @else {
        <div echarts [options]="chartOptions" class="echart" style="height:280px;width:100%"></div>
      }
    </div>
  `,
  styles: [`
    .qa-trend-chart { padding: 8px 0; }
    .chart-title { font-size: 14px; font-weight: 500; margin: 0 0 12px; color: var(--mat-sys-on-surface); }
    .chart-loading, .chart-error { height: 280px; display: flex; align-items: center; justify-content: center;
      font-size: 13px; color: var(--mat-sys-outline); }
    .chart-error { color: var(--mat-sys-error); }
  `],
})
export class QaTrendComponent implements OnInit {
  private http = inject(HttpClient);

  loading = true;
  error: string | null = null;
  chartOptions: any = {};

  ngOnInit(): void {
    this.http.get<{ runs: TrendRun[] }>('/api/dashboard/qa/history/trend?limit=30').subscribe({
      next: ({ runs }) => {
        this.loading = false;
        if (!runs.length) { this.error = 'No run history yet.'; return; }
        const labels = runs.map(r => r.finished_at.slice(5, 10));
        this.chartOptions = {
          tooltip: { trigger: 'axis' },
          legend: { data: ['Pass', 'Fail', 'N/A'], bottom: 0 },
          grid: { left: 40, right: 20, top: 20, bottom: 36 },
          xAxis: { type: 'category', data: labels, axisLabel: { rotate: 45, fontSize: 11 } },
          yAxis: { type: 'value', name: 'Checks', nameTextStyle: { fontSize: 11 } },
          series: [
            { name: 'Pass', type: 'line', smooth: true, data: runs.map(r => r.total_pass),
              lineStyle: { color: '#4caf50' }, itemStyle: { color: '#4caf50' }, areaStyle: { opacity: 0.08 } },
            { name: 'Fail', type: 'line', smooth: true, data: runs.map(r => r.total_fail),
              lineStyle: { color: '#f44336' }, itemStyle: { color: '#f44336' }, areaStyle: { opacity: 0.08 } },
            { name: 'N/A', type: 'line', smooth: true, data: runs.map(r => r.total_na),
              lineStyle: { color: '#9e9e9e', type: 'dashed' }, itemStyle: { color: '#9e9e9e' } },
          ],
        };
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.error ?? 'Failed to load trend data.';
      },
    });
  }
}
