/**
 * GET  /api/dashboard/public-feedback          — List all public feedback submissions (paginated).
 * PATCH /api/dashboard/public-feedback/:id     — Update status of a submission.
 *
 * Requires: dashboard.view (GET), issues.update_status (PATCH)
 */
import { Env, jsonResponse, optionsHandler, requireDashboardAuth } from '../_shared';

interface PublicFeedbackRow {
  id: number;
  category: string;
  subject: string;
  message: string;
  name: string | null;
  email: string | null;
  user_id: number | null;
  username: string | null;
  status: string;
  ip_address: string | null;
  created_at: string;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const db = env.ENGAGE_DB;
  const auth = await requireDashboardAuth(request, db, 'dashboard.view');
  if (auth instanceof Response) return auth;

  const url      = new URL(request.url);
  const status   = url.searchParams.get('status') || null;
  const category = url.searchParams.get('category') || null;
  const limit    = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
  const offset   = parseInt(url.searchParams.get('offset') || '0', 10);

  let sql = 'SELECT * FROM public_feedback WHERE 1=1';
  const binds: unknown[] = [];

  if (status) { sql += ' AND status = ?'; binds.push(status); }
  if (category) { sql += ' AND category = ?'; binds.push(category); }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  binds.push(limit, offset);

  const [rows, total] = await Promise.all([
    db.prepare(sql).bind(...binds).all<PublicFeedbackRow>(),
    db.prepare('SELECT COUNT(*) as n FROM public_feedback' + (status ? ' WHERE status = ?' : ''))
      .bind(...(status ? [status] : [])).first<{ n: number }>(),
  ]);

  return jsonResponse({ items: rows.results || [], total: total?.n ?? 0, limit, offset });
};

export const onRequestOptions = optionsHandler;
