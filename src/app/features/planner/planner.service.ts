// src/app/features/planner/planner.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface CalendarProposal {
  id: number;
  week_start: string;
  status: string;
  generated_at: string | null;
  trigger_type: string;
  trend_sources: string | null;
  performance_summary: string | null;
  created_at: string;
  item_counts?: Record<string, number>;
}

export interface CalendarItem {
  id: number;
  proposal_id: number;
  day: string;
  slot: number;
  type: string;
  title: string;
  topic: string | null;
  level: string | null;
  reasoning: string | null;
  status: string;
  content_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProposalDetail {
  proposal: CalendarProposal;
  items: CalendarItem[];
}

export interface GenerateResponse {
  ok: boolean;
  proposal: CalendarProposal;
  items: CalendarItem[];
  trends_count: number;
}

export interface TrendSource {
  reddit: { sub: string; title: string; score: number; topic_match: string | null }[];
  hn: { title: string; score: number; topic_match: string | null }[];
  fetched_at: string;
}

export interface PerformanceSummary {
  top_topics: { topic: string; avg_views: number; count: number }[];
  format_perf: { type: string; avg_views: number }[];
  level_dist: { level: string; count: number }[];
  recency_gaps: string[];
  growth_leaders: { content_id: string; growth: number }[];
}

@Injectable({ providedIn: 'root' })
export class PlannerService {
  private http = inject(HttpClient);

  listProposals(status?: string, limit = 10): Observable<{ proposals: CalendarProposal[] }> {
    let url = `/api/admin/calendar/proposals?limit=${limit}`;
    if (status) url += `&status=${status}`;
    return this.http.get<{ proposals: CalendarProposal[] }>(url);
  }

  getProposal(id: number): Observable<ProposalDetail> {
    return this.http.get<ProposalDetail>(`/api/admin/calendar/proposals/${id}`);
  }

  generate(): Observable<GenerateResponse> {
    return this.http.post<GenerateResponse>('/api/admin/calendar/generate', { trigger_type: 'manual' });
  }

  approve(id: number): Observable<ProposalDetail & { ok: boolean }> {
    return this.http.post<ProposalDetail & { ok: boolean }>(`/api/admin/calendar/proposals/${id}/approve`, {});
  }

  regenerate(id: number): Observable<{ ok: boolean; replaced: number; items: CalendarItem[] }> {
    return this.http.post<{ ok: boolean; replaced: number; items: CalendarItem[] }>(
      `/api/admin/calendar/proposals/${id}/regenerate`, {}
    );
  }

  updateItem(id: number, updates: Partial<CalendarItem>): Observable<{ ok: boolean; item: CalendarItem }> {
    return this.http.patch<{ ok: boolean; item: CalendarItem }>(`/api/admin/calendar/items/${id}`, updates);
  }
}
