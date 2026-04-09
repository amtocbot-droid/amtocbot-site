/**
 * Shared types and helpers for dashboard endpoints.
 */
import { Env, SessionUser, getSessionUser, jsonResponse, requirePermission, type Permission } from '../_shared/auth';

export { Env, SessionUser, getSessionUser, jsonResponse, requirePermission, type Permission };
export { corsHeaders, optionsHandler, logAudit, hasPermission, getClientIP } from '../_shared/auth';

// ── Issue types ───────────────────────────────────────────────
export const ISSUE_TYPES = ['bug', 'task', 'content_fix', 'video_sync', 'quality'] as const;
export const ISSUE_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export const ISSUE_STATUSES = ['open', 'in_progress', 'resolved', 'closed', 'wont_fix'] as const;

export interface IssueRow {
  id: number;
  title: string;
  description: string | null;
  type: string;
  severity: string;
  status: string;
  content_id: string | null;
  created_by: number;
  assigned_to: number | null;
  closed_by: number | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface IssueCommentRow {
  id: number;
  issue_id: number;
  user_id: number;
  username: string;
  body: string;
  created_at: string;
}

// ── QA statuses ───────────────────────────────────────────────
export const QA_STATUSES = ['draft', 'in_review', 'approved', 'published', 'flagged', 'rejected'] as const;
export type QAStatus = typeof QA_STATUSES[number];

/** Require dashboard auth: any of the 4 dashboard roles OR bearer token. */
export async function requireDashboardAuth(
  request: Request,
  db: D1Database,
  perm: Permission,
  syncSecret?: string,
): Promise<{ user: SessionUser } | Response> {
  // Bearer token shortcut for automation
  const authHeader = request.headers.get('Authorization');
  if (syncSecret && authHeader === `Bearer ${syncSecret}`) {
    return { user: { user_id: 0, username: 'automation', role: 'admin' } };
  }

  const user = await getSessionUser(request, db);
  const denied = requirePermission(user, perm);
  if (denied) return denied;
  return { user: user! };
}
