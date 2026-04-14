// src/app/features/learn/learn-lesson.component.ts

import { Component, computed, inject, OnInit, signal, ViewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LearnService } from './learn.service';
import { Language, Lesson, Level } from './curriculum/types';
import { PlaygroundComponent } from './playground/playground.component';
import { RecordingComponent } from './recording/recording.component';
import { RecordingFeedComponent } from './recording/recording-feed.component';

@Component({
  selector: 'app-learn-lesson',
  standalone: true,
  imports: [RouterLink, PlaygroundComponent, RecordingComponent, RecordingFeedComponent],
  template: `
    <div class="lesson-page">
      @if (lesson()) {
        <nav class="breadcrumb" aria-label="Breadcrumb">
          <a routerLink="/learn" class="bc-link">Tutorials</a>
          <span class="bc-sep">›</span>
          <a [routerLink]="['/learn', language()]" class="bc-link bc-lang">{{ languageLabel() }}</a>
          <span class="bc-sep">›</span>
          <span class="bc-level">{{ levelLabel() }}</span>
          <span class="bc-sep">›</span>
          <span class="bc-current">{{ lesson()!.title }}</span>
        </nav>

        <header class="lesson-header">
          <div class="lesson-meta-chips">
            <span class="chip chip-lang">{{ languageLabel() }}</span>
            <span class="chip chip-level">{{ levelLabel() }}</span>
          </div>
          <h1 class="lesson-title">{{ lesson()!.title }}</h1>
          <p class="lesson-concept">{{ lesson()!.concept }}</p>
        </header>

        <section class="story-section" aria-label="Story">
          <div class="story-label">
            <span class="material-symbols-outlined story-icon">menu_book</span>
            {{ lesson()!.storyTitle }}
          </div>
          <div class="story-body" [innerHTML]="lesson()!.storyHtml"></div>
        </section>

        <section class="reflection-section" aria-label="Reflection">
          <blockquote class="reflection-card">
            <span class="material-symbols-outlined reflection-icon">psychology</span>
            <div>
              <div class="reflection-label">Reflect</div>
              <p class="reflection-text">{{ lesson()!.reflectionPrompt }}</p>
            </div>
          </blockquote>
        </section>

        <!-- Playground (Plan B) -->
        <app-playground [lesson]="lesson()!" [language]="playgroundLanguage()" />

        <!-- Record Your Understanding (Plan C) -->
        <section class="recording-section">
          <app-recording
            [language]="language()"
            [level]="level()"
            [slug]="lesson()!.slug"
            (recordingSubmitted)="onRecordingSubmitted()"
          />
        </section>

        <!-- Community Feed (Plan C) -->
        <section class="feed-section">
          <app-recording-feed
            #feed
            [language]="language()"
            [level]="level()"
            [slug]="lesson()!.slug"
          />
        </section>

        <nav class="lesson-nav" aria-label="Lesson navigation">
          @if (lesson()!.prevSlug) {
            <a [routerLink]="['/learn', language(), level(), lesson()!.prevSlug]" class="lesson-nav-btn prev-btn">
              ← Previous Lesson
            </a>
          } @else {
            <span class="lesson-nav-placeholder"></span>
          }
          <a [routerLink]="['/learn', language()]" class="lesson-nav-track">All {{ levelLabel() }} Lessons</a>
          @if (lesson()!.nextSlug) {
            <a [routerLink]="['/learn', language(), level(), lesson()!.nextSlug]" class="lesson-nav-btn next-btn">
              Next Lesson →
            </a>
          } @else {
            <span class="lesson-nav-placeholder"></span>
          }
        </nav>
      } @else {
        <div class="not-found">
          <h2>Lesson not found</h2>
          <a routerLink="/learn">← Back to catalog</a>
        </div>
      }
    </div>
  `,
  styles: [`
    .lesson-page { max-width: 760px; margin: 0 auto; padding: 2rem 1.5rem 4rem; }
    .breadcrumb { display: flex; align-items: center; gap: 0.375rem; font-size: 0.85rem; color: var(--color-muted, #6b7280); margin-bottom: 1.75rem; flex-wrap: wrap; }
    .bc-link { color: var(--color-primary, #6366f1); text-decoration: none; }
    .bc-link:hover { text-decoration: underline; }
    .bc-sep { color: var(--color-border, #d1d5db); }
    .bc-current { font-weight: 500; color: var(--color-text, #111827); }
    .lesson-header { margin-bottom: 2.5rem; }
    .lesson-meta-chips { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
    .chip { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.8125rem; font-weight: 600; }
    .chip-lang { background: color-mix(in srgb, var(--color-primary, #6366f1) 12%, transparent); color: var(--color-primary, #6366f1); }
    .chip-level { background: color-mix(in srgb, #22c55e 12%, transparent); color: #16a34a; }
    .lesson-title { font-size: 2rem; font-weight: 700; margin: 0 0 0.5rem; color: var(--color-text, #111827); line-height: 1.25; }
    .lesson-concept { font-size: 1.0625rem; color: var(--color-muted, #6b7280); margin: 0; }
    .story-section { background: var(--color-surface, #f9fafb); border: 1px solid var(--color-border, #e5e7eb); border-radius: 12px; padding: 1.75rem; margin-bottom: 1.75rem; }
    .story-label { display: flex; align-items: center; gap: 0.5rem; font-weight: 700; font-size: 1.0625rem; color: var(--color-text, #111827); margin-bottom: 1.25rem; }
    .story-icon { color: var(--color-primary, #6366f1); font-size: 1.375rem; }
    .story-body { font-size: 1rem; line-height: 1.75; color: var(--color-text, #374151); }
    .reflection-section { margin-bottom: 1.75rem; }
    .reflection-card { display: flex; align-items: flex-start; gap: 1rem; background: color-mix(in srgb, var(--color-primary, #6366f1) 6%, var(--color-surface, #ffffff)); border-left: 4px solid var(--color-primary, #6366f1); border-radius: 0 10px 10px 0; padding: 1.25rem 1.5rem; margin: 0; }
    .reflection-icon { font-size: 1.5rem; color: var(--color-primary, #6366f1); flex-shrink: 0; margin-top: 0.125rem; }
    .reflection-label { font-weight: 700; font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-primary, #6366f1); margin-bottom: 0.375rem; }
    .reflection-text { margin: 0; font-size: 1rem; line-height: 1.6; color: var(--color-text, #374151); }
    .recording-section { margin-bottom: 0; }
    .feed-section { margin-bottom: 2.5rem; }
    .lesson-nav { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding-top: 2rem; border-top: 1px solid var(--color-border, #e5e7eb); flex-wrap: wrap; }
    .lesson-nav-btn { padding: 0.625rem 1.125rem; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 0.9375rem; background: var(--color-surface, #f9fafb); border: 1px solid var(--color-border, #e5e7eb); color: var(--color-text, #111827); transition: border-color 0.15s, color 0.15s; }
    .lesson-nav-btn:hover { border-color: var(--color-primary, #6366f1); color: var(--color-primary, #6366f1); }
    .lesson-nav-track { font-size: 0.875rem; color: var(--color-muted, #6b7280); text-decoration: none; }
    .lesson-nav-track:hover { color: var(--color-text, #111827); }
    .lesson-nav-placeholder { flex: 1; }
    .not-found { text-align: center; padding: 4rem 1rem; }
  `],
})
export class LearnLessonComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private learnService = inject(LearnService);

  @ViewChild('feed') feedComponent!: RecordingFeedComponent;

  language = signal<Language>('html');
  level = signal<Level>('beginner');
  lesson = signal<Lesson | undefined>(undefined);

  languageLabel = signal('');
  levelLabel = signal('');

  onRecordingSubmitted(): void {
    this.feedComponent?.refresh();
  }

  protected readonly playgroundLanguage = computed(() => {
    const lang = this.route.snapshot.paramMap.get('language');
    return (lang === 'java' ? 'java' : 'csharp') as 'csharp' | 'java';
  });

  ngOnInit(): void {
    const langParam = this.route.snapshot.paramMap.get('language') ?? '';
    const levelParam = this.route.snapshot.paramMap.get('level') ?? '';
    const slugParam = this.route.snapshot.paramMap.get('slug') ?? '';

    if (this.learnService.isValidLanguage(langParam)) {
      this.language.set(langParam);
      this.languageLabel.set(this.learnService.getLanguageMeta(langParam)?.label ?? langParam);
    }
    if (this.learnService.isValidLevel(levelParam)) {
      this.level.set(levelParam);
      this.levelLabel.set(levelParam.charAt(0).toUpperCase() + levelParam.slice(1));
    }
    this.lesson.set(this.learnService.getLesson(langParam, levelParam, slugParam));
  }
}
