// src/app/features/dashboard/admin-tab/media-studio-tab.component.ts
import {
  Component, signal, computed, OnInit, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MediaStudioService, MediaItem, JobProgress } from './media-studio.service';
import { AdminService } from './admin.service';

interface ItemWithJob extends MediaItem {
  activeJobId?: string;
  jobLogs: string[];
  jobStatus: 'idle' | 'running' | 'done' | 'error';
  bgPath: string;     // user-provided background video path
  editTitle: string;
  editDesc: string;
  editTags: string;
  editPrivacy: string;
}

const STAGE_ORDER = [
  'scripted', 'narrating', 'narrated', 'assembling', 'assembled',
  'uploading', 'uploaded', 'published',
];

@Component({
  selector: 'app-media-studio-tab',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatButtonModule, MatIconModule, MatProgressBarModule,
    MatChipsModule, MatInputModule, MatFormFieldModule, MatSelectModule,
    MatExpansionModule, MatSnackBarModule, MatTooltipModule,
  ],
  template: `
    <div class="studio-root">

      <!-- Server status bar -->
      <div class="server-bar" [class.online]="svc.serverOnline()">
        <mat-icon>{{ svc.serverOnline() ? 'radio_button_checked' : 'radio_button_unchecked' }}</mat-icon>
        <span>Production Server: {{ svc.serverOnline() ? 'Online' : 'Offline' }}</span>
        @if (!svc.serverOnline()) {
          <code class="hint">python3 video/production-server.py</code>
        }
        <button mat-icon-button (click)="checkServer()" title="Re-check">
          <mat-icon>refresh</mat-icon>
        </button>
      </div>

      @if (!svc.serverOnline()) {
        <div class="offline-msg">
          <mat-icon>construction</mat-icon>
          <p>Start the local production server to use Media Studio.</p>
        </div>
      }

      @if (svc.serverOnline()) {
        <!-- Filter bar -->
        <div class="filter-bar">
          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Filter by stage</mat-label>
            <mat-select [(ngModel)]="stageFilter">
              <mat-option value="">All stages</mat-option>
              @for (s of stages; track s) {
                <mat-option [value]="s">{{ s }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Search</mat-label>
            <input matInput [(ngModel)]="searchQuery" placeholder="blog number or title">
          </mat-form-field>
          <button mat-stroked-button (click)="loadItems()" [disabled]="loading()">
            <mat-icon>sync</mat-icon> Refresh
          </button>
        </div>

        @if (loading()) {
          <mat-progress-bar mode="indeterminate" class="top-progress"></mat-progress-bar>
        }

        <!-- Item list -->
        <mat-accordion multi>
          @for (item of filteredItems(); track item.item_id) {
            <mat-expansion-panel class="item-panel">
              <mat-expansion-panel-header>
                <div class="panel-header">
                  <span class="item-id">{{ item.item_id }}</span>
                  <span class="item-title">{{ item.title }}</span>
                  <span class="stage-chip" [class]="'stage-' + item.stage">{{ item.stage }}</span>
                  @if (item.jobStatus === 'running') {
                    <mat-icon class="spin">sync</mat-icon>
                  }
                </div>
              </mat-expansion-panel-header>

              <div class="item-body">

                <!-- Script preview -->
                <div class="section-label">Script Segments ({{ item.segments.length }})</div>
                <div class="segments">
                  @for (seg of item.segments; track $index; let i = $index) {
                    <div class="segment"><span class="seg-num">{{ i + 1 }}</span>{{ seg }}</div>
                  }
                </div>

                <!-- Step 1: Narrate -->
                <div class="step-card" [class.step-done]="stageGe(item.stage, 'narrated')">
                  <div class="step-header">
                    <mat-icon>mic</mat-icon>
                    <span>Step 1 — Generate Narration</span>
                    @if (stageGe(item.stage, 'narrated')) {
                      <mat-icon class="done-icon">check_circle</mat-icon>
                    }
                  </div>
                  @if (!stageGe(item.stage, 'narrated')) {
                    <button mat-flat-button color="primary"
                      (click)="narrate(item)"
                      [disabled]="item.jobStatus === 'running'">
                      <mat-icon>play_arrow</mat-icon> Generate Audio
                    </button>
                  }
                  @if (item.audio_dir) {
                    <div class="output-path">Audio → {{ item.audio_dir }}</div>
                  }
                </div>

                <!-- Step 2: Assemble -->
                <div class="step-card" [class.step-done]="stageGe(item.stage, 'assembled')">
                  <div class="step-header">
                    <mat-icon>movie</mat-icon>
                    <span>Step 2 — Assemble Video</span>
                    @if (stageGe(item.stage, 'assembled')) {
                      <mat-icon class="done-icon">check_circle</mat-icon>
                    }
                  </div>
                  @if (stageGe(item.stage, 'narrated') && !stageGe(item.stage, 'assembled')) {
                    <mat-form-field appearance="outline" class="path-field">
                      <mat-label>Background video/image path (from Higgsfield)</mat-label>
                      <input matInput [(ngModel)]="item.bgPath"
                        placeholder="/Users/amtoc/Downloads/higgsfield-bg.mp4">
                    </mat-form-field>
                    <button mat-flat-button color="primary"
                      (click)="assemble(item)"
                      [disabled]="item.jobStatus === 'running' || !item.bgPath">
                      <mat-icon>build</mat-icon> Assemble
                    </button>
                  }
                  @if (item.output_file) {
                    <div class="output-path">Output → {{ item.output_file }}</div>
                  }
                </div>

                <!-- Step 3: Upload -->
                <div class="step-card" [class.step-done]="stageGe(item.stage, 'uploaded')">
                  <div class="step-header">
                    <mat-icon>upload</mat-icon>
                    <span>Step 3 — Upload to YouTube</span>
                    @if (stageGe(item.stage, 'uploaded')) {
                      <mat-icon class="done-icon">check_circle</mat-icon>
                    }
                  </div>
                  @if (stageGe(item.stage, 'assembled') && !stageGe(item.stage, 'uploaded')) {
                    <mat-form-field appearance="outline" class="title-field">
                      <mat-label>YouTube Title</mat-label>
                      <input matInput [(ngModel)]="item.editTitle">
                    </mat-form-field>
                    <mat-form-field appearance="outline" class="desc-field">
                      <mat-label>Description</mat-label>
                      <textarea matInput [(ngModel)]="item.editDesc" rows="3"></textarea>
                    </mat-form-field>
                    <mat-form-field appearance="outline" class="tags-field">
                      <mat-label>Tags (comma-separated)</mat-label>
                      <input matInput [(ngModel)]="item.editTags">
                    </mat-form-field>
                    <mat-form-field appearance="outline" class="privacy-field">
                      <mat-label>Privacy</mat-label>
                      <mat-select [(ngModel)]="item.editPrivacy">
                        <mat-option value="public">Public</mat-option>
                        <mat-option value="unlisted">Unlisted</mat-option>
                        <mat-option value="private">Private</mat-option>
                      </mat-select>
                    </mat-form-field>
                    <button mat-flat-button color="accent"
                      (click)="upload(item)"
                      [disabled]="item.jobStatus === 'running'">
                      <mat-icon>cloud_upload</mat-icon> Upload to YouTube
                    </button>
                  }
                  @if (item.youtube_url) {
                    <a [href]="item.youtube_url" target="_blank" class="yt-link">
                      <mat-icon>open_in_new</mat-icon> {{ item.youtube_url }}
                    </a>
                  }
                </div>

                <!-- Progress log -->
                @if (item.jobLogs.length > 0) {
                  <div class="log-panel" [class.error]="item.jobStatus === 'error'">
                    <div class="log-header">
                      <mat-icon>terminal</mat-icon>
                      <span>Progress</span>
                      <button mat-icon-button (click)="clearLogs(item)" title="Clear">
                        <mat-icon>close</mat-icon>
                      </button>
                    </div>
                    <div class="log-lines">
                      @for (line of item.jobLogs; track $index) {
                        <div class="log-line">{{ line }}</div>
                      }
                    </div>
                  </div>
                }

              </div>
            </mat-expansion-panel>
          }
        </mat-accordion>

        @if (filteredItems().length === 0 && !loading()) {
          <div class="empty">No items match the current filter.</div>
        }
      }
    </div>
  `,
  styles: [`
    .studio-root { padding: 1.5rem 0; display: flex; flex-direction: column; gap: 1rem; }

    /* Server status bar */
    .server-bar {
      display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.75rem;
      background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3);
      border-radius: 8px; font-size: 0.85rem; color: #f87171;
    }
    .server-bar.online {
      background: rgba(34,197,94,0.1); border-color: rgba(34,197,94,0.3); color: #4ade80;
    }
    .hint { font-size: 0.75rem; background: rgba(0,0,0,0.3); padding: 2px 8px; border-radius: 4px; margin-left: 0.5rem; }
    .offline-msg { display: flex; align-items: center; gap: 0.5rem; color: #94a3b8; padding: 2rem; justify-content: center; }

    /* Filter bar */
    .filter-bar { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
    .filter-field { width: 180px; }
    ::ng-deep .filter-field .mat-mdc-form-field-subscript-wrapper { display: none; }

    .top-progress { margin-bottom: 0.5rem; }

    /* Panel */
    .item-panel { background: rgba(15,23,42,0.6) !important; border: 1px solid rgba(148,163,184,0.1); }
    .panel-header { display: flex; align-items: center; gap: 0.75rem; width: 100%; overflow: hidden; }
    .item-id { font-size: 0.75rem; font-weight: 700; color: #60a5fa; white-space: nowrap; }
    .item-title { flex: 1; font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #e2e8f0; }
    .stage-chip {
      font-size: 0.65rem; font-weight: 700; text-transform: uppercase; padding: 2px 8px;
      border-radius: 4px; white-space: nowrap;
      background: rgba(148,163,184,0.15); color: #94a3b8;
    }
    .stage-narrated { background: rgba(245,158,11,0.15); color: #fbbf24; }
    .stage-assembled { background: rgba(59,130,246,0.15); color: #60a5fa; }
    .stage-uploaded { background: rgba(139,92,246,0.15); color: #a78bfa; }
    .stage-published { background: rgba(34,197,94,0.15); color: #4ade80; }
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

    /* Item body */
    .item-body { display: flex; flex-direction: column; gap: 1rem; padding: 0.5rem 0; }
    .section-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; }
    .segments { display: flex; flex-direction: column; gap: 0.4rem; }
    .segment { display: flex; gap: 0.5rem; font-size: 0.8rem; color: #cbd5e1; }
    .seg-num { color: #60a5fa; font-weight: 700; min-width: 1rem; }

    /* Steps */
    .step-card { padding: 0.75rem; background: rgba(30,41,59,0.5); border-radius: 8px; display: flex; flex-direction: column; gap: 0.5rem; }
    .step-card.step-done { opacity: 0.6; }
    .step-header { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; font-weight: 600; color: #e2e8f0; }
    .done-icon { color: #4ade80; margin-left: auto; }
    .output-path { font-size: 0.75rem; color: #94a3b8; font-family: monospace; word-break: break-all; }
    .yt-link { display: flex; align-items: center; gap: 0.25rem; color: #60a5fa; font-size: 0.8rem; text-decoration: none; }
    .yt-link:hover { text-decoration: underline; }

    /* Form fields inside steps */
    .path-field, .title-field, .desc-field, .tags-field, .privacy-field { width: 100%; }
    ::ng-deep .path-field .mat-mdc-form-field-subscript-wrapper,
    ::ng-deep .title-field .mat-mdc-form-field-subscript-wrapper,
    ::ng-deep .desc-field .mat-mdc-form-field-subscript-wrapper,
    ::ng-deep .tags-field .mat-mdc-form-field-subscript-wrapper,
    ::ng-deep .privacy-field .mat-mdc-form-field-subscript-wrapper { display: none; }

    /* Progress log */
    .log-panel { background: rgba(0,0,0,0.4); border-radius: 6px; font-family: monospace; overflow: hidden; }
    .log-panel.error { border: 1px solid rgba(239,68,68,0.4); }
    .log-header { display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.75rem; background: rgba(0,0,0,0.2); font-size: 0.75rem; color: #94a3b8; }
    .log-header span { flex: 1; }
    .log-lines { max-height: 200px; overflow-y: auto; padding: 0.5rem 0.75rem; display: flex; flex-direction: column; gap: 0.15rem; }
    .log-line { font-size: 0.75rem; color: #a3e635; white-space: pre-wrap; word-break: break-all; }

    .empty { text-align: center; color: #94a3b8; padding: 3rem; }
  `],
})
export class MediaStudioTabComponent implements OnInit {
  svc = inject(MediaStudioService);
  private snack = inject(MatSnackBar);
  private adminSvc = inject(AdminService);

