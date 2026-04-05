import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { ContentService } from '../../shared/services/content.service';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { TranscriptSegment } from '../../shared/models/content.model';

interface TranscriptData {
  id: string;
  title: string;
  date: string;
  duration: string;
  hosts: string[];
  segments: TranscriptSegment[];
}

@Component({
  selector: 'app-podcast-detail',
  standalone: true,
  imports: [
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatDividerModule,
  ],
  template: `
    <div class="podcast-detail-page">
      <a mat-button routerLink="/podcasts" class="back-link">
        <mat-icon>arrow_back</mat-icon> All Podcasts
      </a>

      @if (episode()) {
        <div class="episode-header">
          <h1 class="episode-title">{{ episode()!.title }}</h1>
          <div class="episode-meta">
            <span>{{ episode()!.date }}</span>
            <span class="meta-sep">&middot;</span>
            <span>{{ episode()!.duration }}</span>
          </div>
          <div class="episode-links">
            <a mat-raised-button color="primary" [href]="episode()!.youtubeUrl" target="_blank" rel="noopener">
              <mat-icon>play_circle</mat-icon> Watch on YouTube
            </a>
            @if (episode()!.spotifyUrl) {
              <a mat-raised-button [href]="episode()!.spotifyUrl" target="_blank" rel="noopener" class="spotify-btn">
                <mat-icon>headphones</mat-icon> Listen on Spotify
              </a>
            }
          </div>
        </div>

        @if (embedUrl()) {
          <div class="video-embed">
            <iframe
              [src]="embedUrl()!"
              frameborder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen>
            </iframe>
          </div>
        }
      }

      @if (transcript()) {
        <mat-divider class="section-divider"></mat-divider>

        <section class="transcript-section">
          <h2 class="transcript-heading">
            <mat-icon>description</mat-icon> Full Transcript
          </h2>

          @if (transcript()!.hosts.length > 0) {
            <div class="hosts-info">
              <strong>Hosts:</strong> {{ transcript()!.hosts.join(', ') }}
            </div>
          }

          <!-- Segment navigation -->
          <div class="segment-nav">
            @for (seg of transcript()!.segments; track seg.label) {
              <a mat-stroked-button
                 class="segment-chip"
                 (click)="scrollToSegment(seg.label)">
                {{ seg.label }}
              </a>
            }
          </div>

          @for (seg of transcript()!.segments; track seg.label) {
            <div class="segment-block" [id]="'seg-' + slugify(seg.label)">
              <h3 class="segment-label">{{ seg.label }}</h3>
              @for (entry of seg.entries; track $index) {
                <div class="transcript-entry" [class]="'speaker-' + entry.speaker.toLowerCase()">
                  <div class="entry-header">
                    <span class="speaker-name">{{ entry.speaker }}</span>
                    <span class="entry-timestamp">{{ entry.timestamp }}</span>
                  </div>
                  <p class="entry-text">{{ entry.text }}</p>
                </div>
              }
            </div>
          }
        </section>
      } @else if (transcriptError()) {
        <div class="transcript-unavailable">
          <mat-icon>info</mat-icon>
          <p>Transcript is not yet available for this episode.</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .podcast-detail-page {
      max-width: 900px;
      margin: 0 auto;
      padding: 2rem 1.5rem 4rem;
    }

    .back-link {
      margin-bottom: 1.5rem;
      color: #64748b;
    }

    .episode-header {
      margin-bottom: 2rem;
    }

    .episode-title {
      font-size: 1.8rem;
      font-weight: 700;
      color: #1e293b;
      margin: 0 0 0.5rem;
      line-height: 1.3;
    }

    .episode-meta {
      color: #64748b;
      font-size: 1rem;
      margin-bottom: 1rem;
    }

    .meta-sep {
      margin: 0 0.5rem;
    }

    .episode-links {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .spotify-btn {
      background: #1db954 !important;
      color: #fff !important;
    }

    .video-embed {
      position: relative;
      width: 100%;
      padding-bottom: 56.25%;
      margin-bottom: 2rem;
      border-radius: 8px;
      overflow: hidden;
      background: #0f172a;
    }

    .video-embed iframe {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    }

    .section-divider {
      margin: 2rem 0;
    }

    .transcript-section {
      margin-top: 1rem;
    }

    .transcript-heading {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 1.4rem;
      font-weight: 700;
      color: #1e293b;
      margin: 0 0 1rem;
    }

    .hosts-info {
      color: #64748b;
      font-size: 0.95rem;
      margin-bottom: 1.25rem;
    }

    .segment-nav {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 2rem;
    }

    .segment-chip {
      font-size: 0.8rem !important;
      text-transform: none !important;
    }

    .segment-block {
      margin-bottom: 2rem;
    }

    .segment-label {
      font-size: 1.15rem;
      font-weight: 600;
      color: #334155;
      margin: 0 0 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 2px solid #e2e8f0;
    }

    .transcript-entry {
      margin-bottom: 1.25rem;
      padding-left: 1rem;
      border-left: 3px solid #e2e8f0;
    }

    .transcript-entry.speaker-alex {
      border-left-color: #3b82f6;
    }

    .transcript-entry.speaker-sam {
      border-left-color: #7c3aed;
    }

    .entry-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.25rem;
    }

    .speaker-name {
      font-weight: 600;
      font-size: 0.9rem;
      color: #1e293b;
    }

    .speaker-alex .speaker-name { color: #2563eb; }
    .speaker-sam .speaker-name { color: #6d28d9; }

    .entry-timestamp {
      font-size: 0.8rem;
      color: #94a3b8;
      font-family: monospace;
    }

    .entry-text {
      margin: 0;
      color: #334155;
      line-height: 1.65;
      font-size: 0.95rem;
    }

    .transcript-unavailable {
      text-align: center;
      padding: 3rem;
      color: #94a3b8;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
    }

    @media (max-width: 600px) {
      .episode-title { font-size: 1.4rem; }
      .episode-links { flex-direction: column; }
      .segment-nav { gap: 0.25rem; }
    }
  `],
})
export class PodcastDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private content = inject(ContentService);
  private sanitizer = inject(DomSanitizer);

  episode = computed(() => {
    const id = this.episodeId();
    return this.content.videos().find(v => v.id === id && v.type === 'podcast') ?? null;
  });

  episodeId = signal('');
  transcript = signal<TranscriptData | null>(null);
  transcriptError = signal(false);

  embedUrl = computed<SafeResourceUrl | null>(() => {
    const ep = this.episode();
    if (!ep) return null;
    const videoId = ep.youtubeUrl.split('/').pop() ?? '';
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube.com/embed/${videoId}`
    );
  });

  ngOnInit(): void {
    this.content.load();

    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.episodeId.set(id);

    this.http.get<TranscriptData>(`/assets/data/transcripts/${id}.json`).subscribe({
      next: (data) => this.transcript.set(data),
      error: () => this.transcriptError.set(true),
    });
  }

  slugify(label: string): string {
    return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  scrollToSegment(label: string): void {
    const el = document.getElementById('seg-' + this.slugify(label));
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

export default PodcastDetailComponent;
