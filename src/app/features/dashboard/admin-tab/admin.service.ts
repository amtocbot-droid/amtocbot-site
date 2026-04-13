import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface ConfigRow {
  key: string;
  value: string;
  updated_by: string | null;
  updated_at: string;
}

export interface JobStatus {
  paused: boolean;
  trigger_requested: boolean;
  last_run?: string;
  last_status?: string;
}

export interface AutomationRun {
  id: number;
  job: string;
  status: string;
  summary: string | null;
  started_at: string;
}

export interface PublishingItem {
  id: string;
  title: string;
  type: string;
  qa_status: string;
  blogger_posted: boolean;
  blogger_posted_at: string | null;
  linkedin_posted: boolean;
  linkedin_posted_at: string | null;
  x_posted: boolean;
  x_posted_at: string | null;
}

export interface SocialPost {
  id: number;
  content_id: string;
  platform: string;
  draft_body: string | null;
  status: string;
  posted_at: string | null;
  title: string;
  type: string;
}

export interface PipelineItem {
  id: number;
  content_id: string;
  stage: string;
  stage_updated_at: string;
  notes: string | null;
  title: string;
  type: string;
  date: string;
}

export interface ContentItem {
  id: string;
  type: string;
  title: string;
  date: string;
}

// ── Service ─────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class AdminService {
  private http = inject(HttpClient);

  // ── CMS Config ─────────────────────────────────────────────────────────

  getCmsConfig(): Observable<{ config: ConfigRow[] }> {
    return this.http.get<{ config: ConfigRow[] }>('/api/admin/cms');
  }

  updateCmsConfig(key: string, value: string): Observable<{ success: boolean }> {
    return this.http.patch<{ success: boolean }>('/api/admin/cms', { key, value });
  }

  // ── Automation ─────────────────────────────────────────────────────────

  getAutomationStatus(): Observable<{ jobs: Record<string, JobStatus>; recentRuns: AutomationRun[] }> {
    return this.http.get<{ jobs: Record<string, JobStatus>; recentRuns: AutomationRun[] }>('/api/admin/automation/status');
  }

  pauseJob(job: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>('/api/admin/automation/pause', { job });
  }

  resumeJob(job: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>('/api/admin/automation/resume', { job });
  }

  triggerJob(job: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>('/api/admin/automation/trigger', { job });
  }

  pauseAll(): Observable<{ success: boolean; paused: number }> {
    return this.http.post<{ success: boolean; paused: number }>('/api/admin/automation/pause-all', {});
  }

  resumeAll(): Observable<{ success: boolean; resumed: number }> {
    return this.http.post<{ success: boolean; resumed: number }>('/api/admin/automation/resume-all', {});
  }

  // ── Publishing Queue ────────────────────────────────────────────────────

  getPublishingQueue(): Observable<{ items: PublishingItem[] }> {
    return this.http.get<{ items: PublishingItem[] }>('/api/admin/publishing');
  }

  markCrossPost(contentId: string, platform: string, action: 'mark_posted' | 'mark_unposted'): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>('/api/admin/publishing', { content_id: contentId, platform, action });
  }

  // ── Social Queue ────────────────────────────────────────────────────────

  getSocialQueue(): Observable<{ posts: SocialPost[] }> {
    return this.http.get<{ posts: SocialPost[] }>('/api/admin/social');
  }

  updateSocialPost(contentId: string, platform: string, status: string, draftBody?: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>('/api/admin/social', {
      action: 'update', content_id: contentId, platform, status, draft_body: draftBody,
    });
  }

  syncSocialQueue(): Observable<{ synced: number }> {
    return this.http.post<{ synced: number }>('/api/admin/social', { action: 'sync' });
  }

  // ── Production Pipeline ─────────────────────────────────────────────────

  getPipeline(): Observable<{ tracked: PipelineItem[]; untracked: ContentItem[] }> {
    return this.http.get<{ tracked: PipelineItem[]; untracked: ContentItem[] }>('/api/admin/pipeline');
  }

  addToPipeline(contentId: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>('/api/admin/pipeline', { action: 'add', content_id: contentId });
  }

  updatePipelineStage(contentId: string, stage: string, notes?: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>('/api/admin/pipeline', { action: 'update', content_id: contentId, stage, notes });
  }
}
