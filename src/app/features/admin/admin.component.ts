import { Component, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { DatePipe } from '@angular/common';

interface SyncStatus {
  lastSync: string | null;
  blogs: number;
  videos: number;
  shorts: number;
  podcasts: number;
}

interface PlatformMetric {
  platform: string;
  followers: number;
  totalViews: number;
  lastUpdated: string;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatProgressBarModule, MatTableModule, DatePipe],
  template: `
    <div class="admin-page">
      <div class="admin-header">
        <mat-icon class="admin-icon">admin_panel_settings</mat-icon>
        <h1>Admin Dashboard</h1>
        <span class="admin-badge">Protected by Cloudflare Access</span>
      </div>

      <!-- Content Sync Section -->
      <mat-card class="admin-card">
        <mat-card-header>
          <mat-icon mat-card-avatar>sync</mat-icon>
          <mat-card-title>Content Sync</mat-card-title>
          <mat-card-subtitle>
            @if (syncStatus().lastSync) {
              Last synced: {{ syncStatus().lastSync | date:'medium' }}
            } @else {
              Never synced
            }
          </mat-card-subtitle>
        </mat-card-header>
        @if (syncing()) {
          <mat-progress-bar mode="indeterminate"></mat-progress-bar>
        }
        <mat-card-content>
          <div class="stats-row">
            <div class="stat-box">
              <span class="stat-num">{{ syncStatus().blogs }}</span>
              <span class="stat-label">Blogs</span>
            </div>
            <div class="stat-box">
              <span class="stat-num">{{ syncStatus().videos }}</span>
              <span class="stat-label">Videos</span>
            </div>
            <div class="stat-box">
              <span class="stat-num">{{ syncStatus().shorts }}</span>
              <span class="stat-label">Shorts</span>
            </div>
            <div class="stat-box">
              <span class="stat-num">{{ syncStatus().podcasts }}</span>
              <span class="stat-label">Podcasts</span>
            </div>
          </div>
        </mat-card-content>
        <mat-card-actions>
          <button mat-raised-button color="primary" (click)="syncContent()" [disabled]="syncing()">
            <mat-icon>sync</mat-icon>
            {{ syncing() ? 'Syncing...' : 'Sync Content from GitHub' }}
          </button>
        </mat-card-actions>
      </mat-card>

      <!-- Metrics Section -->
      <mat-card class="admin-card">
        <mat-card-header>
          <mat-icon mat-card-avatar>bar_chart</mat-icon>
          <mat-card-title>Platform Metrics</mat-card-title>
          <mat-card-subtitle>Pull latest stats from YouTube, TikTok, and more</mat-card-subtitle>
        </mat-card-header>
        @if (refreshingMetrics()) {
          <mat-progress-bar mode="indeterminate"></mat-progress-bar>
        }
        <mat-card-content>
          @if (metrics().length > 0) {
            <table mat-table [dataSource]="metrics()" class="metrics-table">
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
              <tr mat-header-row *matHeaderRowDef="metricsColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: metricsColumns"></tr>
            </table>
          } @else {
            <p class="no-data">Click "Refresh Metrics" to pull latest data</p>
          }
        </mat-card-content>
        <mat-card-actions>
          <button mat-raised-button color="accent" (click)="refreshMetrics()" [disabled]="refreshingMetrics()">
            <mat-icon>refresh</mat-icon>
            {{ refreshingMetrics() ? 'Refreshing...' : 'Refresh Metrics' }}
          </button>
        </mat-card-actions>
      </mat-card>

      <!-- Quick Actions -->
      <mat-card class="admin-card">
        <mat-card-header>
          <mat-icon mat-card-avatar>bolt</mat-icon>
          <mat-card-title>Quick Actions</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="actions-grid">
            <a mat-stroked-button href="https://dash.cloudflare.com" target="_blank" rel="noopener">
              <mat-icon>analytics</mat-icon> Cloudflare Analytics
            </a>
            <a mat-stroked-button href="https://studio.youtube.com" target="_blank" rel="noopener">
              <mat-icon>play_circle</mat-icon> YouTube Studio
            </a>
            <a mat-stroked-button href="https://www.tiktok.com/tiktokstudio" target="_blank" rel="noopener">
              <mat-icon>music_note</mat-icon> TikTok Studio
            </a>
            <a mat-stroked-button href="https://www.blogger.com" target="_blank" rel="noopener">
              <mat-icon>article</mat-icon> Blogger
            </a>
            <a mat-stroked-button href="https://app.brevo.com" target="_blank" rel="noopener">
              <mat-icon>email</mat-icon> Brevo (Newsletter)
            </a>
            <a mat-stroked-button href="https://github.com/amtocbot-droid/amtocsoft-content" target="_blank" rel="noopener">
              <mat-icon>code</mat-icon> GitHub Repo
            </a>
          </div>
        </mat-card-content>
      </mat-card>

      @if (statusMessage()) {
        <div class="status-toast" [class.error]="statusIsError()">
          {{ statusMessage() }}
        </div>
      }
    </div>
  `,
  styles: [`
    .admin-page {
      max-width: 1000px;
      margin: 0 auto;
      padding: 2rem 1.5rem;
    }

    .admin-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .admin-header h1 {
      font-size: 2rem;
      font-weight: 700;
      color: #1e293b;
      margin: 0;
    }

    .admin-icon {
      font-size: 2.5rem;
      width: 40px;
      height: 40px;
      color: #1e40af;
    }

    .admin-badge {
      font-size: 0.75rem;
      padding: 0.25rem 0.75rem;
      background: #dbeafe;
      color: #1e40af;
      border-radius: 12px;
      font-weight: 500;
    }

    .admin-card {
      margin-bottom: 1.5rem;
    }

    .stats-row {
      display: flex;
      gap: 2rem;
      padding: 1rem 0;
    }

    .stat-box {
      text-align: center;
      flex: 1;
    }

    .stat-num {
      display: block;
      font-size: 2rem;
      font-weight: 700;
      color: #1e40af;
    }

    .stat-label {
      font-size: 0.85rem;
      color: #64748b;
      text-transform: uppercase;
    }

    .metrics-table {
      width: 100%;
    }

    .no-data {
      color: #94a3b8;
      text-align: center;
      padding: 2rem;
      font-style: italic;
    }

    .actions-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 0.75rem;
      padding: 0.5rem 0;
    }

    .actions-grid a {
      justify-content: flex-start;
      gap: 0.5rem;
    }

    .status-toast {
      position: fixed;
      bottom: 2rem;
      left: 50%;
      transform: translateX(-50%);
      padding: 0.75rem 1.5rem;
      background: #22c55e;
      color: #fff;
      border-radius: 8px;
      font-weight: 500;
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .status-toast.error {
      background: #ef4444;
    }
  `],
})
export class AdminComponent {
  syncStatus = signal<SyncStatus>({ lastSync: null, blogs: 0, videos: 0, shorts: 0, podcasts: 0 });
  metrics = signal<PlatformMetric[]>([]);
  syncing = signal(false);
  refreshingMetrics = signal(false);
  statusMessage = signal('');
  statusIsError = signal(false);
  metricsColumns = ['platform', 'followers', 'totalViews', 'lastUpdated'];

