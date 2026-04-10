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
