import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  ContentData,
  BlogPost,
  Video,
  Milestone,
  PlatformAccount,
} from '../models/content.model';

@Injectable({ providedIn: 'root' })
export class ContentService {
  private http = inject(HttpClient);

  blogs = signal<BlogPost[]>([]);
  videos = signal<Video[]>([]);
  milestones = signal<Milestone[]>([]);
  platforms = signal<PlatformAccount[]>([]);
  weeklySummary = signal<ContentData['weeklySummary'] | null>(null);
  monthlySummary = signal<ContentData['monthlySummary'] | null>(null);

  private loaded = false;

  load(): void {
    if (this.loaded) return;
    this.loaded = true;

    this.http.get<ContentData>('/assets/data/content.json').subscribe((data) => {
      this.blogs.set(data.blogs);
      this.videos.set(data.videos);
      this.milestones.set(data.milestones);
      this.platforms.set(data.platforms);
      this.weeklySummary.set(data.weeklySummary);
      this.monthlySummary.set(data.monthlySummary);
    });
  }
}

export default ContentService;
