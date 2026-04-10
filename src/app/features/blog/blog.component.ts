import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ContentService } from '../../shared/services/content.service';

const TOPICS = ['All', 'AI / LLMs', 'Security', 'Performance', 'Software Engineering', 'Quant'] as const;
const LEVELS = ['All', 'Beginner', 'Intermediate', 'Advanced', 'Professional'] as const;

const TOPIC_COLORS: Record<string, string> = {
  'AI / LLMs': '#fb923c', 'Security': '#f43f5e', 'Performance': '#3b82f6',
  'Software Engineering': '#22c55e', 'Quant': '#a78bfa',
};
const LEVEL_COLORS: Record<string, string> = {
  'Beginner': '#22c55e', 'Intermediate': '#3b82f6', 'Advanced': '#f59e0b', 'Professional': '#ef4444',
};

@Component({
  selector: 'app-blog',
  standalone: true,
  imports: [],
  template: `
    <div class="blog-page">
      <div class="page-header">
        <h1 class="page-title">Blog</h1>
        <p class="page-sub">{{ filtered().length }} posts</p>
      </div>

      <!-- Filter bar -->
      <div class="filter-bar">
        <input
          class="search-input"
          type="search"
          placeholder="Search posts..."
          [value]="searchQuery()"
          (input)="searchQuery.set($any($event.target).value)" />
        <div class="filter-chips">
          @for (t of topics; track t) {
            <button class="chip" [class.active]="activeTopic() === t" (click)="activeTopic.set(t)">{{ t }}</button>
          }
        </div>
        <div class="filter-chips">
          @for (l of levels; track l) {
            <button class="chip level-chip" [class.active]="activeLevel() === l" (click)="activeLevel.set(l)">{{ l }}</button>
          }
        </div>
      </div>

      <!-- Cards -->
      <div class="card-grid">
        @for (post of filtered(); track post.id) {
          <a [href]="post.blogUrl" target="_blank" rel="noopener"
             class="blog-card"
             [style.--tc]="topicColor(post.topic)">
            <div class="card-stripe"></div>
            <div class="card-body">
              <div class="card-meta">
                <span class="badge" [style.background]="levelColor(post.level)">{{ post.level }}</span>
                <span class="card-date">{{ post.date }}</span>
                <span class="read-time">~5 min</span>
              </div>
              <div class="card-title">{{ post.title }}</div>
              <div class="card-topic">{{ post.topic }}</div>
              <span class="card-cta">Read →</span>
            </div>
          </a>
        }
      </div>

      @if (filtered().length === 0) {
        <p class="empty">No posts match your filters.</p>
      }
    </div>
  `,
  styles: [`
    .blog-page { max-width: 1200px; margin: 0 auto; padding: 2.5rem 1.5rem; }
    .page-header { margin-bottom: 1.5rem; }
    .page-title { font-size: 2rem; font-weight: 800; color: var(--text-primary); margin: 0 0 0.25rem; }
    .page-sub { color: var(--text-secondary); font-size: 0.9rem; margin: 0; }

    .filter-bar { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 2rem; }
    .search-input {
      padding: 0.6rem 1rem;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      background: var(--bg-surface);
      color: var(--text-primary);
      font-size: 0.9rem;
      max-width: 360px;
    }
    .search-input::placeholder { color: var(--text-secondary); }
    .filter-chips { display: flex; gap: 0.4rem; flex-wrap: wrap; }
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
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1.25rem;
    }
    .blog-card {
      display: flex;
      text-decoration: none;
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      overflow: hidden;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .blog-card:hover { border-color: var(--tc, var(--accent)); box-shadow: var(--card-shadow); }
    .card-stripe { width: 4px; flex-shrink: 0; background: var(--tc, var(--accent)); }
    .card-body { padding: 1rem; display: flex; flex-direction: column; gap: 0.4rem; flex: 1; }
    .card-meta { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .badge { font-size: 0.65rem; font-weight: 700; color: #fff; padding: 0.15rem 0.5rem; border-radius: 4px; text-transform: uppercase; }
    .card-date { font-size: 0.7rem; color: var(--text-secondary); }
    .read-time { font-size: 0.7rem; color: var(--text-secondary); margin-left: auto; }
    .card-title { font-size: 0.92rem; font-weight: 600; color: var(--text-primary); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .card-topic { font-size: 0.75rem; color: var(--text-secondary); }
    .card-cta { font-size: 0.8rem; color: var(--text-accent); font-weight: 600; margin-top: auto; padding-top: 0.5rem; }
    .empty { text-align: center; color: var(--text-secondary); padding: 3rem; }
  `],
})
export class BlogComponent implements OnInit {
  private cs = inject(ContentService);
  topics = TOPICS;
  levels = LEVELS;
  searchQuery = signal('');
  activeTopic = signal<string>('All');
  activeLevel = signal<string>('All');

  filtered = computed(() => {
    const q = this.searchQuery().toLowerCase();
    const t = this.activeTopic();
    const l = this.activeLevel();
    return this.cs.blogs().filter(p =>
      (t === 'All' || p.topic === t) &&
      (l === 'All' || p.level === l) &&
      (q === '' || p.title.toLowerCase().includes(q))
    );
  });

  ngOnInit(): void { this.cs.load(); }
  topicColor(topic: string): string { return TOPIC_COLORS[topic] ?? '#6b7280'; }
  levelColor(level: string): string { return LEVEL_COLORS[level] ?? '#6b7280'; }
}

export default BlogComponent;
