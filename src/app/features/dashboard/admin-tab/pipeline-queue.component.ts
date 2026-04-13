import { Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AdminService, PipelineItem, ContentItem } from './admin.service';

const STAGES = ['scripted', 'narrated', 'uploaded', 'published'];

@Component({
  selector: 'app-pipeline-queue',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatButtonModule, MatIconModule, MatTableModule,
    MatSelectModule, MatFormFieldModule, MatInputModule, MatChipsModule, MatSnackBarModule,
  ],
  template: `
    <div class="pipeline-tab">

      <!-- In Pipeline -->
      <mat-card class="pipeline-card">
        <mat-card-header>
          <mat-card-title>In Pipeline</mat-card-title>
          <button mat-icon-button (click)="load()" [disabled]="loading()" title="Refresh">
            <mat-icon>refresh</mat-icon>
          </button>
        </mat-card-header>
        <mat-card-content>
          @if (loading()) {
            <div class="loading-bar"></div>
          }
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Stage</th>
                  <th>Notes</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                @for (item of tracked(); track item.id) {
                  <tr>
                    <td class="title-cell" [title]="item.title">{{ truncate(item.title, 45) }}</td>
                    <td><span class="type-badge">{{ item.type }}</span></td>
                    <td class="muted date-col">{{ formatDate(item.date) }}</td>
                    <td class="stage-col">
                      <mat-form-field appearance="outline" class="stage-select">
                        <mat-select [ngModel]="item.stage" (ngModelChange)="changeStage(item, $event)">
                          @for (s of stages; track s) {
                            <mat-option [value]="s">
                              <span class="stage-opt" [class]="'stage-' + s">{{ s }}</span>
                            </mat-option>
                          }
                        </mat-select>
                      </mat-form-field>
                    </td>
                    <td class="notes-col muted">{{ item.notes || '—' }}</td>
                    <td class="muted updated-col">{{ formatDate(item.stage_updated_at) }}</td>
                  </tr>
                }
                @if (tracked().length === 0 && !loading()) {
                  <tr><td colspan="6" class="empty-cell">No items in pipeline.</td></tr>
                }
              </tbody>
            </table>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Not Yet Tracked -->
      <mat-card class="untracked-card">
        <mat-card-header>
          <mat-card-title>Not Yet Tracked</mat-card-title>
          <span class="subtitle muted">Podcasts and shorts not in pipeline</span>
        </mat-card-header>
        <mat-card-content>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Add</th>
                </tr>
              </thead>
              <tbody>
                @for (item of untracked(); track item.id) {
                  <tr>
                    <td class="title-cell" [title]="item.title">{{ truncate(item.title, 50) }}</td>
                    <td><span class="type-badge">{{ item.type }}</span></td>
                    <td class="muted">{{ formatDate(item.date) }}</td>
                    <td>
                      <button mat-stroked-button class="add-btn" (click)="add(item)" [disabled]="adding().has(item.id)">
                        <mat-icon>add</mat-icon>
                        {{ adding().has(item.id) ? 'Adding…' : 'Add' }}
                      </button>
                    </td>
                  </tr>
                }
                @if (untracked().length === 0 && !loading()) {
                  <tr><td colspan="4" class="empty-cell">All items are tracked.</td></tr>
                }
              </tbody>
            </table>
          </div>
        </mat-card-content>
      </mat-card>

    </div>
  `,
  styles: [`
    .pipeline-tab { display: flex; flex-direction: column; gap: 1.5rem; padding: 1.5rem 0; }

    .pipeline-card mat-card-header,
    .untracked-card mat-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    mat-card-title { font-size: 1rem; }
    .subtitle { font-size: 0.8rem; margin-left: 0.5rem; }

    .loading-bar {
      height: 3px;
      background: linear-gradient(90deg, #3b82f6 0%, #60a5fa 50%, #3b82f6 100%);
      background-size: 200%;
      animation: shimmer 1.2s infinite;
      border-radius: 2px;
      margin-bottom: 0.75rem;
    }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

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
      padding: 0.5rem 0.75rem;
      border-bottom: 1px solid rgba(148,163,184,0.1);
      color: #e2e8f0;
    }
    .data-table tr:hover td { background: rgba(59,130,246,0.05); }
    .empty-cell { text-align: center; color: #94a3b8; padding: 2rem; }

    .title-cell { max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .date-col, .updated-col { white-space: nowrap; font-size: 0.8rem; }
    .notes-col { max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.8rem; }

    .type-badge {
      display: inline-block;
      padding: 0.12rem 0.45rem;
      border-radius: 4px;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      background: rgba(99,102,241,0.15);
      color: #818cf8;
    }

    .stage-col { min-width: 140px; }
    .stage-select { width: 130px; }
    ::ng-deep .stage-select .mat-mdc-form-field-subscript-wrapper { display: none; }
    ::ng-deep .stage-select .mat-mdc-text-field-wrapper { padding: 0 8px; }

    .stage-opt { font-size: 0.8rem; font-weight: 600; text-transform: uppercase; }
    .stage-scripted { color: #94a3b8; }
    .stage-narrated { color: #f59e0b; }
    .stage-uploaded { color: #3b82f6; }
    .stage-published { color: #22c55e; }

    .add-btn { font-size: 0.75rem; padding: 0 8px; height: 28px; line-height: 28px; color: #3b82f6; border-color: rgba(59,130,246,0.4); }
    .add-btn:hover { background: rgba(59,130,246,0.1); }
    .add-btn mat-icon { font-size: 14px; height: 14px; width: 14px; margin-right: 2px; }

    .muted { color: #94a3b8; }
  `],
})
export class PipelineQueueComponent implements OnInit {
  private adminSvc = inject(AdminService);
  private snack = inject(MatSnackBar);