  items = signal<ItemWithJob[]>([]);
  loading = signal(false);
  stageFilter = '';
  searchQuery = '';

  stages = STAGE_ORDER;

  filteredItems = computed(() => {
    let list = this.items();
    if (this.stageFilter) list = list.filter(i => i.stage === this.stageFilter);
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(i =>
        i.item_id.toLowerCase().includes(q) ||
        i.title.toLowerCase().includes(q) ||
        String(i.blog_num).includes(q)
      );
    }
    return list;
  });

  ngOnInit(): void {
    this.svc.checkServer().subscribe(online => {
      if (online) this.loadItems();
    });
  }

  checkServer(): void {
    this.svc.checkServer().subscribe(online => {
      if (online) this.loadItems();
    });
  }

  loadItems(): void {
    this.loading.set(true);
    this.svc.getItems().subscribe({
      next: (raw) => {
        this.items.set(raw.map(item => ({
          ...item,
          jobLogs: [],
          jobStatus: 'idle',
          bgPath: '',
          editTitle: item.yt_title || '',
          editDesc: item.yt_description || '',
          editTags: item.tags || '',
          editPrivacy: 'public',
        })));
        this.loading.set(false);
      },
      error: () => {
        this.snack.open('Failed to load items', 'Dismiss', { duration: 3000 });
        this.loading.set(false);
      },
    });
  }

  stageGe(itemStage: string, targetStage: string): boolean {
    return STAGE_ORDER.indexOf(itemStage) >= STAGE_ORDER.indexOf(targetStage);
  }

  narrate(item: ItemWithJob): void {
    item.jobLogs = [];
    item.jobStatus = 'running';
    this.svc.startNarrate(item.item_id).subscribe({
      next: ({ job_id }) => this.watchJob(job_id, item, 'narrated'),
      error: (e) => {
        item.jobStatus = 'error';
        item.jobLogs = [e.message];
        this.snack.open('Failed to start narration', 'Dismiss', { duration: 3000 });
      },
    });
  }

  assemble(item: ItemWithJob): void {
    item.jobLogs = [];
    item.jobStatus = 'running';
    this.svc.startAssemble(item.item_id, item.bgPath).subscribe({
      next: ({ job_id }) => this.watchJob(job_id, item, 'assembled'),
      error: (e) => {
        item.jobStatus = 'error';
        item.jobLogs = [e.message];
        this.snack.open('Failed to start assembly', 'Dismiss', { duration: 3000 });
      },
    });
  }

  upload(item: ItemWithJob): void {
    if (!item.output_file) {
      this.snack.open('No output file available. Assemble first.', 'Dismiss', { duration: 3000 });
      return;
    }
    item.jobLogs = [];
    item.jobStatus = 'running';
    this.svc.startUpload(
      item.item_id, item.output_file, item.editTitle,
      item.editDesc, item.editTags, item.editPrivacy
    ).subscribe({
      next: ({ job_id }) => this.watchJob(job_id, item, 'uploaded'),
      error: (e) => {
        item.jobStatus = 'error';
        item.jobLogs = [e.message];
        this.snack.open('Failed to start upload', 'Dismiss', { duration: 3000 });
      },
    });
  }

  private watchJob(jobId: string, item: ItemWithJob, doneStage: string): void {
    item.activeJobId = jobId;
    this.svc.watchJob(jobId).subscribe({
      next: (progress: JobProgress) => {
        item.jobLogs = [...item.jobLogs, progress.data];
        if (progress.event === 'done') {
          item.stage = doneStage;
          item.jobStatus = 'done';
          // Refresh item to get updated paths
          this.svc.getItem(item.item_id).subscribe(updated => {
            const idx = this.items().findIndex(i => i.item_id === item.item_id);
            if (idx >= 0) {
              this.items.update(all => all.map((i, n) => n === idx
                ? { ...i, ...updated, jobLogs: item.jobLogs, jobStatus: 'done' }
                : i
              ));
            }
          });
          this.snack.open(`✓ ${doneStage}`, 'Dismiss', { duration: 2500 });
          if (doneStage === 'uploaded' && progress.data) {
            this.adminSvc.updatePipelineStage(item.item_id, 'uploaded').subscribe({
              next: () => this.snack.open('Pipeline updated in D1', 'Dismiss', { duration: 2000 }),
              error: () => { /* D1 sync failure is non-fatal */ },
            });
          }
        }
      },
      error: (e: Error) => {
        item.jobLogs = [...item.jobLogs, `ERROR: ${e.message}`];
        item.jobStatus = 'error';
        this.snack.open(`Job failed: ${e.message}`, 'Dismiss', { duration: 4000 });
      },
    });
  }

  clearLogs(item: ItemWithJob): void {
    item.jobLogs = [];
    item.jobStatus = 'idle';
  }
}
