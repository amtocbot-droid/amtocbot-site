import {
  Component, inject, OnInit, AfterViewInit, signal, computed, PLATFORM_ID
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ContentService } from '../../shared/services/content.service';
import type { BlogPost, Video } from '../../shared/models/content.model';

interface ContentStats {
  blogs: number; videos: number; shorts: number; podcasts: number; tiktok: number; platforms: number; lastSync: string | null;
}
type Tab = 'blog' | 'video' | 'podcast';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  template: `
    <!-- ── Hero ── -->
    <section class="hero">
      <div class="hero-inner">
        <!-- Left: pitch -->
        <div class="hero-left">
          <div class="hero-eyebrow">AI · Security · Performance</div>
          <h1 class="hero-title">Tech Education<br><span class="hero-gradient">Without the Noise</span></h1>
          <p class="hero-sub">Deep-dive blogs, videos &amp; podcasts. Beginner to professional.</p>
          <div class="hero-pills">
            <span class="pill">{{ liveStats().blogs }} posts</span>
            <span class="pill">{{ liveStats().videos }} videos</span>
            <span class="pill">{{ liveStats().platforms }} platforms</span>
          </div>
          <div class="hero-actions">
            <a routerLink="/blog" class="btn-primary">Browse Content</a>
            <button class="btn-ghost" (click)="scrollToNewsletter()">Subscribe</button>
          </div>
        </div>
        <!-- Right: latest content tiles -->
        <div class="hero-right">
          @if (heroLatestBlog()) {
            <a [href]="heroLatestBlog()!.blogUrl" target="_blank" rel="noopener" class="hero-tile">
              <span class="tile-type tile-blog">📝 Blog</span>
              <span class="tile-topic">{{ heroLatestBlog()!.topic }}</span>
              <span class="tile-title">{{ heroLatestBlog()!.title }}</span>
              <span class="tile-link">Read →</span>
            </a>
          }
          @if (heroLatestVideo()) {
            <a [href]="heroLatestVideo()!.youtubeUrl" target="_blank" rel="noopener" class="hero-tile">
              <span class="tile-type tile-video">▶ Video</span>
              <span class="tile-topic">{{ heroLatestVideo()!.level }}</span>
              <span class="tile-title">{{ heroLatestVideo()!.title }}</span>
              <span class="tile-link">Watch →</span>
            </a>
          }
          @if (heroLatestPodcast()) {
            <a [href]="heroLatestPodcast()!.youtubeUrl" target="_blank" rel="noopener" class="hero-tile">
              <span class="tile-type tile-podcast">🎙 Podcast</span>
              <span class="tile-topic">{{ heroLatestPodcast()!.level }}</span>
              <span class="tile-title">{{ heroLatestPodcast()!.title }}</span>
              <span class="tile-link">Listen →</span>
            </a>
          }
        </div>
      </div>
    </section>

    <!-- ── Stats bar ── -->
    <section class="stats-bar">
      <div class="stat"><span class="stat-val">{{ animated().blogs }}</span><span class="stat-lbl">Blog Posts</span></div>
      <div class="stat"><span class="stat-val">{{ animated().videos }}</span><span class="stat-lbl">Videos</span></div>
      <div class="stat"><span class="stat-val">{{ animated().shorts }}</span><span class="stat-lbl">Shorts</span></div>
      <div class="stat"><span class="stat-val">{{ animated().podcasts }}</span><span class="stat-lbl">Podcasts</span></div>
      <div class="stat"><span class="stat-val">{{ animated().tiktok }}</span><span class="stat-lbl">TikTok</span></div>
      <div class="stat"><span class="stat-val">{{ animated().platforms }}</span><span class="stat-lbl">Platforms</span></div>
    </section>

    <!-- ── Tabbed content ── -->
    <section class="content-section">
      <div class="section-inner">
        <div class="tab-bar">
          <button class="tab-btn" [class.active]="activeTab() === 'blog'" (click)="activeTab.set('blog')">Blog</button>
          <button class="tab-btn" [class.active]="activeTab() === 'video'" (click)="activeTab.set('video')">Videos</button>
          <button class="tab-btn" [class.active]="activeTab() === 'podcast'" (click)="activeTab.set('podcast')">Podcasts</button>
        </div>

        @if (activeTab() === 'blog') {
          <div class="card-grid">
            @for (post of tabBlogs(); track post.id) {
              <a [href]="post.blogUrl" target="_blank" rel="noopener" class="content-card" [style.--topic-color]="topicColor(post.topic)">
                <div class="card-accent-bar"></div>
                <div class="card-body">
                  <div class="card-meta">
                    <span class="card-level" [style.background]="levelColor(post.level)">{{ post.level }}</span>
                    <span class="card-date">{{ post.date }}</span>
                  </div>
                  <div class="card-title">{{ post.title }}</div>
                  <div class="card-topic">{{ post.topic }}</div>
                  <span class="card-link">Read →</span>
                </div>
              </a>
            }
            <!-- Course promo inline card -->
            <a href="https://amtocsoft.com/#pricing" target="_blank" rel="noopener" class="content-card promo-card">
              <div class="promo-inner">
                <div class="promo-eyebrow">AmtocSoft Courses</div>
                <div class="promo-title">Level up with structured courses</div>
                <ul class="promo-list">
                  <li>AI Foundations</li>
                  <li>Security Essentials</li>
                  <li>Performance Engineering</li>
                  <li>Blog Writing Kit</li>
                </ul>
                <span class="promo-cta">Browse Courses →</span>
              </div>
            </a>
          </div>
          <div class="view-all"><a routerLink="/blog">View all blog posts →</a></div>
        }

        @if (activeTab() === 'video') {
          <div class="card-grid">
            @for (v of tabVideos(); track v.id) {
              <a [href]="v.youtubeUrl" target="_blank" rel="noopener" class="content-card video-card">
                <img [src]="thumb(v.youtubeUrl)" [alt]="v.title" class="video-thumb" loading="lazy" />
                <div class="card-body">
                  <div class="card-meta">
                    <span class="card-level" [style.background]="levelColor(v.level)">{{ v.level }}</span>
                    <span class="card-date">{{ v.date }}</span>
                  </div>
                  <div class="card-title">{{ v.title }}</div>
                  <span class="card-link">Watch →</span>
                </div>
              </a>
            }
          </div>
          <div class="view-all"><a routerLink="/videos">View all videos →</a></div>
        }

        @if (activeTab() === 'podcast') {
          <div class="card-grid">
            @for (ep of tabPodcasts(); track ep.id) {
              <a [href]="ep.youtubeUrl" target="_blank" rel="noopener" class="content-card video-card">
                <img [src]="thumb(ep.youtubeUrl)" [alt]="ep.title" class="video-thumb" loading="lazy" />
                <div class="card-body">
                  <div class="card-meta">
                    <span class="card-level podcast-badge">Podcast</span>
                    <span class="card-date">{{ ep.duration }}</span>
                  </div>
                  <div class="card-title">{{ ep.title }}</div>
                  <span class="card-link">Listen →</span>
                </div>
              </a>
            }
          </div>
          <div class="view-all"><a routerLink="/podcasts">View all podcasts →</a></div>
        }
      </div>
    </section>

    <!-- ── Newsletter ── -->
    <section class="newsletter-section" id="newsletter">
      <div class="newsletter-inner">
        <p class="newsletter-label">Get AI insights weekly</p>
        <form class="newsletter-form" (submit)="onSubscribe($event)">
          <input type="email" placeholder="your@email.com" class="newsletter-input" required #emailRef />
          <button type="submit" class="newsletter-btn">Subscribe Free</button>
        </form>
        @if (subStatus()) {
          <p class="newsletter-status">{{ subStatus() }}</p>
        }
      </div>
    </section>

    <!-- ── Platforms ── -->
    <section class="platforms-section">
      <div class="section-inner">
        <h2 class="section-title">Find Us Everywhere</h2>
        <div class="platform-grid">
          @for (p of content.platforms(); track p.platform) {
            <a [href]="p.url" target="_blank" rel="noopener" class="platform-link">
              <span class="platform-name">{{ p.platform }}</span>
            </a>
          }
        </div>
      </div>
    </section>
  `,
  styles: [`
    /* ── Hero ── */
    .hero {
      background: var(--bg-primary);
      border-bottom: 1px solid var(--border-color);
      padding: 5rem 1.5rem 4rem;
    }
    .hero-inner {
      max-width: 1100px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: 3fr 2fr;
      gap: 3rem;
      align-items: center;
    }
    .hero-eyebrow {
      color: var(--text-accent);
      font-size: 0.75rem;
      letter-spacing: 2px;
      text-transform: uppercase;
      font-weight: 600;
      margin-bottom: 1rem;
    }
    .hero-title {
      font-size: clamp(2.2rem, 5vw, 3.5rem);
      font-weight: 900;
      color: var(--text-primary);
      line-height: 1.15;
      margin: 0 0 1rem;
    }
    .hero-gradient {
      background: var(--accent-gradient);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .hero-sub { color: var(--text-secondary); font-size: 1.05rem; line-height: 1.6; margin: 0 0 1.5rem; }
    .hero-pills { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 2rem; }
    .pill {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      color: var(--text-accent);
      padding: 0.3rem 0.8rem;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 500;
    }
    .hero-actions { display: flex; gap: 0.75rem; flex-wrap: wrap; }
    .btn-primary {
      background: var(--accent-gradient);
      color: #fff;
      text-decoration: none;
      padding: 0.65rem 1.5rem;
      border-radius: 8px;
      font-weight: 700;
      font-size: 0.95rem;
      transition: opacity 0.15s;
    }
    .btn-primary:hover { opacity: 0.9; }
    .btn-ghost {
      background: none;
      border: 1.5px solid var(--accent);
      color: var(--text-accent);
      padding: 0.65rem 1.5rem;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.95rem;
      cursor: pointer;
      transition: background 0.15s;
    }
    .btn-ghost:hover { background: var(--bg-surface); }

    /* Hero tiles */
    .hero-right { display: flex; flex-direction: column; gap: 0.75rem; }
    .hero-tile {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      padding: 0.85rem 1rem;
      text-decoration: none;
      transition: border-color 0.15s, background 0.15s;
    }
    .hero-tile:hover { border-color: var(--accent); background: var(--bg-surface-hover); }
    .tile-type { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
    .tile-blog { color: var(--text-accent); }
    .tile-video { color: #f43f5e; }
    .tile-podcast { color: #a78bfa; }
    .tile-topic { font-size: 0.7rem; color: var(--text-secondary); }
    .tile-title { font-size: 0.85rem; font-weight: 600; color: var(--text-primary); line-height: 1.35; }
    .tile-link { font-size: 0.75rem; color: var(--text-accent); font-weight: 600; margin-top: 0.1rem; }

    /* ── Stats bar ── */
    .stats-bar {
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: 2.5rem;
      padding: 2rem 1.5rem;
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border-color);
    }
    .stat { text-align: center; }
    .stat-val { display: block; font-size: 2rem; font-weight: 800; color: var(--text-accent); }
    .stat-lbl { font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }

    /* ── Content section ── */
    .content-section { background: var(--bg-primary); padding: 3rem 1.5rem; }
    .section-inner { max-width: 1200px; margin: 0 auto; }
    .tab-bar { display: flex; gap: 0.25rem; margin-bottom: 2rem; border-bottom: 1px solid var(--border-color); }
    .tab-btn {
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      padding: 0.6rem 1.25rem;
      color: var(--text-secondary);
      font-size: 0.95rem;
      font-weight: 500;
      cursor: pointer;
      transition: color 0.15s, border-color 0.15s;
    }
    .tab-btn.active { color: var(--text-accent); border-bottom-color: var(--accent); }
    .tab-btn:hover:not(.active) { color: var(--text-primary); }

    .card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.25rem;
    }
    .content-card {
      display: flex;
      flex-direction: column;
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      text-decoration: none;
      overflow: hidden;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .content-card:hover { border-color: var(--accent); box-shadow: var(--card-shadow); }
    .card-accent-bar { height: 3px; background: var(--topic-color, var(--accent)); }
    .card-body { padding: 1rem; display: flex; flex-direction: column; gap: 0.4rem; flex: 1; }
    .card-meta { display: flex; align-items: center; gap: 0.5rem; }
    .card-level {
      font-size: 0.65rem;
      font-weight: 700;
      color: #fff;
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .podcast-badge { background: #7c3aed !important; }
    .card-date { font-size: 0.7rem; color: var(--text-secondary); }
    .card-title { font-size: 0.9rem; font-weight: 600; color: var(--text-primary); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .card-topic { font-size: 0.75rem; color: var(--text-secondary); }
    .card-link { font-size: 0.8rem; color: var(--text-accent); font-weight: 600; margin-top: auto; padding-top: 0.5rem; }
    .video-thumb { width: 100%; aspect-ratio: 16/9; object-fit: cover; }

    /* Promo card */
    .promo-card {
      border-color: var(--accent) !important;
      background: linear-gradient(135deg, var(--bg-surface), var(--bg-surface-hover)) !important;
    }
    .promo-inner { padding: 1.25rem; display: flex; flex-direction: column; gap: 0.5rem; height: 100%; }
    .promo-eyebrow { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 1.5px; color: var(--text-accent); font-weight: 700; }
    .promo-title { font-size: 1rem; font-weight: 800; color: var(--text-primary); }
    .promo-list { margin: 0; padding-left: 1.25rem; color: var(--text-secondary); font-size: 0.82rem; line-height: 1.8; }
    .promo-cta { font-size: 0.85rem; font-weight: 700; color: var(--text-accent); margin-top: auto; padding-top: 0.75rem; }

    .view-all { margin-top: 1.5rem; text-align: center; }
    .view-all a { color: var(--text-accent); text-decoration: none; font-weight: 600; font-size: 0.9rem; }
    .view-all a:hover { text-decoration: underline; }

    /* ── Newsletter ── */
    .newsletter-section {
      background: var(--bg-surface);
      border-top: 1px solid var(--border-color);
      border-bottom: 1px solid var(--border-color);
      padding: 3rem 1.5rem;
      text-align: center;
    }
    .newsletter-inner { max-width: 480px; margin: 0 auto; }
    .newsletter-label { color: var(--text-primary); font-size: 1.1rem; font-weight: 700; margin: 0 0 1rem; }
    .newsletter-form { display: flex; gap: 0.5rem; justify-content: center; }
    .newsletter-input {
      flex: 1;
      padding: 0.6rem 1rem;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      background: var(--bg-primary);
      color: var(--text-primary);
      font-size: 0.9rem;
    }
    .newsletter-input::placeholder { color: var(--text-secondary); }
    .newsletter-btn {
      padding: 0.6rem 1.25rem;
      background: var(--accent-gradient);
      color: #fff;
      border: none;
      border-radius: 8px;
      font-weight: 700;
      font-size: 0.9rem;
      cursor: pointer;
      white-space: nowrap;
    }
    .newsletter-status { color: var(--text-accent); font-size: 0.85rem; margin-top: 0.75rem; }

    /* ── Platforms ── */
    .platforms-section { background: var(--bg-primary); padding: 3rem 1.5rem; }
    .section-title { font-size: 1.4rem; font-weight: 700; color: var(--text-primary); margin: 0 0 1.5rem; text-align: center; }
    .platform-grid { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.75rem; }
    .platform-link {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.55rem 1.1rem;
      border: 1px solid var(--border-color);
      border-radius: 20px;
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 0.85rem;
      transition: border-color 0.15s, color 0.15s;
    }
    .platform-link:hover { border-color: var(--accent); color: var(--text-accent); }
    .platform-name { font-weight: 500; }

    @media (max-width: 768px) {
      .hero-inner { grid-template-columns: 1fr; gap: 2rem; }
      .hero-right { display: none; }
      .hero-title { font-size: 2.2rem; }
      .stats-bar { gap: 1.5rem; }
      .stat-val { font-size: 1.5rem; }
      .newsletter-form { flex-direction: column; align-items: stretch; }
    }
  `],
})
export class HomeComponent implements OnInit, AfterViewInit {
  content = inject(ContentService);
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);

  liveStats = signal<ContentStats>({ blogs: 0, videos: 0, shorts: 0, podcasts: 0, tiktok: 0, platforms: 0, lastSync: null });
  animated = signal<ContentStats>({ blogs: 0, videos: 0, shorts: 0, podcasts: 0, tiktok: 0, platforms: 0, lastSync: null });
  activeTab = signal<Tab>('blog');
  subStatus = signal('');

  private statsBarInView = false;
  private statsLoaded = false;

  heroLatestBlog = computed(() => this.content.blogs()[0] ?? null);
  heroLatestVideo = computed(() => this.content.videos().find(v => v.type === 'video') ?? null);
  heroLatestPodcast = computed(() => this.content.videos().find(v => v.type === 'podcast') ?? null);
  tabBlogs = computed(() => this.content.blogs().slice(0, 6));
  tabVideos = computed(() => this.content.videos().filter(v => v.type === 'video').slice(0, 6));
  tabPodcasts = computed(() => this.content.videos().filter(v => v.type === 'podcast').slice(0, 6));

  ngOnInit(): void {
    this.content.load();
    this.http.get<ContentStats>('/api/content-stats').subscribe({
      next: s => {
        this.liveStats.set(s);
        this.statsLoaded = true;
        if (this.statsBarInView) { this.countUp(); }
      },
      error: () => {
        this.liveStats.set({
          blogs: this.content.blogs().length,
          videos: this.content.videos().filter(v => v.type === 'video').length,
          shorts: this.content.videos().filter(v => v.type === 'short').length,
          podcasts: this.content.videos().filter(v => v.type === 'podcast').length,
          tiktok: 19, platforms: 8, lastSync: null,
        });
        this.statsLoaded = true;
        if (this.statsBarInView) { this.countUp(); }
      },
    });
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const el = document.querySelector('.stats-bar');
    if (!el) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        this.statsBarInView = true;
        obs.disconnect();
        if (this.statsLoaded) { this.countUp(); }
      }
    }, { threshold: 0.3 });
    obs.observe(el);
  }

  private countUp(): void {
    const target = this.liveStats();
    const dur = 1200;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - t0) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      this.animated.set({
        blogs: Math.round(target.blogs * e),
        videos: Math.round(target.videos * e),
        shorts: Math.round(target.shorts * e),
        podcasts: Math.round(target.podcasts * e),
        tiktok: Math.round(target.tiktok * e),
        platforms: Math.round(target.platforms * e),
        lastSync: target.lastSync,
      });
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  scrollToNewsletter(): void {
    document.getElementById('newsletter')?.scrollIntoView({ behavior: 'smooth' });
  }

  async onSubscribe(event: Event): Promise<void> {
    event.preventDefault();
    const input = (event.target as HTMLFormElement).querySelector('input[type="email"]') as HTMLInputElement;
    if (!input?.value) return;
    this.subStatus.set('Subscribing...');
    try {
      const r = await fetch('/api/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: input.value }) });
      this.subStatus.set(r.ok ? '✓ Subscribed! Check your inbox.' : 'Something went wrong.');
      if (r.ok) input.value = '';
    } catch { this.subStatus.set('Network error.'); }
  }

  thumb(url: string): string {
    return `https://img.youtube.com/vi/${url.split('/').pop() ?? ''}/hqdefault.jpg`;
  }

  topicColor(topic: string): string {
    const m: Record<string, string> = { 'AI / LLMs': '#fb923c', 'Security': '#f43f5e', 'Performance': '#3b82f6', 'Software Engineering': '#22c55e', 'Quant': '#a78bfa' };
    return m[topic] ?? '#6b7280';
  }

  levelColor(level: string): string {
    const m: Record<string, string> = { 'Beginner': '#22c55e', 'Intermediate': '#3b82f6', 'Advanced': '#f59e0b', 'Professional': '#ef4444' };
    return m[level] ?? '#6b7280';
  }
}

export default HomeComponent;
