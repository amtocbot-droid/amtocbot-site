// src/app/features/learn/learn.service.ts

import { Injectable } from '@angular/core';
import { Language, LanguageMeta, Lesson, Level } from './curriculum/types';
import { HTML_BEGINNER } from './curriculum/html.curriculum';
import { LINUX_BEGINNER } from './curriculum/linux.curriculum';
import { CSHARP_BEGINNER } from './curriculum/csharp.curriculum';
import { JAVA_BEGINNER } from './curriculum/java.curriculum';

const LANGUAGE_META: LanguageMeta[] = [
  {
    id: 'html',
    label: 'HTML',
    icon: 'code',
    description: 'Learn to structure the web with tags, links, and forms. The foundation of every webpage.',
    color: '#e34c26',
  },
  {
    id: 'linux',
    label: 'Linux',
    icon: 'terminal',
    description: 'Master the command line: navigate filesystems, manage files, and automate with shell scripts.',
    color: '#f0c040',
  },
  {
    id: 'csharp',
    label: 'C#',
    icon: 'deployed_code',
    description: 'A powerful typed language for enterprise apps, games (Unity), and cloud services on .NET.',
    color: '#9b59b6',
  },
  {
    id: 'java',
    label: 'Java',
    icon: 'coffee',
    description: 'Write once, run anywhere. The language behind Android, enterprise systems, and millions of servers.',
    color: '#e76f51',
  },
];

const CURRICULUM: Record<Language, Record<Level, Lesson[]>> = {
  html:   { beginner: HTML_BEGINNER,   intermediate: [], advanced: [] },
  linux:  { beginner: LINUX_BEGINNER,  intermediate: [], advanced: [] },
  csharp: { beginner: CSHARP_BEGINNER, intermediate: [], advanced: [] },
  java:   { beginner: JAVA_BEGINNER,   intermediate: [], advanced: [] },
};

@Injectable({ providedIn: 'root' })
export class LearnService {
  getLanguages(): LanguageMeta[] {
    return LANGUAGE_META;
  }

  getLanguageMeta(language: string): LanguageMeta | undefined {
    return LANGUAGE_META.find(l => l.id === language);
  }

  getLessons(language: string, level: string): Lesson[] {
    if (!this.isValidLanguage(language) || !this.isValidLevel(level)) return [];
    return CURRICULUM[language as Language][level as Level];
  }

  getLesson(language: string, level: string, slug: string): Lesson | undefined {
    return this.getLessons(language, level).find(l => l.slug === slug);
  }

  isValidLanguage(language: string): language is Language {
    return ['html', 'linux', 'csharp', 'java'].includes(language);
  }

  isValidLevel(level: string): level is Level {
    return ['beginner', 'intermediate', 'advanced'].includes(level);
  }
}
