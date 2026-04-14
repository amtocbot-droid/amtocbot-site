// src/app/features/learn/recording/recording-feed.component.ts

import { Component, Input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

interface Recording {
  id: string;
  display_name: string;
  public_url: string;
  duration_ms: number | null;
  created_at: string;
}

@Component({
  selector: 'app-recording-feed',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="feed-container">
      <h3 class="feed-title">Community Explanations</h3>

      @if (loading()) {
        <div class="skeletons">
          @for (n of skeletonItems; track n) {
            <div class="skeleton-card">
              <div class="sk-video"></div>
              <div class="sk-meta">
                <div class="sk-line sk-name"></div>
                <div class="sk-line sk-date"></div>
              </div>
            </div>
          }
        </div>
      }

      @if (!loading() && fetchError()) {
        <p class="feed-error">Could not load recordings. Please refresh the page.</p>
      }

      @if (!loading() && !fetchError() && recordings().length === 0) {
        <div class="empty-state">
          <span class="empty-icon">🎥</span>
          <p>Be the first to share your understanding!</p>
        </div>
      }

      @if (!loading() && recordings().length > 0) {
        <div class="cards-grid">
          @for (r of recordings(); track r.id) {
            <div class="video-card">
              <video [src]="r.public_url" controls preload="metadata" class="card-video"></video>
              <div class="card-meta">
                <span class="card-name">{{ r.display_name }}</span>
                <span class="card-date">{{ formatDate(r.created_at) }}</span>
                @if (r.duration_ms) {
                  <span class="card-duration">{{ formatDuration(r.duration_ms) }}</span>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .feed-container { margin: 32px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .feed-title { color: #e2e8f0; font-size: 18px; font-weight: 700; margin: 0 0 20px; border-bottom: 1px solid #1e293b; padding-bottom: 12px; }
    .skeletons { display: flex; flex-direction: column; gap: 16px; }
    .skeleton-card { display: flex; gap: 16px; background: #0f172a; border: 1px solid #1e293b; border-radius: 10px; padding: 12px; }
    .sk-video { width: 160px; min-width: 160px; height: 90px; background: #1e293b; border-radius: 6px; animation: shimmer 1.4s infinite linear; }
    .sk-meta { flex: 1; display: flex; flex-direction: column; gap: 8px; padding-top: 8px; }
    .sk-line { height: 12px; border-radius: 4px; background: #1e293b; animation: shimmer 1.4s infinite linear; }
    .sk-name { width: 40%; }
    .sk-date { width: 25%; }
    @keyframes shimmer { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }
    .empty-state { text-align: center; padding: 40px 20px; color: #475569; display: flex; flex-direction: column; align-items: center; gap: 8px; }
    .empty-icon { font-size: 32px; }
    .empty-state p { margin: 0; font-size: 15px; }
    .cards-grid { display: flex; flex-direction: column; gap: 16px; }
    .video-card { background: #0f172a; border: 1px solid #1e293b; border-radius: 10px; overflow: hidden; }
    .card-video { width: 100%; max-height: 280px; background: #000; display: block; }
    .card-meta { padding: 12px 16px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .card-name { color: #e2e8f0; font-weight: 600; font-size: 14px; }
    .card-date { color: #64748b; font-size: 12px; }
    .card-duration { color: #64748b; font-size: 12px; background: #1e293b; padding: 2px 8px; border-radius: 12px; }
    .feed-error { color: #f87171; font-size: 14px; margin: 0; }
  `],
})
export class RecordingFeedComponent implements OnInit {
  @Input() language = '';
  @Input() level    = '';
  @Input() slug     = '';

  recordings = signal<Recording[]>([]);
  loading    = signal(true);
  fetchError = signal(false);

  readonly skeletonItems = [1, 2, 3];

  constructor(private http: HttpClient) {}

  ngOnInit(): void { this.loadRecordings(); }

  refresh(): void { this.loadRecordings(); }

  private loadRecordings(): void {
    this.loading.set(true);
    this.fetchError.set(false);
    const url = `/api/learn/${this.language}/${this.slug}/recordings?level=${this.level}`;
    this.http.get<{ recordings: Recording[] }>(url).subscribe({
      next: (res) => { this.recordings.set(res.recordings ?? []); this.loading.set(false); },
      error: () => { this.fetchError.set(true); this.loading.set(false); },
    });
  }

  formatDate(isoString: string): string {
    try {
      return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return isoString; }
  }

  formatDuration(ms: number): string {
    const total = Math.round(ms / 1000);
    const m = Math.floor(total / 60).toString().padStart(2, '0');
    const s = (total % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }
}
