import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { ContentService } from '../../shared/services/content.service';

interface PlatformMetric {
  platform: string;
  followers: number;
  totalViews: number;
  lastUpdated: string;
}

interface MetricsApiResponse {
  metrics: { metrics: PlatformMetric[]; lastRefreshed: string } | null;
  syncStatus: { lastSync: string; blogs: number; videos: number; shorts: number; podcasts: number } | null;
}

@Component({
  selector: 'app-metrics',
  standalone: true,
  imports: [MatCardModule, MatChipsModule, MatTableModule, MatProgressBarModule, MatIconModule],
  template: `
    <div class="metrics-page">
      <h1 class="page-title">Growth Dashboard</h1>

      <div class="stats-row">
        <mat-card class="stat-card">
          <mat-icon class="stat-icon">article</mat-icon>
          <span class="stat-value">{{ liveBlogs() }}</span>
          <span class="stat-label">Blog Posts</span>
        </mat-card>
        <mat-card class="stat-card">
          <mat-icon class="stat-icon">play_circle</mat-icon>
          <span class="stat-value">{{ liveVideos() }}</span>
          <span class="stat-label">Videos</span>
        </mat-card>
        <mat-card class="stat-card">
          <mat-icon class="stat-icon">short_text</mat-icon>
          <span class="stat-value">{{ liveShorts() }}</span>
          <span class="stat-label">Shorts</span>
        </mat-card>
        <mat-card class="stat-card">
          <mat-icon class="stat-icon">podcasts</mat-icon>
          <span class="stat-value">{{ livePodcasts() }}</span>
          <span class="stat-label">Podcasts</span>
        </mat-card>
        <mat-card class="stat-card">
          <mat-icon class="stat-icon">language</mat-icon>
          <span class="stat-value">{{ totalPlatforms() }}</span>
          <span class="stat-label">Platforms</span>
        </mat-card>
      </div>

      <!-- Platform Metrics from KV -->
      <h2 class="section-title">Platform Metrics</h2>
      @if (platformLoading()) {
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
      }
      @if (platformMetrics().length > 0) {
        <table mat-table [dataSource]="platformMetrics()" class="platform-table">
          <ng-container matColumnDef="platform">
            <th mat-header-cell *matHeaderCellDef>Platform</th>
            <td mat-cell *matCellDef="let m">{{ m.platform }}</td>
          </ng-container>
          <ng-container matColumnDef="followers">
            <th mat-header-cell *matHeaderCellDef>Followers</th>
            <td mat-cell *matCellDef="let m">{{ m.followers }}</td>
          </ng-container>
          <ng-container matColumnDef="totalViews">
            <th mat-header-cell *matHeaderCellDef>Total Views</th>
            <td mat-cell *matCellDef="let m">{{ m.totalViews }}</td>
          </ng-container>
          <ng-container matColumnDef="lastUpdated">
            <th mat-header-cell *matHeaderCellDef>Updated</th>
            <td mat-cell *matCellDef="let m">{{ m.lastUpdated }}</td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="platformColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: platformColumns"></tr>
        </table>
      } @else if (!platformLoading()) {
        <p class="no-data">No platform metrics cached yet. Run "Refresh Metrics" from the admin dashboard.</p>
      }

      @if (metricsLastRefreshed()) {
        <p class="refresh-time">Metrics last refreshed: {{ metricsLastRefreshed() }}</p>
      }

      <h2 class="section-title">Milestones</h2>
      <table mat-table [dataSource]="content.milestones()" class="milestone-table">
        <ng-container matColumnDef="name">
          <th mat-header-cell *matHeaderCellDef>Milestone</th>
          <td mat-cell *matCellDef="let m">{{ m.name }}</td>
        </ng-container>

        <ng-container matColumnDef="target">
          <th mat-header-cell *matHeaderCellDef>Target</th>
          <td mat-cell *matCellDef="let m">{{ m.target }}</td>
        </ng-container>

        <ng-container matColumnDef="current">
          <th mat-header-cell *matHeaderCellDef>Current</th>
          <td mat-cell *matCellDef="let m">{{ m.current }}</td>
        </ng-container>

        <ng-container matColumnDef="progress">
          <th mat-header-cell *matHeaderCellDef>Progress</th>
          <td mat-cell *matCellDef="let m">
            @if (m.target > 0) {
              <mat-progress-bar
                mode="determinate"
                [value]="getProgress(m.current, m.target)">
              </mat-progress-bar>
            }
          </td>
        </ng-container>

        <ng-container matColumnDef="status">
          <th mat-header-cell *matHeaderCellDef>Status</th>
          <td mat-cell *matCellDef="let m">
            <mat-chip [class]="m.status === 'Done' ? 'status-done' : 'status-pending'">
              {{ m.status }}
            </mat-chip>
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
      </table>

      <div class="summary-row">
        @if (content.weeklySummary(); as ws) {
          <mat-card class="summary-card">
            <h3>Weekly Summary</h3>
            <p class="summary-label">{{ ws.week }}</p>
            <div class="summary-stats">
              <span><strong>{{ ws.blogs }}</strong> blogs</span>
              <span><strong>{{ ws.videos }}</strong> videos</span>
              <span><strong>{{ ws.podcasts }}</strong> podcasts</span>
              <span><strong>{{ ws.socialPosts }}</strong> social posts</span>
            </div>
          </mat-card>
        }

        @if (content.monthlySummary(); as ms) {
          <mat-card class="summary-card">
            <h3>Monthly Summary</h3>
            <p class="summary-label">{{ ms.month }}</p>
            <div class="summary-stats">
              <span><strong>{{ ms.blogs }}</strong> blogs</span>
              <span><strong>{{ ms.videos }}</strong> videos</span>
              <span><strong>{{ ms.podcasts }}</strong> podcasts</span>
            </div>
          </mat-card>
        }
      </div>
    </div>
  `,
  styles: [`
    .metrics-page { max-width: 1200px; margin: 0 auto; padding: 2.5rem 1.5rem; }
    .page-title { font-size: 2rem; font-weight: 800; color: var(--text-primary); margin: 0 0 2rem; }
    .section-title { font-size: 1.2rem; font-weight: 700; color: var(--text-primary); margin: 2rem 0 1rem; }

    .stats-row {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .stat-card {
      background: var(--bg-surface) !important;
      border: 1px solid var(--border-color) !important;
      border-radius: 10px !important;
      padding: 1.25rem !important;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.4rem;
      text-align: center;
      box-shadow: none !important;
    }
    .stat-icon { color: var(--text-accent) !important; font-size: 1.5rem !important; }
    .stat-value { font-size: 1.8rem; font-weight: 800; color: var(--text-accent); }
    .stat-label { font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }

    /* Platform table */
    .platform-table {
      width: 100%;
      background: var(--bg-surface) !important;
      border: 1px solid var(--border-color);
      border-radius: 10px;
      overflow: hidden;
    }
    .platform-table th { background: var(--bg-surface-hover) !important; color: var(--text-secondary) !important; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.5px; }
    .platform-table td { color: var(--text-primary) !important; border-bottom-color: var(--border-color) !important; }

    /* Sync status */
    .sync-card {
      background: var(--bg-surface) !important;
      border: 1px solid var(--border-color) !important;
      border-radius: 10px;
      padding: 1rem 1.25rem;
      margin-top: 2rem;
    }
    .sync-status { color: var(--text-secondary); font-size: 0.85rem; }
    .last-sync { color: var(--text-accent); font-weight: 600; }

    .milestone-table {
      width: 100%;
    }

    mat-progress-bar {
      width: 120px;
    }

    .status-done {
      background: #22c55e !important;
      color: #fff !important;
    }

    .status-pending {
      background: #94a3b8 !important;
      color: #fff !important;
    }

    .summary-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1.5rem;
      margin-top: 2.5rem;
    }

    .summary-card {
      padding: 1.5rem;
    }

    .summary-card h3 {
      margin: 0 0 0.25rem;
      font-size: 1.1rem;
      color: var(--text-primary);
    }

    .summary-label {
      color: var(--text-secondary);
      font-size: 0.85rem;
      margin: 0 0 1rem;
    }

    .summary-stats {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      font-size: 0.95rem;
      color: var(--text-primary);
    }

    .summary-stats strong {
      color: var(--text-accent);
    }

    .no-data {
      color: var(--text-secondary);
      text-align: center;
      padding: 2rem;
      font-style: italic;
    }

    .refresh-time {
      font-size: 0.8rem;
      color: var(--text-secondary);
      text-align: right;
      margin-top: 0.5rem;
    }
  `],
})
export class MetricsComponent implements OnInit {
  content = inject(ContentService);
  private http = inject(HttpClient);

