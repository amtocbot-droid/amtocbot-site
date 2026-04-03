import { Component, computed, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { ContentService } from '../../shared/services/content.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, MatCardModule, MatButtonModule, MatChipsModule, MatIconModule],
  template: `
    <section class="hero">
      <div class="hero-inner">
        <h1 class="hero-title">AmtocBot</h1>
        <p class="hero-subtitle">Configurable AI Clone of a CEO</p>
        <p class="hero-tagline">Powered by AmtocSoft</p>
        <div class="hero-actions">
          <a mat-raised-button color="primary" routerLink="/blog">Browse Blog</a>
          <a mat-stroked-button routerLink="/videos">Watch Videos</a>
        </div>
      </div>
    </section>

    <section class="stats-bar">
      <div class="stat">
        <span class="stat-value">{{ blogCount() }}</span>
        <span class="stat-label">Blog Posts</span>
      </div>
      <div class="stat">
        <span class="stat-value">{{ videoCount() }}</span>
        <span class="stat-label">Videos</span>
      </div>
      <div class="stat">
        <span class="stat-value">{{ platformCount() }}</span>
        <span class="stat-label">Platforms</span>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">Latest Blog Posts</h2>
      <div class="card-grid">
        @for (post of latestBlogs(); track post.id) {
          <mat-card class="content-card">
            <mat-card-header>
              <mat-card-title>{{ post.title }}</mat-card-title>
              <mat-card-subtitle>{{ post.date }} &middot; {{ post.topic }}</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              <mat-chip-set>
                <mat-chip [class]="'level-' + post.level.toLowerCase()">{{ post.level }}</mat-chip>
              </mat-chip-set>
            </mat-card-content>
            <mat-card-actions>
              <a mat-button [href]="post.blogUrl" target="_blank" rel="noopener">Read Post</a>
              @if (post.youtubeUrl) {
                <a mat-icon-button [href]="post.youtubeUrl" target="_blank" rel="noopener" aria-label="Watch on YouTube">
                  <mat-icon>play_circle</mat-icon>
                </a>
              }
            </mat-card-actions>
          </mat-card>
        }
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">Latest Videos</h2>
      <div class="card-grid">
        @for (video of latestVideos(); track video.id) {
          <mat-card class="content-card video-card">
            <img [src]="getThumbnail(video.youtubeUrl)" [alt]="video.title" class="video-thumb" />
            <mat-card-header>
              <mat-card-title>{{ video.title }}</mat-card-title>
              <mat-card-subtitle>{{ video.duration }}</mat-card-subtitle>
            </mat-card-header>
            <mat-card-actions>
              <a mat-button [href]="video.youtubeUrl" target="_blank" rel="noopener">
                <mat-icon>play_circle</mat-icon> Watch
              </a>
            </mat-card-actions>
          </mat-card>
        }
      </div>
    </section>

    <section class="section platforms-section">
      <h2 class="section-title">Find Us Everywhere</h2>
      <div class="platform-grid">
        @for (p of content.platforms(); track p.platform) {
          <a [href]="p.url" target="_blank" rel="noopener" class="platform-link">
            <mat-icon>{{ p.icon }}</mat-icon>
            <span>{{ p.platform }}</span>
          </a>
        }
      </div>
    </section>
  `,
  styles: [`
    .hero {
      background: linear-gradient(135deg, #1e3a8a 0%, #7c3aed 100%);
      color: #fff;
      text-align: center;
      padding: 5rem 1.5rem 4rem;
    }
    .hero-inner { max-width: 700px; margin: 0 auto; }
    .hero-title { font-size: 3.5rem; font-weight: 800; margin: 0 0 0.5rem; }
    .hero-subtitle { font-size: 1.4rem; font-weight: 300; margin: 0 0 0.25rem; opacity: 0.9; }
    .hero-tagline { font-size: 1rem; opacity: 0.7; margin: 0 0 2rem; }
    .hero-actions { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }
    .hero-actions a { min-width: 160px; }

    .stats-bar {
      display: flex;
      justify-content: center;
      gap: 3rem;
      padding: 2rem 1.5rem;
      background: #fff;
      border-bottom: 1px solid #e2e8f0;
    }
    .stat { text-align: center; }
    .stat-value { display: block; font-size: 2rem; font-weight: 700; color: #1e40af; }
    .stat-label { font-size: 0.85rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }

    .section {
      max-width: 1200px;
      margin: 0 auto;
      padding: 3rem 1.5rem;
    }
    .section-title {
      font-size: 1.6rem;
      font-weight: 700;
      color: #1e293b;
      margin: 0 0 1.5rem;
    }

    .card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1.5rem;
    }

    .content-card {
      transition: box-shadow 0.2s ease;
    }
    .content-card:hover {
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    }

    .video-thumb {
      width: 100%;
      aspect-ratio: 16 / 9;
      object-fit: cover;
      border-radius: 4px 4px 0 0;
    }

    .platforms-section { text-align: center; }
    .platform-grid {
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: 1.5rem;
    }
    .platform-link {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      color: #475569;
      text-decoration: none;
      padding: 1rem 1.5rem;
      border-radius: 12px;
      transition: all 0.2s;
      font-size: 0.9rem;
    }
    .platform-link:hover {
      color: #1e40af;
      background: #eff6ff;
    }
    .platform-link mat-icon { font-size: 2rem; width: 32px; height: 32px; }

    @media (max-width: 480px) {
      .hero-title { font-size: 2.4rem; }
      .stats-bar { gap: 1.5rem; }
      .stat-value { font-size: 1.5rem; }
    }
  `],
})
export class HomeComponent implements OnInit {
  content = inject(ContentService);

  blogCount = computed(() => this.content.blogs().length);
  videoCount = computed(() => this.content.videos().filter(v => v.type === 'video').length);
  platformCount = computed(() => this.content.platforms().length);

  latestBlogs = computed(() => [...this.content.blogs()].reverse().slice(0, 3));
  latestVideos = computed(() =>
    [...this.content.videos()].filter(v => v.type === 'video').reverse().slice(0, 2)
  );

  ngOnInit(): void {
    this.content.load();
  }

  getThumbnail(url: string): string {
    const id = url.split('/').pop() ?? '';
    return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  }
}

export default HomeComponent;
