# amtocbot.com Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign amtocbot.com with a 3-theme system (Warm Glow / Dark Tech / Light), restructured nav (Learn + Community dropdowns + persistent "Get Courses" CTA), split-hero homepage with tabbed content, and improved inner page layouts for Blog, Videos, Podcasts, and Metrics.

**Architecture:** All theme variants are driven by CSS custom properties set on `document.body` via a `ThemeService` — no component-level theme logic. Angular standalone components are rewritten in-place. No new routes, no new API endpoints.

**Tech Stack:** Angular 19, standalone components, CSS custom properties, IntersectionObserver, `signal()` + `computed()`, `isPlatformBrowser` for SSR safety.

**Repo:** `/Users/amtoc/amtocbot-site/`

---

## File Map

| File | Action |
|---|---|
| `src/styles.scss` | Add theme CSS custom properties (3 body class variants) |
| `src/app/shared/services/theme.service.ts` | Create — theme signal + localStorage persistence |
| `src/app/shared/components/theme-toggle/theme-toggle.component.ts` | Create — 3-swatch floating toggle |
| `src/app/app.config.ts` | Add APP_INITIALIZER to load saved theme on boot |
| `src/app/layout/site-layout/site-layout.component.ts` | Rewrite — new nav with CSS dropdowns, theme toggle, "Get Courses" CTA |
| `src/app/features/home/home.component.ts` | Rewrite — split hero, stats bar, tabbed content, promo card, newsletter, platforms |
| `src/app/features/blog/blog.component.ts` | Modify — add search + topic filters, new themed card design |
| `src/app/features/videos/videos.component.ts` | Modify — add type filter (All/Videos/Shorts), new themed card design |
| `src/app/features/podcasts/podcasts.component.ts` | Modify — change from grid to episode list layout |
| `src/app/features/metrics/metrics.component.ts` | Modify — restyle stat cards to use CSS custom properties |

---

## Task 1: Theme CSS Variables + ThemeService + APP_INITIALIZER

**Files:**
- Modify: `src/styles.scss`
- Create: `src/app/shared/services/theme.service.ts`
- Modify: `src/app/app.config.ts`

- [ ] **Step 1: Add theme CSS custom properties to `src/styles.scss`**

Append to the end of `src/styles.scss` (keep all existing content above):

```scss
/* ── Theme: Custom Properties ───────────────────────────────── */
body.theme-warm-glow {
  --bg-primary: #0a0a0a;
  --bg-surface: rgba(255,255,255,0.04);
  --bg-surface-hover: rgba(255,255,255,0.07);
  --border-color: rgba(255,255,255,0.08);
  --accent: #fb923c;
  --accent-end: #f43f5e;
  --accent-gradient: linear-gradient(90deg, #fb923c, #f43f5e);
  --text-primary: #e2e8f0;
  --text-secondary: #9ca3af;
  --text-accent: #fb923c;
  --header-bg: rgba(10,10,10,0.96);
  --card-shadow: 0 2px 16px rgba(0,0,0,0.4);
}

body.theme-dark-tech {
  --bg-primary: #0f0f23;
  --bg-surface: rgba(255,255,255,0.05);
  --bg-surface-hover: rgba(255,255,255,0.09);
  --border-color: rgba(255,255,255,0.1);
  --accent: #7c3aed;
  --accent-end: #4f46e5;
  --accent-gradient: linear-gradient(90deg, #7c3aed, #4f46e5);
  --text-primary: #e2e8f0;
  --text-secondary: #94a3b8;
  --text-accent: #a78bfa;
  --header-bg: rgba(15,15,35,0.96);
  --card-shadow: 0 2px 16px rgba(0,0,0,0.5);
}

body.theme-light {
  --bg-primary: #f8fafc;
  --bg-surface: #ffffff;
  --bg-surface-hover: #f1f5f9;
  --border-color: #e2e8f0;
  --accent: #6366f1;
  --accent-end: #8b5cf6;
  --accent-gradient: linear-gradient(90deg, #6366f1, #8b5cf6);
  --text-primary: #1e293b;
  --text-secondary: #64748b;
  --text-accent: #6366f1;
  --header-bg: rgba(255,255,255,0.96);
  --card-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

/* Apply bg-primary to the page regardless of Material's surface var */
body.theme-warm-glow,
body.theme-dark-tech,
body.theme-light {
  background-color: var(--bg-primary) !important;
  color: var(--text-primary) !important;
}
```