  private showStatus(msg: string, isError = false) {
    this.statusMessage.set(msg);
    this.statusIsError.set(isError);
    setTimeout(() => this.statusMessage.set(''), 4000);
  }

  async syncContent(): Promise<void> {
    this.syncing.set(true);
    try {
      const resp = await fetch('/api/admin/sync-content', { method: 'POST' });
      if (resp.ok) {
        const data = await resp.json() as SyncStatus;
        this.syncStatus.set(data);
        this.showStatus('Content synced successfully!');
      } else {
        this.showStatus('Sync failed — check console', true);
      }
    } catch {
      this.showStatus('Network error during sync', true);
    } finally {
      this.syncing.set(false);
    }
  }

  async refreshMetrics(): Promise<void> {
    this.refreshingMetrics.set(true);
    try {
      const resp = await fetch('/api/admin/refresh-metrics', { method: 'POST' });
      if (resp.ok) {
        const data = await resp.json() as { metrics: PlatformMetric[] };
        this.metrics.set(data.metrics);
        this.showStatus('Metrics refreshed!');
      } else {
        this.showStatus('Metrics refresh failed', true);
      }
    } catch {
      this.showStatus('Network error refreshing metrics', true);
    } finally {
      this.refreshingMetrics.set(false);
    }
  }
}

export default AdminComponent;
