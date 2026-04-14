import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

// ── Types ─────────────────────────────────────────────────────

export interface SecurityAlert {
  username: string;
  path: string;
  reason: 'unauthenticated' | 'unauthorized';
  ip: string;
  created_at: string;
}

export interface DashboardStats {
  openIssues: number;
  pendingApprovals: number;
  totalContent: number;
  totalUsers?: number;
  issuesByStatus: Record<string, number>;
  contentByQA: Record<string, number>;
  recentActivity: { action: string; username: string; detail: string | null; created_at: string }[];
  myIssuesCount?: number;
  assignedToMe?: number;
  securityAlerts?: { count: number; recent: SecurityAlert[] };
}

export interface ContentItem {
  id: string;
  type: string;
  title: string;
  date: string;
  level: string | null;
  status: string;
  qa_status: string;
  qa_updated_at: string | null;
  topic: string | null;
  blog_url: string | null;
  youtube_url: string | null;
}

export interface ContentDetail extends ContentItem {
  description: string | null;       // body_draft
  external_url: string | null;
  reviewer_instructions: string | null;
}

export interface ContentFeedback {
  id: number;
  content_id: string;
  user_id: number;
  username: string;
  body: string;
  status: 'open' | 'resolved';
  resolved_by: number | null;
  resolved_at: string | null;
  created_at: string;
}

export interface CreateContentBody {
  title: string;
  type: string;
  date: string;
  level?: string;
  topic?: string;
  body_draft?: string;
  external_url?: string;
  reviewer_instructions?: string;
}

export interface Issue {
  id: number;
  title: string;
  description: string | null;
  type: string;
  severity: string;
  status: string;
  content_id: string | null;
  created_by: number;
  assigned_to: number | null;
  creator_name: string;
  assignee_name: string | null;
  closer_name?: string | null;
  content_title?: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface IssueComment {
  id: number;
  issue_id: number;
  user_id: number;
  username: string;
  body: string;
  created_at: string;
}

export interface DashboardUser {
  id: number;
  username: string;
  email: string;
  role: string;
  invited_by: string | null;
  created_at: string;
}

export interface ContentFilters {
  type?: string;
  qa_status?: string;
  limit?: number;
  offset?: number;
}

export interface IssueFilters {
  status?: string;
  type?: string;
  severity?: string;
  assigned_to?: string;
  content_id?: string;
  limit?: number;
  offset?: number;
}

// ── Service ───────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private http = inject(HttpClient);

  // Stats
  getStats(): Observable<DashboardStats> {
    return this.http.get<DashboardStats>('/api/dashboard/stats');
  }

  // Content QA
  listContent(filters: ContentFilters = {}): Observable<{ items: ContentItem[]; meta: { limit: number; offset: number } }> {
    let params = new HttpParams();
    if (filters.type) params = params.set('type', filters.type);
    if (filters.qa_status) params = params.set('qa_status', filters.qa_status);
    if (filters.limit) params = params.set('limit', filters.limit.toString());
    if (filters.offset) params = params.set('offset', filters.offset.toString());
    return this.http.get<{ items: ContentItem[]; meta: { limit: number; offset: number } }>('/api/dashboard/content', { params });
  }

  updateContentQA(id: string, qaStatus: string): Observable<{ success: boolean; qa_status: string }> {
    return this.http.patch<{ success: boolean; qa_status: string }>(`/api/dashboard/content/${id}/qa`, { qa_status: qaStatus });
  }

  // Content CRUD
  createContent(data: CreateContentBody): Observable<{ success: boolean; id: string }> {
    return this.http.post<{ success: boolean; id: string }>('/api/dashboard/content', data);
  }

  getContent(id: string): Observable<{ content: ContentDetail }> {
    return this.http.get<{ content: ContentDetail }>(`/api/dashboard/content/${id}`);
  }

  updateContent(id: string, data: Partial<CreateContentBody>): Observable<{ success: boolean }> {
    return this.http.patch<{ success: boolean }>(`/api/dashboard/content/${id}`, data);
  }

  deleteContent(id: string): Observable<{ success: boolean; id: string }> {
    return this.http.delete<{ success: boolean; id: string }>(`/api/dashboard/content/${id}`);
  }

  // Content Feedback
  listContentFeedback(contentId: string): Observable<{ items: ContentFeedback[] }> {
    return this.http.get<{ items: ContentFeedback[] }>(`/api/dashboard/content/${contentId}/feedback`);
  }

  addContentFeedback(contentId: string, body: string): Observable<{ success: boolean; item: ContentFeedback }> {
    return this.http.post<{ success: boolean; item: ContentFeedback }>(`/api/dashboard/content/${contentId}/feedback`, { body });
  }

  resolveContentFeedback(contentId: string, feedbackId: number, status: 'open' | 'resolved'): Observable<{ success: boolean }> {
    return this.http.patch<{ success: boolean }>(`/api/dashboard/content/${contentId}/feedback/${feedbackId}`, { status });
  }

  // Issues
  listIssues(filters: IssueFilters = {}): Observable<{ items: Issue[]; meta: { limit: number; offset: number } }> {
    let params = new HttpParams();
    if (filters.status) params = params.set('status', filters.status);
    if (filters.type) params = params.set('type', filters.type);
    if (filters.severity) params = params.set('severity', filters.severity);
    if (filters.assigned_to) params = params.set('assigned_to', filters.assigned_to);
    if (filters.content_id) params = params.set('content_id', filters.content_id);
    return this.http.get<{ items: Issue[]; meta: { limit: number; offset: number } }>('/api/dashboard/issues', { params });
  }

  createIssue(data: { title: string; description?: string; type?: string; severity?: string; content_id?: string; assigned_to?: number }): Observable<{ success: boolean; id: number }> {
    return this.http.post<{ success: boolean; id: number }>('/api/dashboard/issues', data);
  }

  getIssue(id: number): Observable<{ issue: Issue; comments: IssueComment[] }> {
    return this.http.get<{ issue: Issue; comments: IssueComment[] }>(`/api/dashboard/issues/${id}`);
  }

  updateIssue(id: number, data: { status?: string; severity?: string; assigned_to?: number | null }): Observable<{ success: boolean }> {
    return this.http.patch<{ success: boolean }>(`/api/dashboard/issues/${id}`, data);
  }

  addComment(issueId: number, body: string): Observable<{ success: boolean; comment: IssueComment }> {
    return this.http.post<{ success: boolean; comment: IssueComment }>(`/api/dashboard/issues/${issueId}/comments`, { body });
  }

  // Users (admin)
  listUsers(): Observable<{ users: DashboardUser[] }> {
    return this.http.get<{ users: DashboardUser[] }>('/api/dashboard/users');
  }

  updateUserRole(userId: number, role: string): Observable<{ success: boolean; username: string; role: string }> {
    return this.http.patch<{ success: boolean; username: string; role: string }>(`/api/dashboard/users/${userId}`, { role });
  }

  inviteUser(data: { username: string; email: string; role: string }): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>('/api/auth/invite', data);
  }
}
