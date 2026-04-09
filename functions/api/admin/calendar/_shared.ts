/**
 * Shared types and helpers for calendar endpoints.
 */

import { jsonResponse, getSessionUser, optionsHandler } from '../../_shared/auth';

export { jsonResponse, getSessionUser, optionsHandler };

export interface Env {
  ENGAGE_DB: D1Database;
  SYNC_SECRET?: string;
}

export interface CalendarProposalRow {
  id: number;
  week_start: string;
  status: string;
  generated_at: string | null;
  trigger_type: string;
  trend_sources: string | null;
  performance_summary: string | null;
  created_at: string;
}

export interface CalendarItemRow {
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

export interface TopicPerformance {
  topic: string;
  avg_views: number;
  count: number;
}

export interface FormatPerformance {
  type: string;
  avg_views: number;
}

export interface TrendItem {
  source: 'reddit' | 'hn';
  sub?: string;
  title: string;
  score: number;
  comments: number;
  url: string;
  topic_match: string | null;
}

// Topic taxonomy keyword map
export const TOPIC_KEYWORDS: Record<string, string[]> = {
  'AI Agents': ['agent', 'agentic', 'tool use', 'function calling', 'mcp'],
  'Security': ['security', 'vulnerability', 'cve', 'zero trust', 'auth', 'exploit', 'malware'],
  'LLMs': ['llm', 'gpt', 'claude', 'language model', 'transformer', 'chatgpt', 'gemini'],
  'RAG': ['rag', 'retrieval', 'vector', 'embedding', 'semantic search'],
  'Performance': ['latency', 'optimization', 'benchmark', 'inference speed', 'quantization'],
  'Open Source': ['open source', 'hugging face', 'llama', 'mistral', 'ollama', 'weights'],
};

// Target content mix per week
export const WEEKLY_TARGETS = {
  blog: 7,
  video: 3,
  short: 1,
  podcast: 1,
};

// Target level distribution
export const LEVEL_TARGETS: Record<string, number> = {
  'Beginner': 0.36,
  'Intermediate': 0.36,
  'Advanced': 0.18,
  'Professional': 0.10,
};

/**
 * Match a title against the topic taxonomy.
 * Returns the first matching topic or null.
 */
export function matchTopic(title: string): string | null {
  const lower = title.toLowerCase();
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return topic;
    }
  }
  return null;
}

/**
 * Get the Monday of the next week from a given date.
 */
export function getNextMonday(from: Date = new Date()): string {
  const d = new Date(from);
  const day = d.getUTCDay();
  const diff = day === 0 ? 1 : 8 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().split('T')[0];
}

/**
 * Get an array of 7 date strings (Mon-Sun) starting from a Monday.
 */
export function getWeekDays(monday: string): string[] {
  const days: string[] = [];
  const d = new Date(monday + 'T00:00:00Z');
  for (let i = 0; i < 7; i++) {
    const day = new Date(d);
    day.setUTCDate(d.getUTCDate() + i);
    days.push(day.toISOString().split('T')[0]);
  }
  return days;
}

/**
 * Dual auth check: session (admin) OR bearer token.
 */
export async function requireCalendarAuth(
  request: Request, db: D1Database, syncSecret?: string
): Promise<{ authorized: boolean; error?: Response }> {
  const user = await getSessionUser(request, db);
  if (user && user.role === 'admin') return { authorized: true };

  const auth = request.headers.get('Authorization');
  const hasCfAccess = request.headers.get('CF-Access-JWT-Assertion');
  if (hasCfAccess || (syncSecret && auth === `Bearer ${syncSecret}`)) {
    return { authorized: true };
  }

  return { authorized: false, error: jsonResponse({ error: 'Unauthorized' }, 401) };
}
