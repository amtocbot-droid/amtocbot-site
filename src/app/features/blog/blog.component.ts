import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { ContentService } from '../../shared/services/content.service';

const LEVELS = ['All', 'Beginner', 'Intermediate', 'Advanced', 'Professional'] as const;

@Component({
  selector: 'app-blog',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatChipsModule, MatIconModule],
  template: `
    <div class="blog-page">
      <h1 class="page-title">Blog Posts</h1>

      <mat-chip-set class="filter-chips">
        @for (level of levels; track level) {
          <mat-chip
            [highlighted]="activeFilter() === level"
            (click)="activeFilter.set(level)">
            {{ level }}
          </mat-chip>
        }
      </mat-chip-set>

      <div class="card-grid">
        @for (post of filteredBlogs(); track post.id) {
          <mat-card class="blog-card">
            <mat-card-header>
              <mat-card-title>{{ post.title }}</mat-card-title>
              <mat-card-subtitle>{{ post.date }} &middot; {{ post.topic }}</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              <mat-chip-set>
                <mat-chip [class]="'level-' + post.level.toLowerCase()">
                  {{ post.level }}
                </mat-chip>
              </mat-chip-set>
            </mat-card-content>
            <mat-card-actions>
              <a mat-button [href]="post.blogUrl" target="_blank" rel="noopener">
                <mat-icon>open_in_new</mat-icon> Read on Blog
              </a>
              @if (post.youtubeUrl) {
                <a mat-icon-button [href]="post.youtubeUrl" target="_blank" rel="noopener"
                   aria-label="Watch on YouTube" class="yt-link">
                  <mat-icon>play_circle</mat-icon>
                </a>
              }
            </mat-card-actions>
          </mat-card>
        }
      </div>

      @if (filteredBlogs().length === 0) {
        <p class="empty">No posts found for this filter.</p>
      }
    </div>
  `,
  styles: [`
    .blog-page {
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

    .filter-chips {
      margin-bottom: 2rem;
    }

    .card-grid {
      display: grid;
      grid-template-columns: repeat(1, 1fr);
      gap: 1.5rem;
    }

    .blog-card {
      transition: box-shadow 0.2s ease;
    }
    .blog-card:hover {
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    }

    .yt-link { color: #dc2626; }

    .empty {
      text-align: center;
      color: #64748b;
      padding: 3rem 0;
    }

    @media (min-width: 640px) {
      .card-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (min-width: 1024px) {
      .card-grid { grid-template-columns: repeat(3, 1fr); }
    }
  `],
})
export class BlogComponent implements OnInit {
  private content = inject(ContentService);

  levels = LEVELS;
  activeFilter = signal<string>('All');

  filteredBlogs = computed(() => {
    const filter = this.activeFilter();
    const blogs = this.content.blogs();
    if (filter === 'All') return blogs;
    return blogs.filter(b => b.level === filter);
  });

  ngOnInit(): void {
    this.content.load();
  }
}

export default BlogComponent;
