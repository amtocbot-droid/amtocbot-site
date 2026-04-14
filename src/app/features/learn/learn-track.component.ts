// src/app/features/learn/learn-track.component.ts

import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LearnService } from './learn.service';
import { Language, LanguageMeta, Level } from './curriculum/types';

const LEVELS: { id: Level; label: string }[] = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
];

@Component({
  selector: 'app-learn-track',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="track-page">
      @if (languageMeta()) {
        <div class="track-header" [style.--accent]="languageMeta()!.color">
          <a routerLink="/learn" class="breadcrumb-back">← All Languages</a>
          <div class="track-title-row">
            <span class="material-symbols-outlined track-lang-icon">{{ languageMeta()!.icon }}</span>
            <h1 class="track-title">{{ languageMeta()!.label }}</h1>
          </div>
          <p class="track-desc">{{ languageMeta()!.description }}</p>
        </div>

        <div class="level-tabs">
          @for (lvl of levelList; track lvl.id) {
            <button
              class="level-tab"
              [class.active]="activeLevel() === lvl.id"
              (click)="activeLevel.set(lvl.id)">
              {{ lvl.label }}
              <span class="lesson-count">{{ getLessonCount(lvl.id) }}</span>
            </button>
          }
        </div>

        <div class="lesson-list">
          @if (lessons().length === 0) {
            <div class="empty-state">
              <span class="material-symbols-outlined empty-icon">construction</span>
              <p>{{ levelLabel() }} lessons are coming soon. Start with Beginner!</p>
            </div>
          } @else {
            @for (lesson of lessons(); track lesson.slug; let i = $index) {
              <a
                [routerLink]="['/learn', language(), activeLevel(), lesson.slug]"
                class="lesson-card">
                <span class="lesson-number">{{ i + 1 }}</span>
                <div class="lesson-info">
                  <div class="lesson-title">{{ lesson.title }}</div>
                  <div class="lesson-concept">{{ lesson.concept }}</div>
                </div>
                <span class="lesson-arrow">→</span>
              </a>
            }
          }
        </div>
      } @else {
        <div class="not-found">
          <h2>Language not found</h2>
          <a routerLink="/learn">← Back to catalog</a>
        </div>
      }
    </div>
  `,
  styles: [`
    .track-page { max-width: 780px; margin: 0 auto; padding: 2.5rem 1.5rem; }
    .breadcrumb-back { display: inline-block; color: var(--color-muted, #6b7280); text-decoration: none; font-size: 0.9rem; margin-bottom: 1.25rem; }
    .breadcrumb-back:hover { color: var(--color-text, #111827); }
    .track-title-row { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; }
    .track-lang-icon { font-size: 2rem; color: var(--accent); }
    .track-title { font-size: 2rem; font-weight: 700; margin: 0; color: var(--color-text, #111827); }
    .track-desc { color: var(--color-muted, #6b7280); font-size: 1rem; line-height: 1.5; margin: 0 0 2rem; }
    .level-tabs { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; border-bottom: 2px solid var(--color-border, #e5e7eb); padding-bottom: 0; }
    .level-tab { padding: 0.625rem 1.25rem; border: none; background: none; cursor: pointer; font-size: 0.9375rem; font-weight: 500; color: var(--color-muted, #6b7280); border-bottom: 3px solid transparent; margin-bottom: -2px; display: flex; align-items: center; gap: 0.4rem; transition: color 0.15s; }
    .level-tab.active { color: var(--accent); border-bottom-color: var(--accent); }
    .level-tab:hover:not(.active) { color: var(--color-text, #111827); }
    .lesson-count { background: var(--color-border, #e5e7eb); color: var(--color-muted, #6b7280); font-size: 0.75rem; border-radius: 10px; padding: 1px 7px; }
    .level-tab.active .lesson-count { background: color-mix(in srgb, var(--accent) 15%, transparent); color: var(--accent); }
    .lesson-list { display: flex; flex-direction: column; gap: 0.75rem; }
    .lesson-card { display: flex; align-items: center; gap: 1rem; padding: 1rem 1.25rem; background: var(--color-surface, #ffffff); border: 1px solid var(--color-border, #e5e7eb); border-radius: 10px; text-decoration: none; color: inherit; transition: box-shadow 0.15s, border-color 0.15s; }
    .lesson-card:hover { border-color: var(--accent); box-shadow: 0 2px 12px rgba(0,0,0,0.07); }
    .lesson-number { width: 32px; height: 32px; border-radius: 50%; background: color-mix(in srgb, var(--accent) 12%, transparent); color: var(--accent); font-size: 0.875rem; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .lesson-info { flex: 1; min-width: 0; }
    .lesson-title { font-weight: 600; font-size: 1rem; color: var(--color-text, #111827); }
    .lesson-concept { font-size: 0.875rem; color: var(--color-muted, #6b7280); margin-top: 0.125rem; }
    .lesson-arrow { color: var(--color-muted, #6b7280); font-size: 1.125rem; }
    .empty-state { text-align: center; padding: 3rem 1rem; color: var(--color-muted, #6b7280); }
    .empty-icon { font-size: 3rem; display: block; margin-bottom: 0.75rem; }
    .not-found { text-align: center; padding: 4rem 1rem; }
  `],
})
export class LearnTrackComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private learnService = inject(LearnService);

  levelList = LEVELS;
  language = signal<Language>('html');
  activeLevel = signal<Level>('beginner');
  languageMeta = signal<LanguageMeta | undefined>(undefined);

  lessons = computed(() =>
    this.learnService.getLessons(this.language(), this.activeLevel())
  );

  levelLabel = computed(() =>
    LEVELS.find(l => l.id === this.activeLevel())?.label ?? ''
  );

  ngOnInit(): void {
    const langParam = this.route.snapshot.paramMap.get('language') ?? '';
    if (this.learnService.isValidLanguage(langParam)) {
      this.language.set(langParam);
      this.languageMeta.set(this.learnService.getLanguageMeta(langParam));
    }
  }

  getLessonCount(level: Level): number {
    return this.learnService.getLessons(this.language(), level).length;
  }
}
