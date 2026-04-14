// src/app/features/learn/playground/playground.component.ts

import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Lesson } from '../curriculum/types';
import { HtmlPlaygroundComponent } from './html-playground.component';
import { LinuxPlaygroundComponent } from './linux-playground.component';
import { CodePlaygroundComponent } from './code-playground.component';

@Component({
  selector: 'app-playground',
  standalone: true,
  imports: [CommonModule, HtmlPlaygroundComponent, LinuxPlaygroundComponent, CodePlaygroundComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .playground-section { margin-top: 24px; }
    .playground-title {
      font-size: 16px; font-weight: 600; color: var(--color-text, #111827);
      margin-bottom: 12px; display: flex; align-items: center; gap: 8px;
    }
    .playground-title::before {
      content: ''; display: inline-block; width: 4px; height: 18px;
      background: var(--color-primary, #6366f1); border-radius: 2px;
    }
  `],
  template: `
    <div class="playground-section">
      <div class="playground-title">Try It Yourself</div>
      @switch (lesson.playgroundType) {
        @case ('html') {
          <app-html-playground [lesson]="lesson" />
        }
        @case ('linux') {
          <app-linux-playground [lesson]="lesson" />
        }
        @case ('code') {
          <app-code-playground [lesson]="lesson" [language]="language" />
        }
        @default {
          <p style="color:#888;font-style:italic">No playground available for this lesson.</p>
        }
      }
    </div>
  `,
})
export class PlaygroundComponent {
  @Input() lesson!: Lesson;
  @Input() language: 'csharp' | 'java' = 'csharp';
}
