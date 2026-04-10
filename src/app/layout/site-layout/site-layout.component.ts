import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ThemeToggleComponent } from '../../shared/components/theme-toggle/theme-toggle.component';

@Component({
  selector: 'app-site-layout',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, ThemeToggleComponent],
  template: `
    <!-- Header -->
    <header class="header">
      <div class="header-inner">
        <a routerLink="/" class="logo">
          <img src="logo-32.png" alt="amtocbot logo" width="32" height="32" />
          amtocbot
        </a>

        <nav class="desktop-nav" aria-label="Main navigation">
          <div class="nav-dropdown">
            <button class="nav-btn">Learn <span class="chevron">▾</span></button>
            <div class="dropdown-menu">
              <a routerLink="/blog" routerLinkActive="dropdown-active" class="dropdown-item">Blog</a>
              <a routerLink="/videos" routerLinkActive="dropdown-active" class="dropdown-item">Videos</a>
              <a routerLink="/podcasts" routerLinkActive="dropdown-active" class="dropdown-item">Podcasts</a>
            </div>
          </div>
          <div class="nav-dropdown">
            <button class="nav-btn">Community <span class="chevron">▾</span></button>
            <div class="dropdown-menu">
              <a routerLink="/about" routerLinkActive="dropdown-active" class="dropdown-item">About</a>
              <a routerLink="/resources" routerLinkActive="dropdown-active" class="dropdown-item">Resources</a>
              <a routerLink="/metrics" routerLinkActive="dropdown-active" class="dropdown-item">Metrics</a>
            </div>
          </div>
        </nav>

        <div class="header-right">
          <app-theme-toggle />
          <a href="https://amtocsoft.com/#pricing" target="_blank" rel="noopener" class="courses-btn">
            Get Courses →
          </a>
        </div>

        <button class="hamburger" (click)="mobileOpen.set(!mobileOpen())" aria-label="Open menu">
          <span></span><span></span><span></span>
        </button>
      </div>
    </header>

    <!-- Mobile overlay -->
    @if (mobileOpen()) {
      <div class="mobile-overlay" (click)="mobileOpen.set(false)" role="dialog" aria-modal="true">
        <nav class="mobile-nav" (click)="$event.stopPropagation()" aria-label="Mobile navigation">
          <button class="mobile-close" (click)="mobileOpen.set(false)" aria-label="Close menu">✕</button>
          <details open>
            <summary class="mobile-section">Learn</summary>
            <a routerLink="/blog" (click)="mobileOpen.set(false)" class="mobile-link">Blog</a>
            <a routerLink="/videos" (click)="mobileOpen.set(false)" class="mobile-link">Videos</a>
            <a routerLink="/podcasts" (click)="mobileOpen.set(false)" class="mobile-link">Podcasts</a>
          </details>
          <details>
            <summary class="mobile-section">Community</summary>
            <a routerLink="/about" (click)="mobileOpen.set(false)" class="mobile-link">About</a>
            <a routerLink="/resources" (click)="mobileOpen.set(false)" class="mobile-link">Resources</a>
            <a routerLink="/metrics" (click)="mobileOpen.set(false)" class="mobile-link">Metrics</a>
          </details>
          <a href="https://amtocsoft.com/#pricing" target="_blank" rel="noopener"
             class="courses-btn mobile-courses" (click)="mobileOpen.set(false)">
            Get Courses →
          </a>
          <div class="mobile-theme">
            <span class="mobile-theme-label">Theme</span>
            <app-theme-toggle />
          </div>
        </nav>
      </div>
    }

    <!-- Page content -->
    <main class="content">
      <router-outlet />
    </main>

    <!-- Footer -->
    <footer class="footer">
      <div class="footer-inner">
        <span class="footer-brand">Powered by AmtocSoft</span>
        <a href="https://buymeacoffee.com/amtocsoft" target="_blank" rel="noopener" class="bmc-link">
          ☕ Buy Me a Coffee
        </a>
        <div class="footer-links">
          <a href="https://amtocsoft.blogspot.com" target="_blank" rel="noopener" aria-label="Blog">📝</a>
          <a href="https://www.youtube.com/@quietsentinelshadow" target="_blank" rel="noopener" aria-label="YouTube">▶</a>
          <a href="https://www.linkedin.com/in/toc-am-b301373b4/" target="_blank" rel="noopener" aria-label="LinkedIn">in</a>
          <a href="https://x.com/AmToc96282" target="_blank" rel="noopener" aria-label="X">𝕏</a>
          <a href="https://www.tiktok.com/@amtocbot" target="_blank" rel="noopener" aria-label="TikTok">♪</a>
          <a href="https://github.com/amtocbot-droid" target="_blank" rel="noopener" aria-label="GitHub">&lt;/&gt;</a>
          <a href="mailto:hello@amtocbot.com" aria-label="Email">✉</a>
        </div>
        <div class="footer-newsletter">
          <span>Get AI insights weekly:</span>
          <form class="newsletter-form" (submit)="onSubscribe($event)">
            <input type="email" placeholder="your@email.com" class="newsletter-input" required #emailInput />
            <button type="submit" class="newsletter-btn">Subscribe</button>
          </form>
          @if (subscribeStatus) {
            <span class="newsletter-status">{{ subscribeStatus }}</span>
          }
        </div>
      </div>
    </footer>
  `,
  styles: [`
    :host { display: block; }

    /* ── Header ── */
    .header {
      position: sticky;
      top: 0;
      z-index: 200;
      background: var(--header-bg, rgba(10,10,10,0.96));
      border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.08));
      backdrop-filter: blur(12px);
    }
    .header-inner {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 1.5rem;
      height: 60px;
      display: flex;
      align-items: center;
      gap: 1.5rem;
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 1.2rem;
      font-weight: 800;
      color: var(--text-primary, #e2e8f0);
      text-decoration: none;
      letter-spacing: 0.3px;
      flex-shrink: 0;
    }
    .logo img { border-radius: 50%; }

    /* ── Desktop nav dropdowns ── */
    .desktop-nav { display: flex; gap: 0.25rem; }
    .nav-dropdown { position: relative; }
    .nav-btn {
      background: none;
      border: none;
      color: var(--text-secondary, #9ca3af);
      font-size: 0.9rem;
      font-weight: 500;
      padding: 0.5rem 0.75rem;
      cursor: pointer;
      border-radius: 6px;
      transition: color 0.15s, background 0.15s;
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }
    .nav-btn:hover {
      color: var(--text-primary, #e2e8f0);
      background: var(--bg-surface, rgba(255,255,255,0.04));
    }
    .chevron { font-size: 0.65rem; opacity: 0.7; }
    .dropdown-menu {
      display: none;
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      min-width: 150px;
      background: var(--header-bg, rgba(10,10,10,0.96));
      border: 1px solid var(--border-color, rgba(255,255,255,0.1));
      border-radius: 10px;
      padding: 0.4rem 0;
      backdrop-filter: blur(16px);
      box-shadow: var(--card-shadow, 0 8px 24px rgba(0,0,0,0.4));
    }
    .nav-dropdown:hover .dropdown-menu { display: block; }
    .dropdown-item {
      display: block;
      padding: 0.55rem 1rem;
      color: var(--text-secondary, #9ca3af);
      text-decoration: none;
      font-size: 0.9rem;
      transition: color 0.15s, background 0.15s;
    }
    .dropdown-item:hover,
    .dropdown-item.dropdown-active {
      color: var(--text-accent, #fb923c);
      background: var(--bg-surface, rgba(255,255,255,0.04));
    }

    /* ── Header right ── */
    .header-right {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .courses-btn {
      background: var(--accent-gradient, linear-gradient(90deg, #fb923c, #f43f5e));
      color: #fff !important;
      text-decoration: none;
      padding: 0.45rem 1.1rem;
      border-radius: 20px;
      font-size: 0.85rem;
      font-weight: 700;
      white-space: nowrap;
      transition: opacity 0.15s;
    }
    .courses-btn:hover { opacity: 0.9; }

    /* ── Hamburger ── */
    .hamburger {
      display: none;
      flex-direction: column;
      gap: 5px;
      background: none;
      border: none;
      cursor: pointer;
      padding: 0.5rem;
      margin-left: auto;
    }
    .hamburger span {
      display: block;
      width: 22px;
      height: 2px;
      background: var(--text-primary, #e2e8f0);
      border-radius: 2px;
    }

    /* ── Mobile overlay ── */
    .mobile-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      z-index: 300;
      backdrop-filter: blur(4px);
    }
    .mobile-nav {
      position: fixed;
      top: 0;
      right: 0;
      width: min(300px, 85vw);
      height: 100vh;
      background: var(--header-bg, rgba(10,10,10,0.98));
      border-left: 1px solid var(--border-color);
      padding: 1.5rem;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .mobile-close {
      align-self: flex-end;
      background: none;
      border: none;
      color: var(--text-secondary);
      font-size: 1.2rem;
      cursor: pointer;
      padding: 0.25rem 0.5rem;
    }
    .mobile-nav details { border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; }
    .mobile-section {
      color: var(--text-primary);
      font-weight: 600;
      font-size: 0.95rem;
      padding: 0.6rem 0;
      cursor: pointer;
      list-style: none;
    }
    .mobile-section::-webkit-details-marker { display: none; }
    .mobile-link {
      display: block;
      padding: 0.45rem 0.75rem;
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 0.9rem;
    }
    .mobile-link:hover { color: var(--text-accent); }
    .mobile-courses { display: inline-block; margin-top: 1rem; }
    .mobile-theme {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-top: auto;
      padding-top: 1.5rem;
    }
    .mobile-theme-label { color: var(--text-secondary); font-size: 0.85rem; }

    /* ── Content ── */
    .content { min-height: calc(100vh - 60px - 140px); }

    /* ── Footer ── */
    .footer {
      background: var(--bg-surface, rgba(255,255,255,0.04));
      border-top: 1px solid var(--border-color);
      padding: 2rem 1.5rem;
    }
    .footer-inner {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .footer-brand { color: var(--text-secondary); font-size: 0.9rem; }
    .bmc-link { color: #f59e0b; font-size: 0.85rem; font-weight: 600; text-decoration: none; }
    .footer-links { display: flex; gap: 1rem; }
    .footer-links a { color: var(--text-secondary); text-decoration: none; font-size: 1rem; transition: color 0.15s; }
    .footer-links a:hover { color: var(--text-accent); }
    .footer-newsletter { width: 100%; text-align: center; border-top: 1px solid var(--border-color); padding-top: 1rem; margin-top: 0.5rem; color: var(--text-secondary); font-size: 0.85rem; }
    .newsletter-form { display: inline-flex; gap: 0.5rem; margin: 0.5rem 0; }
    .newsletter-input {
      padding: 0.45rem 0.9rem;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      background: var(--bg-surface);
      color: var(--text-primary);
      font-size: 0.85rem;
      width: 200px;
    }
    .newsletter-btn {
      padding: 0.45rem 1rem;
      background: var(--accent-gradient);
      color: #fff;
      border: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.85rem;
      cursor: pointer;
    }
    .newsletter-status { display: block; font-size: 0.8rem; color: var(--text-accent); margin-top: 0.25rem; }

    @media (max-width: 768px) {
      .desktop-nav { display: none; }
      .header-right { display: none; }
      .hamburger { display: flex; }
    }
    @media (min-width: 769px) {
      .hamburger { display: none; }
      .mobile-overlay { display: none; }
    }
  `],
})
export class SiteLayoutComponent {
  mobileOpen = signal(false);
  subscribeStatus = '';

  async onSubscribe(event: Event): Promise<void> {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const input = form.querySelector('input[type="email"]') as HTMLInputElement;
    const email = input?.value?.trim();
    if (!email) return;
    this.subscribeStatus = 'Subscribing...';
    try {
      const r = await fetch('/api/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      this.subscribeStatus = r.ok ? '✓ Subscribed! Check your inbox.' : 'Something went wrong.';
      if (r.ok) input.value = '';
    } catch {
      this.subscribeStatus = 'Network error. Try again.';
    }
  }
}

export default SiteLayoutComponent;
