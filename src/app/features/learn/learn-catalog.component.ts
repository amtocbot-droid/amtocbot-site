// src/app/features/learn/learn-catalog.component.ts

import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LearnService } from './learn.service';
import { LanguageMeta } from './curriculum/types';

@Component({
  selector: 'app-learn-catalog',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="catalog-page">
      <div class="catalog-header">
        <h1 class="catalog-title">Learn to Code</h1>
        <p class="catalog-sub">Story-driven lessons that make programming concepts stick. Pick a language and start your first lesson in seconds — no account required.</p>
      </div>

      <div class="language-grid">
        @for (lang of languages; track lang.id) {
          <div class="language-card" [style.--accent]="lang.color">
            <div class="language-card-icon">
              <span class="material-symbols-outlined lang-icon">{{ lang.icon }}</span>
            </div>
            <div class="language-card-body">
              <h2 class="language-name">{{ lang.label }}</h2>
              <p class="language-desc">{{ lang.description }}</p>
            </div>
            <a [routerLink]="['/learn', lang.id]" class="start-btn">
              Start Learning →
            </a>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .catalog-page {
      max-width: 960px;
      margin: 0 auto;
      padding: 3rem 1.5rem;
    }

    .catalog-header {
      text-align: center;
      margin-bottom: 3rem;
    }

    .catalog-title {
      font-size: 2.5rem;
      font-weight: 700;
      margin: 0 0 1rem;
      background: linear-gradient(135deg, var(--color-primary, #6366f1), var(--color-accent, #8b5cf6));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .catalog-sub {
      font-size: 1.125rem;
      color: var(--color-muted, #6b7280);
      max-width: 600px;
      margin: 0 auto;
      line-height: 1.6;
    }

    .language-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1.5rem;
    }

    @media (max-width: 600px) {
      .language-grid {
        grid-template-columns: 1fr;
      }
    }

    .language-card {
      background: var(--color-surface, #ffffff);
      border: 1px solid var(--color-border, #e5e7eb);
      border-top: 4px solid var(--accent);
      border-radius: 12px;
      padding: 1.75rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      transition: box-shadow 0.2s, transform 0.2s;
    }

    .language-card:hover {
      box-shadow: 0 8px 24px rgba(0,0,0,0.1);
      transform: translateY(-2px);
    }

    .language-card-icon {
      width: 48px;
      height: 48px;
      border-radius: 10px;
      background: color-mix(in srgb, var(--accent) 12%, transparent);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .lang-icon {
      font-size: 1.75rem;
      color: var(--accent);
    }

    .language-card-body {
      flex: 1;
    }

    .language-name {
      font-size: 1.375rem;
      font-weight: 700;
      margin: 0 0 0.5rem;
      color: var(--color-text, #111827);
    }

    .language-desc {
      font-size: 0.9375rem;
      color: var(--color-muted, #6b7280);
      line-height: 1.5;
      margin: 0;
    }

    .start-btn {
      display: inline-block;
      padding: 0.625rem 1.25rem;
      background: var(--accent);
      color: #fff;
      border-radius: 8px;
      text-decoration: none;
      font-size: 0.9375rem;
      font-weight: 600;
      text-align: center;
      transition: opacity 0.2s;
    }

    .start-btn:hover {
      opacity: 0.88;
    }
  `],
})
export class LearnCatalogComponent {
  private learnService = inject(LearnService);
  languages: LanguageMeta[] = this.learnService.getLanguages();
}
