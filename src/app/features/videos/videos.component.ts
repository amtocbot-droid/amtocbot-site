import { Component, computed, inject, OnInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { ContentService } from '../../shared/services/content.service';

@Component({
  selector: 'app-videos',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatChipsModule, MatIconModule],
  template: `
    <div class="videos-page">
      <h1 class="page-title">Videos, Shorts & Podcast</h1>

      <h2 class="section-title">YouTube Videos</h2>
      <div class="card-grid">
        @for (video of videoList(); track video.id) {
          <mat-card class="video-card">
            <img [src]="getThumbnail(video.youtubeUrl)"
                 [alt]="video.title"
                 class="video-thumb" />
            <mat-card-header>
              <mat-card-title>{{ video.title }}</mat-card-title>
              <mat-card-subtitle>{{ video.duration }}</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              <mat-chip-set>
                <mat-chip [class]="'level-' + video.level.toLowerCase()">
                  {{ video.level }}
                </mat-chip>
              </mat-chip-set>
            </mat-card-content>
            <mat-card-actions>
              <a mat-button [href]="video.youtubeUrl" target="_blank" rel="noopener">
                <mat-icon>play_circle</mat-icon> Watch on YouTube
              </a>
            </mat-card-actions>
          </mat-card>
        }
      </div>

      @if (shortsList().length > 0) {
        <h2 class="section-title shorts-heading">YouTube Shorts</h2>
        <div class="card-grid shorts-grid">
          @for (short of shortsList(); track short.id) {
            <mat-card class="video-card short-card">
              <img [src]="getThumbnail(short.youtubeUrl)"
                   [alt]="short.title"
                   class="video-thumb short-thumb" />
              <mat-card-header>
                <mat-card-title class="short-title">{{ short.title }}</mat-card-title>
                <mat-card-subtitle>{{ short.duration }}</mat-card-subtitle>
              </mat-card-header>
              <mat-card-actions>
                <a mat-button [href]="short.youtubeUrl" target="_blank" rel="noopener">
                  <mat-icon>play_circle</mat-icon> Watch
                </a>
              </mat-card-actions>
            </mat-card>
          }
        </div>
      }

      @if (podcastList().length > 0) {
        <h2 class="section-title podcast-heading">Podcast</h2>
        <div class="card-grid">
          @for (ep of podcastList(); track ep.id) {
            <mat-card class="video-card podcast-card">
              <img [src]="getThumbnail(ep.youtubeUrl)"
                   [alt]="ep.title"
                   class="video-thumb" />
              <mat-card-header>
                <mat-card-title>{{ ep.title }}</mat-card-title>
                <mat-card-subtitle>{{ ep.duration }}</mat-card-subtitle>
              </mat-card-header>
              <mat-card-content>
                <mat-chip-set>
                  <mat-chip class="podcast-chip">Podcast</mat-chip>
                </mat-chip-set>
              </mat-card-content>
              <mat-card-actions>
                <a mat-button [href]="ep.youtubeUrl" target="_blank" rel="noopener">
                  <mat-icon>headphones</mat-icon> Listen
                </a>
              </mat-card-actions>
            </mat-card>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .videos-page {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2.5rem 1.5rem;
    }

    .page-title {
      font-size: 2rem;
      font-weight: 700;
      color: #1e293b;
      margin: 0 0 1.5rem;
    }

    .section-title {
      font-size: 1.3rem;
      font-weight: 600;
      color: #334155;
      margin: 0 0 1.25rem;
    }

    .podcast-heading { margin-top: 3rem; }

    .card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1.5rem;
    }

    .video-card {
      transition: box-shadow 0.2s ease;
    }
    .video-card:hover {
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    }

    .video-thumb {
      width: 100%;
      aspect-ratio: 16 / 9;
      object-fit: cover;
      border-radius: 4px 4px 0 0;
    }

    .shorts-heading { margin-top: 3rem; }

    .shorts-grid {
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    }

    .short-card {
      max-width: 220px;
    }

    .short-thumb {
      aspect-ratio: 9 / 16 !important;
    }

    .short-title {
      font-size: 0.9rem !important;
    }

    .podcast-chip {
      background: #7c3aed !important;
      color: #fff !important;
    }
  `],
})
export class VideosComponent implements OnInit {
  private content = inject(ContentService);

  videoList = computed(() => this.content.videos().filter(v => v.type === 'video'));
  shortsList = computed(() => this.content.videos().filter(v => v.type === 'short'));
  podcastList = computed(() => this.content.videos().filter(v => v.type === 'podcast'));

  ngOnInit(): void {
    this.content.load();
  }

  getThumbnail(url: string): string {
    const id = url.split('/').pop() ?? '';
    return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  }
}

export default VideosComponent;
