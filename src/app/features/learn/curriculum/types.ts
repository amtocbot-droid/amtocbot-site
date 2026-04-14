// src/app/features/learn/curriculum/types.ts

export type Language = 'html' | 'linux' | 'csharp' | 'java';
export type Level = 'beginner' | 'intermediate' | 'advanced';
export type PlaygroundType = 'html' | 'linux' | 'code';

export interface Lesson {
  slug: string;
  title: string;
  concept: string;
  storyTitle: string;
  storyHtml: string;
  playgroundType: PlaygroundType;
  starterCode: string;
  challenge: string;
  reflectionPrompt: string;
  youtubeId?: string;
  nextSlug?: string;
  prevSlug?: string;
}

export interface LanguageMeta {
  id: Language;
  label: string;
  icon: string;
  description: string;
  color: string;
}