  tracked = signal<PipelineItem[]>([]);
  untracked = signal<ContentItem[]>([]);
  loading = signal(false);
  adding = signal<Set<string>>(new Set());

  stages = STAGES;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.adminSvc.getPipeline().subscribe({
      next: (res) => {
        this.tracked.set(res.tracked ?? []);
        this.untracked.set(res.untracked ?? []);
        this.loading.set(false);
      },
      error: (e) => {
        this.snack.open(e.message ?? 'Failed to load pipeline', 'Dismiss', { duration: 4000 });
        this.loading.set(false);
      },
    });
  }

  changeStage(item: PipelineItem, stage: string): void {
    this.adminSvc.updatePipelineStage(item.content_id, stage).subscribe({
      next: (res) => {
        if (res.success) {
          this.tracked.update(all => all.map(p =>
            p.id === item.id ? { ...p, stage, stage_updated_at: new Date().toISOString() } : p
          ));
          this.snack.open(`Stage updated to ${stage}`, 'Dismiss', { duration: 2000 });
        }
      },
      error: (e) => { this.snack.open(e.message ?? 'Failed', 'Dismiss', { duration: 4000 }); },
    });
  }

  add(item: ContentItem): void {
    this.adding.update(s => new Set([...s, item.id]));
    this.adminSvc.addToPipeline(item.id).subscribe({
      next: (res) => {
        if (res.success) {
          this.snack.open('Added to pipeline', 'Dismiss', { duration: 2000 });
          this.load();
        }
        this.adding.update(s => { const n = new Set(s); n.delete(item.id); return n; });
      },
      error: (e) => {
        this.snack.open(e.message ?? 'Failed', 'Dismiss', { duration: 4000 });
        this.adding.update(s => { const n = new Set(s); n.delete(item.id); return n; });
      },
    });
  }

  truncate(val: string, len: number): string {
    if (!val) return '—';
    return val.length > len ? val.slice(0, len) + '…' : val;
  }

  formatDate(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
  }
}
