import { Component, computed, inject, OnInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { ContentService } from '../../shared/services/content.service';

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
          <span class="stat-value">{{ totalBlogs() }}</span>
          <span class="stat-label">Blog Posts</span>
        </mat-card>
        <mat-card class="stat-card">
          <mat-icon class="stat-icon">play_circle</mat-icon>
          <span class="stat-value">{{ totalVideos() }}</span>
          <span class="stat-label">Videos</span>
        </mat-card>
        <mat-card class="stat-card">
          <mat-icon class="stat-icon">language</mat-icon>
          <span class="stat-value">{{ totalPlatforms() }}</span>
          <span class="stat-label">Platforms</span>
        </mat-card>
      </div>

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
    .metrics-page {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2.5rem 1.5rem;
    }

    .page-title {
      font-size: 2rem;
      font-weight: 700;
      color: #1e293b;
      margin: 0 0 2rem;
    }

    .section-title {
      font-size: 1.3rem;
      font-weight: 600;
      color: #334155;
      margin: 2.5rem 0 1rem;
    }

    .stats-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1.5rem;
    }

    .stat-card {
      text-align: center;
      padding: 2rem 1rem;
    }

    .stat-icon {
      color: #1e40af;
      font-size: 2rem;
      width: 32px;
      height: 32px;
      margin-bottom: 0.5rem;
    }

    .stat-value {
      display: block;
      font-size: 2.5rem;
      font-weight: 800;
      color: #1e40af;
    }

    .stat-label {
      font-size: 0.85rem;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

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
      color: #1e293b;
    }

    .summary-label {
      color: #64748b;
      font-size: 0.85rem;
      margin: 0 0 1rem;
    }

    .summary-stats {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      font-size: 0.95rem;
      color: #334155;
    }

    .summary-stats strong {
      color: #1e40af;
    }
  `],
})
export class MetricsComponent implements OnInit {
  content = inject(ContentService);

  displayedColumns = ['name', 'target', 'current', 'progress', 'status'];

  totalBlogs = computed(() => this.content.blogs().length);
  totalVideos = computed(() => this.content.videos().filter(v => v.type === 'video').length);
  totalPlatforms = computed(() => this.content.platforms().length);

  ngOnInit(): void {
    this.content.load();
  }

  getProgress(current: number, target: number): number {
    return Math.min(100, Math.round((current / target) * 100));
  }
}

export default MetricsComponent;