- [ ] **Step 2: Create `src/app/shared/services/theme.service.ts`**

```typescript
import { Injectable, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type Theme = 'theme-warm-glow' | 'theme-dark-tech' | 'theme-light';
const ALL_THEMES: Theme[] = ['theme-warm-glow', 'theme-dark-tech', 'theme-light'];
const STORAGE_KEY = 'amtocbot-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private platformId = inject(PLATFORM_ID);
  currentTheme = signal<Theme>('theme-warm-glow');

  loadTheme(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    const theme = ALL_THEMES.includes(stored as Theme) ? (stored as Theme) : 'theme-warm-glow';
    this.applyTheme(theme);
  }

  setTheme(theme: Theme): void {
    this.applyTheme(theme);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(STORAGE_KEY, theme);
    }
  }

  private applyTheme(theme: Theme): void {
    if (isPlatformBrowser(this.platformId)) {
      document.body.classList.remove(...ALL_THEMES);
      document.body.classList.add(theme);
    }
    this.currentTheme.set(theme);
  }
}
```

- [ ] **Step 3: Update `src/app/app.config.ts` to add APP_INITIALIZER**

```typescript
import { ApplicationConfig, APP_INITIALIZER, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { routes } from './app.routes';
import { ThemeService } from './shared/services/theme.service';

function initTheme(themeService: ThemeService): () => void {
  return () => themeService.loadTheme();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch()),
    provideClientHydration(withEventReplay()),
    {
      provide: APP_INITIALIZER,
      useFactory: initTheme,
      deps: [ThemeService],
      multi: true,
    },
  ],
};
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/amtoc/amtocbot-site
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/amtoc/amtocbot-site
git add src/styles.scss src/app/shared/services/theme.service.ts src/app/app.config.ts
git commit -m "feat: add 3-theme CSS variable system and ThemeService"
```

---

## Task 2: ThemeToggleComponent

**Files:**
- Create: `src/app/shared/components/theme-toggle/theme-toggle.component.ts`

- [ ] **Step 1: Create the directory and component**

