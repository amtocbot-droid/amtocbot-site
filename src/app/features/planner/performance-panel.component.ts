// src/app/features/planner/performance-panel.component.ts
import { Component, input, computed } from '@angular/core';
import { DecimalPipe, SlicePipe } from '@angular/common';
import { PerformanceSummary, TrendSource } from './planner.service';

@Component({
  selector: 'app-performance-panel',
  standalone: true,
  imports: [DecimalPipe, SlicePipe],
  template: `
    <div class="panel">
      <h3 class="panel-title">Performance Insights</h3>

      @if (perf(); as p) {
        <section>
          <h4>Top Topics</h4>
          @for (t of p.top_topics.slice(0, 5); track t.topic) {
            <div class="stat-row">
              <span class="stat-label">{{ t.topic }}</span>
              <span class="stat-value">{{ t.avg_views | number:'1.0-0' }} avg views</span>
            </div>
          }
        </section>

        <section>
          <h4>Format Performance</h4>
          @for (f of p.format_perf; track f.type) {
            <div class="stat-row">
              <span class="stat-label type-label" [class]="'type-' + f.type">{{ f.type }}</span>
              <span class="stat-value">{{ f.avg_views | number:'1.0-0' }} avg views</span>
            </div>
          }
        </section>

        <section>
          <h4>Level Distribution</h4>
          @for (l of p.level_dist; track l.level) {
            <div class="stat-row">
              <span class="stat-label">{{ l.level }}</span>
              <div class="bar-container">
                <div class="bar" [style.width.%]="levelPct(l.count)"></div>
              </div>
              <span class="stat-count">{{ l.count }}</span>
            </div>
          }
        </section>

        @if (p.recency_gaps.length > 0) {
          <section>
            <h4>Coverage Gaps (14+ days)</h4>
            <div class="gap-tags">
              @for (g of p.recency_gaps; track g) {
                <span class="gap-tag">{{ g }}</span>
              }
            </div>
          </section>
        }
      }

      @if (trends(); as t) {
        <section>
          <h4>Trending This Week</h4>
          @for (item of topTrends(); track item.title) {
            <div class="trend-row">
              <span class="trend-source">{{ item.source === 'hn' ? 'HN' : 'r/' + item.sub }}</span>
              <span class="trend-title">{{ item.title | slice:0:60 }}{{ item.title.length > 60 ? '...' : '' }}</span>
              <span class="trend-score">{{ item.score }}</span>
            </div>
          }
        </section>
      }
    </div>
  `,
  styles: [`
    .panel {
      background: #0f172a; border-radius: 8px; padding: 16px; height: 100%; overflow-y: auto;
    }
    .panel-title { color: #e2e8f0; font-size: 16px; margin: 0 0 16px 0; }
    section { margin-bottom: 16px; }
    h4 { color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 8px 0; }
    .stat-row { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; }
    .stat-label { color: #cbd5e1; font-size: 13px; }
    .stat-value { color: #60a5fa; font-size: 13px; font-weight: 500; }
    .stat-count { color: #64748b; font-size: 12px; width: 30px; text-align: right; }
    .type-label { text-transform: capitalize; }
    .type-blog { color: #3b82f6; }
    .type-video { color: #ef4444; }
    .type-short { color: #f97316; }
    .type-podcast { color: #a855f7; }
    .bar-container {
      flex: 1; height: 6px; background: #1e293b; border-radius: 3px; margin: 0 8px;
    }
    .bar { height: 100%; background: #3b82f6; border-radius: 3px; transition: width 0.3s; }
    .gap-tags { display: flex; flex-wrap: wrap; gap: 4px; }
    .gap-tag {
      font-size: 11px; padding: 2px 8px; border-radius: 4px; background: #7f1d1d; color: #fca5a5;
    }
    .trend-row {
      display: flex; gap: 6px; align-items: baseline; padding: 3px 0; font-size: 12px;
    }
    .trend-source {
      color: #64748b; font-size: 10px; min-width: 40px; text-align: right;
    }
    .trend-title { color: #cbd5e1; flex: 1; }
    .trend-score { color: #f97316; font-weight: 500; }
  `],
})
export class PerformancePanelComponent {
  performanceSummary = input<string | null>(null);
  trendSources = input<string | null>(null);

  perf = computed<PerformanceSummary | null>(() => {
    const raw = this.performanceSummary();
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  });

  trends = computed<TrendSource | null>(() => {
    const raw = this.trendSources();
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  });

  topTrends = computed(() => {
    const t = this.trends();
    if (!t) return [];
    const all = [
      ...t.reddit.map(r => ({ ...r, source: 'reddit' as const })),
      ...t.hn.map(h => ({ ...h, source: 'hn' as const, sub: undefined })),
    ];
    return all.sort((a, b) => b.score - a.score).slice(0, 8);
  });

  levelPct(count: number): number {
    const p = this.perf();
    if (!p) return 0;
    const total = p.level_dist.reduce((sum, l) => sum + l.count, 0);
    return total > 0 ? (count / total) * 100 : 0;
  }
}
