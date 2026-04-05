import { Component, computed, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { ContentService } from '../../shared/services/content.service';

@Component({
  selector: 'app-podcasts',
  standalone: true,
  imports: [RouterLink, MatCardModule, MatButtonModule, MatChipsModule, MatIconModule],
  template: `
    <div class="podcasts-page">
      <h1 class="page-title">Podcasts</h1>
      <p class="page-subtitle">Tech Decoded by AmtocSoft — AI, software engineering, and developer tools explained.</p>

      <div class="card-grid">
        @for (ep of podcastList(); track ep.id) {
          <mat-card class="podcast-card">
            <img [src]="getThumbnail(ep.youtubeUrl)"
                 [alt]="ep.title"
                 class="podcast-thumb" />
            <mat-card-header>
              <mat-card-title>{{ ep.title }}</mat-card-title>
              <mat-card-subtitle>{{ ep.date }} &middot; {{ ep.duration }}</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              <mat-chip-set>
                <mat-chip class="podcast-chip">Podcast</mat-chip>
                <mat-chip [class]="'level-' + ep.level.toLowerCase()">{{ ep.level }}</mat-chip>
              </mat-chip-set>
            </mat-card-content>
            <mat-card-actions>
              <a mat-button [routerLink]="['/podcasts', ep.id]">
                <mat-icon>description</mat-icon> Transcript
              </a>
              <a mat-button [href]="ep.youtubeUrl" target="_blank" rel="noopener">
                <mat-icon>play_circle</mat-icon> YouTube
              </a>
              @if (ep.spotifyUrl) {
                <a mat-button [href]="ep.spotifyUrl" target="_blank" rel="noopener">
                  <mat-icon>headphones</mat-icon> Spotify
                </a>
              }
            </mat-card-actions>
          </mat-card>
        }
      </div>

      @if (podcastList().length === 0) {
        <p class="empty-state">No podcast episodes yet. Stay tuned!</p>
      }
    </div>
  `,
  styles: [`
    .podcasts-page {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2.5rem 1.5rem;
    }

    .page-title {
      font-size: 2rem;
      font-weight: 700;
      color: #1e293b;
      margin: 0 0 0.5rem;
    }

    .page-subtitle {
      color: #64748b;
      font-size: 1.05rem;
      margin: 0 0 2rem;
    }

    .card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 1.5rem;
    }

    .podcast-card {
      transition: box-shadow 0.2s ease;
    }
    .podcast-card:hover {
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    }

    .podcast-thumb {
      width: 100%;
      aspect-ratio: 16 / 9;
      object-fit: cover;
      border-radius: 4px 4px 0 0;
    }

    .podcast-chip {
      background: #7c3aed !important;
      color: #fff !important;
    }

    .empty-state {
      text-align: center;
      color: #94a3b8;
      padding: 3rem;
      font-size: 1.1rem;
    }
  `],
})
export class PodcastsComponent implements OnInit {
  private content = inject(ContentService);

  podcastList = computed(() => this.content.videos().filter(v => v.type === 'podcast'));

  ngOnInit(): void {
    this.content.load();
  }

  getThumbnail(url: string): string {
    const id = url.split('/').pop() ?? '';
    return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  }
}

export default PodcastsComponent;
