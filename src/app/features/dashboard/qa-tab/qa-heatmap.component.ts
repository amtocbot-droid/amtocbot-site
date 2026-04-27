import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { NgxEchartsDirective } from 'ngx-echarts';

interface HeatCell {
  week: string;
  check_type: string;
  total: number;
  fail: number;
}

@Component({
  selector: 'app-qa-heatmap',
  standalone: true,
  imports: [NgxEchartsDirective],
  template: `
    <div class="qa-heatmap-chart">
      <h3 class="chart-title">Failure Heatmap — Check Type × Week</h3>
      @if (loading) {
        <div class="chart-loading">Loading heatmap…</div>
      } @else if (error) {
        <div class="chart-error">{{ error }}</div>
      } @else {
        <div echarts [options]="chartOptions" class="echart" [style.height]="chartHeight" style="width:100%"></div>
      }
    </div>
  `,
  styles: [`
    .qa-heatmap-chart { padding: 8px 0; }
    .chart-title { font-size: 14px; font-weight: 500; margin: 0 0 12px; color: var(--mat-sys-on-surface); }
    .chart-loading, .chart-error { height: 320px; display: flex; align-items: center; justify-content: center;
      font-size: 13px; color: var(--mat-sys-outline); }
    .chart-error { color: var(--mat-sys-error); }
  `],
})
export class QaHeatmapComponent implements OnInit {
  private http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);

  loading = true;
  error: string | null = null;
  chartOptions: any = {};
  chartHeight = '320px';

  ngOnInit(): void {
    this.http.get<{ heatmap: HeatCell[]; check_types: string[] }>('/api/dashboard/qa/history/heatmap?weeks=8')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
      next: ({ heatmap, check_types }) => {
        this.loading = false;
        if (!heatmap.length) { this.error = 'No heatmap data yet.'; return; }

        const weeks = [...new Set(heatmap.map(c => c.week))].sort();
        const checks = check_types;

        const data: [number, number, number][] = [];
        for (const cell of heatmap) {
          const xi = weeks.indexOf(cell.week);
          const yi = checks.indexOf(cell.check_type);
          if (xi >= 0 && yi >= 0) data.push([xi, yi, cell.fail]);
        }

        const maxFail = Math.max(...data.map(d => d[2]), 1);
        this.chartHeight = `${Math.max(280, checks.length * 28 + 60)}px`;

        this.chartOptions = {
          tooltip: {
            formatter: (p: any) => {
              const [xi, yi, fail] = p.data as [number, number, number];
              return `${checks[yi]}<br/>${weeks[xi]}<br/>Failures: <b>${fail}</b>`;
            },
          },
          grid: { left: 160, right: 20, top: 20, bottom: 60 },
          xAxis: {
            type: 'category', data: weeks.map(w => w.slice(5)),
            axisLabel: { rotate: 45, fontSize: 11 },
          },
          yAxis: {
            type: 'category', data: checks,
            axisLabel: { fontSize: 11 },
          },
          visualMap: {
            min: 0, max: maxFail, calculable: true,
            orient: 'horizontal', left: 'center', bottom: 0,
            inRange: { color: ['#f5f5f5', '#ffcdd2', '#f44336'] },
          },
          series: [{
            name: 'Failures',
            type: 'scatter',
            data,
            symbolSize: (val: any) => {
              const ratio = val[2] / maxFail;
              return Math.max(4, Math.round(ratio * 28));
            },
            itemStyle: { opacity: 0.85 },
          }],
        };
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.error ?? 'Failed to load heatmap data.';
      },
    });
  }
}
