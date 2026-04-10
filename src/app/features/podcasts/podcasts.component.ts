import { Component, computed, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContentService } from '../../shared/services/content.service';

@Component({
  selector: 'app-podcasts',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="podcasts-page">
      <div class="page-header">
        <h1 class="page-title">Podcasts</h1>
        <p class="page-sub">Tech Decoded by AmtocSoft — {{ episodes().length }} episodes</p>
      </div>

      <div class="episode-list">
        @for (ep of episodes(); track ep.id; let i = $index) {
          <div class="episode-row">
            <span class="ep-num">{{ episodes().length - i }}</span>
            <div class="ep-info">
              <div class="ep-title">{{ ep.title }}</div>
              <div class="ep-meta">
                <span class="ep-date">{{ ep.date }}</span>
                @if (ep.duration) { <span class="ep-sep">·</span><span class="ep-dur">{{ ep.duration }}</span> }
              </div>
            </div>
            <div class="ep-links">
              <a [href]="ep.youtubeUrl" target="_blank" rel="noopener" class="ep-btn">▶ Listen</a>
              @if (ep.spotifyUrl) {
                <a [href]="ep.spotifyUrl" target="_blank" rel="noopener" class="ep-btn spotify-btn">Spotify</a>
              }
              <a [routerLink]="['/podcasts', ep.id]" class="ep-btn transcript-btn">Transcript</a>
            </div>
          </div>
        }
      </div>

      @if (episodes().length === 0) {
        <p class="empty">No podcast episodes yet. Stay tuned!</p>
      }
    </div>
  `,
  styles: [`
    .podcasts-page { max-width: 800px; margin: 0 auto; padding: 2.5rem 1.5rem; }
    .page-header { margin-bottom: 2rem; }
    .page-title { font-size: 2rem; font-weight: 800; color: var(--text-primary); margin: 0 0 0.25rem; }
    .page-sub { color: var(--text-secondary); font-size: 0.9rem; margin: 0; }

    .episode-list { display: flex; flex-direction: column; gap: 0; }
    .episode-row {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1.1rem 0;
      border-bottom: 1px solid var(--border-color);
      transition: background 0.15s;
    }
    .episode-row:hover { background: var(--bg-surface); padding-left: 0.5rem; border-radius: 8px; }
    .ep-num {
      font-size: 1rem;
      font-weight: 800;
      color: var(--text-accent);
      min-width: 2.5rem;
      text-align: center;
      flex-shrink: 0;
    }
    .ep-info { flex: 1; min-width: 0; }
    .ep-title { font-size: 0.95rem; font-weight: 600; color: var(--text-primary); line-height: 1.35; margin-bottom: 0.25rem; }
    .ep-meta { display: flex; align-items: center; gap: 0.4rem; }
    .ep-date, .ep-dur { font-size: 0.75rem; color: var(--text-secondary); }
    .ep-sep { color: var(--text-secondary); font-size: 0.75rem; }
    .ep-links { display: flex; gap: 0.4rem; flex-shrink: 0; flex-wrap: wrap; }
    .ep-btn {
      padding: 0.3rem 0.75rem;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 0.75rem;
      font-weight: 500;
      white-space: nowrap;
      transition: all 0.15s;
    }
    .ep-btn:hover { border-color: var(--accent); color: var(--text-accent); }
    .spotify-btn { color: #1db954 !important; border-color: #1db954 !important; }
    .transcript-btn {}
    .empty { text-align: center; color: var(--text-secondary); padding: 3rem; }

    @media (max-width: 560px) {
      .episode-row { flex-wrap: wrap; }
      .ep-links { width: 100%; padding-left: 3.5rem; }
    }
  `],
})
export class PodcastsComponent implements OnInit {
  private cs = inject(ContentService);
  episodes = computed(() => this.cs.videos().filter(v => v.type === 'podcast'));
  ngOnInit(): void { this.cs.load(); }
}

export default PodcastsComponent;
