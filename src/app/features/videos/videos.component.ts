import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ContentService } from '../../shared/services/content.service';

type VideoFilter = 'all' | 'video' | 'short';
const LEVEL_COLORS: Record<string, string> = {
  'Beginner': '#22c55e', 'Intermediate': '#3b82f6', 'Advanced': '#f59e0b', 'Professional': '#ef4444',
};

@Component({
  selector: 'app-videos',
  standalone: true,
  imports: [],
  template: `
    <div class="videos-page">
      <div class="page-header">
        <h1 class="page-title">Videos</h1>
        <p class="page-sub">{{ filtered().length }} items</p>
      </div>

      <div class="filter-bar">
        <button class="chip" [class.active]="typeFilter() === 'all'" (click)="typeFilter.set('all')">All</button>
        <button class="chip" [class.active]="typeFilter() === 'video'" (click)="typeFilter.set('video')">Full Videos</button>
        <button class="chip" [class.active]="typeFilter() === 'short'" (click)="typeFilter.set('short')">Shorts</button>
      </div>

      <div class="card-grid">
        @for (v of filtered(); track v.id) {
          <a [href]="v.youtubeUrl" target="_blank" rel="noopener" class="video-card">
            <div class="thumb-wrap">
              <img [src]="thumb(v.youtubeUrl)" [alt]="v.title" class="thumb" loading="lazy" />
              @if (v.duration) {
                <span class="duration">{{ v.duration }}</span>
              }
              <span class="type-badge" [class.short-badge]="v.type === 'short'">
                {{ v.type === 'short' ? 'Short' : 'Video' }}
              </span>
            </div>
            <div class="card-body">
              <div class="card-meta">
                <span class="badge" [style.background]="levelColor(v.level)">{{ v.level }}</span>
                <span class="card-date">{{ v.date }}</span>
              </div>
              <div class="card-title">{{ v.title }}</div>
              <span class="card-cta">Watch →</span>
            </div>
          </a>
        }
      </div>

      @if (filtered().length === 0) {
        <p class="empty">No videos found.</p>
      }
    </div>
  `,
  styles: [`
    .videos-page { max-width: 1200px; margin: 0 auto; padding: 2.5rem 1.5rem; }
    .page-header { margin-bottom: 1.5rem; }
    .page-title { font-size: 2rem; font-weight: 800; color: var(--text-primary); margin: 0 0 0.25rem; }
    .page-sub { color: var(--text-secondary); font-size: 0.9rem; margin: 0; }
    .filter-bar { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 2rem; }
    .chip {
      padding: 0.3rem 0.85rem;
      border: 1px solid var(--border-color);
      border-radius: 20px;
      background: none;
      color: var(--text-secondary);
      font-size: 0.8rem;
      cursor: pointer;
      transition: all 0.15s;
    }
    .chip:hover { border-color: var(--accent); color: var(--text-accent); }
    .chip.active { background: var(--accent); border-color: var(--accent); color: #fff; }
    .card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.25rem;
    }
    .video-card {
      display: flex;
      flex-direction: column;
      text-decoration: none;
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      overflow: hidden;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .video-card:hover { border-color: var(--accent); box-shadow: var(--card-shadow); }
    .thumb-wrap { position: relative; }
    .thumb { width: 100%; aspect-ratio: 16/9; object-fit: cover; display: block; }
    .duration {
      position: absolute;
      bottom: 0.4rem;
      right: 0.4rem;
      background: rgba(0,0,0,0.75);
      color: #fff;
      font-size: 0.7rem;
      font-weight: 600;
      padding: 0.1rem 0.4rem;
      border-radius: 4px;
    }
    .type-badge {
      position: absolute;
      top: 0.4rem;
      left: 0.4rem;
      background: rgba(251,146,60,0.85);
      color: #fff;
      font-size: 0.65rem;
      font-weight: 700;
      padding: 0.1rem 0.4rem;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .short-badge { background: rgba(167,139,250,0.85) !important; }
    .card-body { padding: 0.85rem; display: flex; flex-direction: column; gap: 0.35rem; }
    .card-meta { display: flex; align-items: center; gap: 0.5rem; }
    .badge { font-size: 0.65rem; font-weight: 700; color: #fff; padding: 0.15rem 0.5rem; border-radius: 4px; }
    .card-date { font-size: 0.7rem; color: var(--text-secondary); }
    .card-title { font-size: 0.88rem; font-weight: 600; color: var(--text-primary); line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .card-cta { font-size: 0.78rem; color: var(--text-accent); font-weight: 600; margin-top: 0.25rem; }
    .empty { text-align: center; color: var(--text-secondary); padding: 3rem; }
  `],
})
export class VideosComponent implements OnInit {
  private cs = inject(ContentService);
  typeFilter = signal<VideoFilter>('all');

  filtered = computed(() => {
    const f = this.typeFilter();
    const all = this.cs.videos().filter(v => v.type === 'video' || v.type === 'short');
    return f === 'all' ? all : all.filter(v => v.type === f);
  });

  ngOnInit(): void { this.cs.load(); }
  thumb(url: string): string { return `https://img.youtube.com/vi/${url.split('/').pop() ?? ''}/hqdefault.jpg`; }
  levelColor(level: string): string { return LEVEL_COLORS[level] ?? '#6b7280'; }
}

export default VideosComponent;