  displayedColumns = ['name', 'target', 'current', 'progress', 'status'];
  platformColumns = ['platform', 'followers', 'totalViews', 'lastUpdated'];

  // Live data from KV-backed API
  platformMetrics = signal<PlatformMetric[]>([]);
  platformLoading = signal(true);
  metricsLastRefreshed = signal<string | null>(null);
  private syncStatus = signal<MetricsApiResponse['syncStatus']>(null);

  liveBlogs = computed(() => this.syncStatus()?.blogs ?? this.content.blogs().length);
  liveVideos = computed(() => this.syncStatus()?.videos ?? this.content.videos().filter(v => v.type === 'video').length);
  liveShorts = computed(() => this.syncStatus()?.shorts ?? this.content.videos().filter(v => v.type === 'short').length);
  livePodcasts = computed(() => this.syncStatus()?.podcasts ?? this.content.videos().filter(v => v.type === 'podcast').length);
  totalPlatforms = computed(() => this.content.platforms().length || 8);

  ngOnInit(): void {
    this.content.load();
    this.fetchLiveMetrics();
  }

  private fetchLiveMetrics(): void {
    this.http.get<MetricsApiResponse>('/api/metrics').subscribe({
      next: (data) => {
        if (data.metrics?.metrics) {
          this.platformMetrics.set(data.metrics.metrics);
          this.metricsLastRefreshed.set(data.metrics.lastRefreshed);
        }
        if (data.syncStatus) {
          this.syncStatus.set(data.syncStatus);
        }
        this.platformLoading.set(false);
      },
      error: () => {
        this.platformLoading.set(false);
      },
    });
  }

  getProgress(current: number, target: number): number {
    return Math.min(100, Math.round((current / target) * 100));
  }
}

export default MetricsComponent;
