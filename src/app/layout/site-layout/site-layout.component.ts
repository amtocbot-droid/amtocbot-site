import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';

@Component({
  selector: 'app-site-layout',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatSidenavModule,
    MatListModule,
  ],
  template: `
    <mat-sidenav-container class="layout-container">
      <mat-sidenav #sidenav mode="over" class="mobile-nav">
        <mat-nav-list>
          @for (link of navLinks; track link.path) {
            <a mat-list-item
               [routerLink]="link.path"
               routerLinkActive="active-link"
               [routerLinkActiveOptions]="{ exact: link.path === '/' }"
               (click)="sidenav.close()">
              <mat-icon matListItemIcon>{{ link.icon }}</mat-icon>
              <span>{{ link.label }}</span>
            </a>
          }
        </mat-nav-list>
      </mat-sidenav>

      <mat-sidenav-content>
        <mat-toolbar class="header">
          <button mat-icon-button class="menu-btn" (click)="sidenav.toggle()">
            <mat-icon>menu</mat-icon>
          </button>
          <a routerLink="/" class="logo">AmtocBot</a>
          <span class="spacer"></span>
          <nav class="desktop-nav">
            @for (link of navLinks; track link.path) {
              <a mat-button
                 [routerLink]="link.path"
                 routerLinkActive="active-nav"
                 [routerLinkActiveOptions]="{ exact: link.path === '/' }">
                {{ link.label }}
              </a>
            }
          </nav>
        </mat-toolbar>

        <main class="content">
          <router-outlet />
        </main>

        <footer class="footer">
          <div class="footer-inner">
            <span class="footer-brand">Powered by AmtocSoft</span>
            <div class="footer-links">
              <a href="https://amtocsoft.blogspot.com" target="_blank" rel="noopener" aria-label="Blog">
                <mat-icon>article</mat-icon>
              </a>
              <a href="https://www.youtube.com/@quietsentinelshadow" target="_blank" rel="noopener" aria-label="YouTube">
                <mat-icon>play_circle</mat-icon>
              </a>
              <a href="https://www.linkedin.com/in/toc-am-b301373b4/" target="_blank" rel="noopener" aria-label="LinkedIn">
                <mat-icon>person</mat-icon>
              </a>
              <a href="https://x.com/AmToc96282" target="_blank" rel="noopener" aria-label="X / Twitter">
                <mat-icon>tag</mat-icon>
              </a>
              <a href="https://www.tiktok.com/@amtocbot" target="_blank" rel="noopener" aria-label="TikTok">
                <mat-icon>music_note</mat-icon>
              </a>
              <a href="https://www.instagram.com/amtocsoft" target="_blank" rel="noopener" aria-label="Instagram">
                <mat-icon>photo_camera</mat-icon>
              </a>
              <a href="https://github.com/amtocbot-droid" target="_blank" rel="noopener" aria-label="GitHub">
                <mat-icon>code</mat-icon>
              </a>
              <a href="mailto:hello@amtocbot.com" aria-label="Email">
                <mat-icon>email</mat-icon>
              </a>
            </div>
            <div class="footer-newsletter">
              <span class="footer-newsletter-label">Get AI insights weekly:</span>
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
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [`
    :host { display: block; height: 100%; }

    .layout-container { height: 100%; }

    .header {
      background: #1e3a8a;
      color: #fff;
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .logo {
      font-size: 1.4rem;
      font-weight: 700;
      color: #fff;
      text-decoration: none;
      letter-spacing: 0.5px;
    }

    .spacer { flex: 1; }

    .desktop-nav a {
      color: rgba(255, 255, 255, 0.85);
      font-weight: 500;
      text-transform: uppercase;
      font-size: 0.85rem;
      letter-spacing: 0.5px;
    }

    .desktop-nav a.active-nav {
      color: #fff;
      border-bottom: 2px solid #60a5fa;
    }

    .menu-btn { display: none; }

    .mobile-nav {
      width: 260px;
      background: #1a1f36;
    }

    .mobile-nav a { color: #e2e8f0; }
    .mobile-nav .active-link { color: #60a5fa; }

    .content {
      min-height: calc(100vh - 64px - 120px);
      background: #f8fafc;
    }

    .footer {
      background: #1a1f36;
      color: #94a3b8;
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

    .footer-brand {
      font-size: 0.9rem;
      font-weight: 500;
    }

    .footer-links {
      display: flex;
      gap: 0.75rem;
    }

    .footer-links a {
      color: #94a3b8;
      transition: color 0.2s;
    }

    .footer-links a:hover { color: #60a5fa; }

    .footer-newsletter {
      width: 100%;
      text-align: center;
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid #2d3548;
    }

    .footer-newsletter-label {
      font-size: 0.85rem;
      margin-right: 0.75rem;
    }

    .newsletter-form {
      display: inline-flex;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }

    .newsletter-input {
      padding: 0.5rem 1rem;
      border: 1px solid #475569;
      border-radius: 6px;
      background: #2d3548;
      color: #e2e8f0;
      font-size: 0.9rem;
      width: 220px;
    }

    .newsletter-input::placeholder { color: #64748b; }

    .newsletter-btn {
      padding: 0.5rem 1.25rem;
      background: #3b82f6;
      color: #fff;
      border: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.85rem;
      cursor: pointer;
      transition: background 0.2s;
    }

    .newsletter-btn:hover { background: #2563eb; }

    .newsletter-status {
      display: block;
      margin-top: 0.5rem;
      font-size: 0.8rem;
      color: #60a5fa;
    }

    @media (max-width: 768px) {
      .menu-btn { display: inline-flex; }
      .desktop-nav { display: none; }
      .newsletter-form { flex-direction: column; align-items: center; }
      .newsletter-input { width: 100%; max-width: 280px; }
    }

    @media (min-width: 769px) {
      .menu-btn { display: none; }
    }
  `],
})
export class SiteLayoutComponent {
  navLinks = [
    { path: '/', label: 'Home', icon: 'home' },
    { path: '/blog', label: 'Blog', icon: 'article' },
    { path: '/videos', label: 'Videos', icon: 'play_circle' },
    { path: '/metrics', label: 'Metrics', icon: 'bar_chart' },
    { path: '/resources', label: 'Resources', icon: 'link' },
    { path: '/about', label: 'About', icon: 'info' },
  ];

  subscribeStatus = '';

  async onSubscribe(event: Event): Promise<void> {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const input = form.querySelector('input[type="email"]') as HTMLInputElement;
    const email = input?.value?.trim();
    if (!email) return;

    this.subscribeStatus = 'Subscribing...';
    try {
      const resp = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (resp.ok) {
        this.subscribeStatus = 'Subscribed! Check your inbox.';
        input.value = '';
      } else {
        this.subscribeStatus = 'Something went wrong. Try again.';
      }
    } catch {
      this.subscribeStatus = 'Network error. Try again later.';
    }
  }
}

export default SiteLayoutComponent;