```typescript
// src/app/shared/components/theme-toggle/theme-toggle.component.ts
import { Component, inject } from '@angular/core';
import { ThemeService, type Theme } from '../../services/theme.service';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  template: `
    <div class="theme-toggle" role="group" aria-label="Choose theme">
      <button
        class="swatch swatch-warm"
        [class.active]="theme.currentTheme() === 'theme-warm-glow'"
        (click)="theme.setTheme('theme-warm-glow')"
        title="Warm Glow"
        aria-label="Warm Glow theme">
      </button>
      <button
        class="swatch swatch-tech"
        [class.active]="theme.currentTheme() === 'theme-dark-tech'"
        (click)="theme.setTheme('theme-dark-tech')"
        title="Dark Tech"
        aria-label="Dark Tech theme">
      </button>
      <button
        class="swatch swatch-light"
        [class.active]="theme.currentTheme() === 'theme-light'"
        (click)="theme.setTheme('theme-light')"
        title="Light"
        aria-label="Light theme">
      </button>
    </div>
  `,
  styles: [`
    .theme-toggle {
      display: flex;
      gap: 0.4rem;
      align-items: center;
    }
    .swatch {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      border: 2px solid transparent;
      cursor: pointer;
      padding: 0;
      transition: transform 0.15s ease, border-color 0.15s ease;
      flex-shrink: 0;
    }
    .swatch:hover { transform: scale(1.25); }
    .swatch.active { border-color: var(--text-primary, #fff); transform: scale(1.2); }
    .swatch-warm { background: linear-gradient(135deg, #fb923c, #f43f5e); }
    .swatch-tech { background: linear-gradient(135deg, #7c3aed, #4f46e5); }
    .swatch-light { background: linear-gradient(135deg, #f8fafc 50%, #6366f1 100%); border-color: #cbd5e1 !important; }
    .swatch-light.active { border-color: #6366f1 !important; }
  `],
})
export class ThemeToggleComponent {
  theme = inject(ThemeService);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/amtoc/amtocbot-site
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/amtoc/amtocbot-site
git add src/app/shared/components/theme-toggle/theme-toggle.component.ts
git commit -m "feat: add ThemeToggleComponent with 3 color swatches"
```

---

## Task 3: SiteLayoutComponent Rewrite

**Files:**
- Modify: `src/app/layout/site-layout/site-layout.component.ts`

Replace the entire file contents with the following. Key changes: removes `MatSidenavModule`, adds CSS hover dropdowns, integrates `ThemeToggleComponent`, adds "Get Courses →" CTA, uses CSS mobile overlay instead of `mat-sidenav`.

- [ ] **Step 1: Replace `src/app/layout/site-layout/site-layout.component.ts`**

```typescript
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
          <img src="logo-32.png" alt="AmtocSoft logo" width="28" height="28" />
          AmtocSoft
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
    .logo img { border-radius: 4px; }

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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/amtoc/amtocbot-site
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Build to confirm no import errors**

```bash
cd /Users/amtoc/amtocbot-site
npm run build 2>&1 | tail -20
```

Expected: `Application bundle generation complete.`

- [ ] **Step 4: Commit**

```bash
cd /Users/amtoc/amtocbot-site
git add src/app/layout/site-layout/site-layout.component.ts
git commit -m "feat: rewrite SiteLayoutComponent with themed nav, dropdowns, Get Courses CTA"
```

---

## Task 4: HomeComponent — Full Rewrite

**Files:**
- Modify: `src/app/features/home/home.component.ts`

This is a complete replacement. The component has 4 sections: split hero, stats bar with count-up, tabbed content grid (Blog/Video/Podcast), course promo card, newsletter, platforms.

- [ ] **Step 1: Replace `src/app/features/home/home.component.ts`**

```typescript
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

  heroLatestBlog = computed(() => this.content.blogs()[0] ?? null);
  heroLatestVideo = computed(() => this.content.videos().find(v => v.type === 'video') ?? null);
  heroLatestPodcast = computed(() => this.content.videos().find(v => v.type === 'podcast') ?? null);
  tabBlogs = computed(() => this.content.blogs().slice(0, 6));
  tabVideos = computed(() => this.content.videos().filter(v => v.type === 'video').slice(0, 6));
  tabPodcasts = computed(() => this.content.videos().filter(v => v.type === 'podcast').slice(0, 6));

  ngOnInit(): void {
    this.content.load();
    this.http.get<ContentStats>('/api/content-stats').subscribe({
      next: s => this.liveStats.set(s),
      error: () => this.liveStats.set({
        blogs: this.content.blogs().length,
        videos: this.content.videos().filter(v => v.type === 'video').length,
        shorts: this.content.videos().filter(v => v.type === 'short').length,
        podcasts: this.content.videos().filter(v => v.type === 'podcast').length,
        tiktok: 19, platforms: 8, lastSync: null,
      }),
    });
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const el = document.querySelector('.stats-bar');
    if (!el) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) { this.countUp(); obs.disconnect(); }
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/amtoc/amtocbot-site
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/amtoc/amtocbot-site
git add src/app/features/home/home.component.ts
git commit -m "feat: rewrite HomeComponent with split hero, stats count-up, tabbed content, promo card"
```

---

## Task 5: BlogComponent — Filter Bar + New Card Design

**Files:**
- Modify: `src/app/features/blog/blog.component.ts`

- [ ] **Step 1: Replace `src/app/features/blog/blog.component.ts`**

```typescript
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/amtoc/amtocbot-site
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/amtoc/amtocbot-site
git add src/app/features/blog/blog.component.ts
git commit -m "feat: restyle BlogComponent with search/topic/level filters and themed card design"
```

---

## Task 6: VideosComponent + PodcastsComponent

**Files:**
- Modify: `src/app/features/videos/videos.component.ts`
- Modify: `src/app/features/podcasts/podcasts.component.ts`

- [ ] **Step 1: Replace `src/app/features/videos/videos.component.ts`**

```typescript
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
```

- [ ] **Step 2: Replace `src/app/features/podcasts/podcasts.component.ts`**

```typescript
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
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/amtoc/amtocbot-site
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/amtoc/amtocbot-site
git add src/app/features/videos/videos.component.ts src/app/features/podcasts/podcasts.component.ts
git commit -m "feat: restyle Videos (type filter + themed cards) and Podcasts (episode list layout)"
```

---

## Task 7: MetricsComponent Restyle

**Files:**
- Modify: `src/app/features/metrics/metrics.component.ts`

The data and API calls stay exactly the same. Only the template and styles change to use CSS custom properties.

- [ ] **Step 1: Read the current full `src/app/features/metrics/metrics.component.ts`**

```bash
cat /Users/amtoc/amtocbot-site/src/app/features/metrics/metrics.component.ts
```

- [ ] **Step 2: Replace the `styles` array content only**

Find the `styles: [` section and replace all styles with the following (keep all existing TypeScript class code unchanged):

```css
.metrics-page { max-width: 1200px; margin: 0 auto; padding: 2.5rem 1.5rem; }
.page-title { font-size: 2rem; font-weight: 800; color: var(--text-primary); margin: 0 0 2rem; }
.section-title { font-size: 1.2rem; font-weight: 700; color: var(--text-primary); margin: 2rem 0 1rem; }

.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}
.stat-card {
  background: var(--bg-surface) !important;
  border: 1px solid var(--border-color) !important;
  border-radius: 10px !important;
  padding: 1.25rem !important;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  text-align: center;
  box-shadow: none !important;
}
.stat-icon { color: var(--text-accent) !important; font-size: 1.5rem !important; }
.stat-value { font-size: 1.8rem; font-weight: 800; color: var(--text-accent); }
.stat-label { font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }

/* Platform table */
.platform-table {
  width: 100%;
  background: var(--bg-surface) !important;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  overflow: hidden;
}
.platform-table th { background: var(--bg-surface-hover) !important; color: var(--text-secondary) !important; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.5px; }
.platform-table td { color: var(--text-primary) !important; border-bottom-color: var(--border-color) !important; }

/* Sync status */
.sync-card {
  background: var(--bg-surface) !important;
  border: 1px solid var(--border-color) !important;
  border-radius: 10px;
  padding: 1rem 1.25rem;
  margin-top: 2rem;
}
.sync-status { color: var(--text-secondary); font-size: 0.85rem; }
.last-sync { color: var(--text-accent); font-weight: 600; }
```

- [ ] **Step 3: Also replace all hardcoded color strings in the template with CSS variable references**

In the template, change any `color: '#1e293b'` or `color: '#64748b'` inline style bindings to use `var(--text-primary)` and `var(--text-secondary)`. The Material table cells get their color from the CSS rules above — no inline style changes needed.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/amtoc/amtocbot-site
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Full build**

```bash
cd /Users/amtoc/amtocbot-site
npm run build 2>&1 | tail -10
```

Expected: `Application bundle generation complete.`

- [ ] **Step 6: Commit**

```bash
cd /Users/amtoc/amtocbot-site
git add src/app/features/metrics/metrics.component.ts
git commit -m "feat: restyle MetricsComponent to use CSS custom properties for theming"
```

---

## Verification

After all tasks are complete:

- [ ] `npm run build` passes with no errors
- [ ] Open `http://localhost:4200` — default theme is Warm Glow (dark, orange accent)
- [ ] Click each theme swatch — page recolors correctly (dark purple / light)
- [ ] Reload page — theme persists (loaded from localStorage)
- [ ] Nav dropdowns appear on hover (desktop)
- [ ] Hamburger opens mobile menu with `<details>` sections
- [ ] "Get Courses →" links to `https://amtocsoft.com/#pricing`
- [ ] Homepage hero shows tagline left, 3 content tiles right
- [ ] Tab switching (Blog/Video/Podcast) filters content grid
- [ ] Stats count up from 0 on scroll
- [ ] Blog search + topic + level filters work client-side
- [ ] Videos type filter (All/Videos/Shorts) works
- [ ] Podcasts shows episode list with numbered rows
