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
