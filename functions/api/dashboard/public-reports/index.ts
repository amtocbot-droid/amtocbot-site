/**
 * GET /api/dashboard/public-reports — List all public issue reports (paginated).
 * Requires: dashboard.view
 */
import { Env, jsonResponse, optionsHandler, requireDashboardAuth } from '../_shared';

interface PublicReportRow {
  id: number;
  report_type: string;
  title: string;
  description: string;
  page_url: string | null;
  content_type: string | null;
  content_ref: string | null;
  severity: string;
  name: string | null;
  email: string | null;
  user_id: number | null;
  username: string | null;
  status: string;
  ip_address: string | null;
  assigned_to: number | null;
  resolved_at: string | null;
  resolution: string | null;
  created_at: string;
  updated_at: string;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const db = env.ENGAGE_DB;
  const auth = await requireDashboardAuth(request, db, 'dashboard.view');
  if (auth instanceof Response) return auth;

  const url         = new URL(request.url);
  const status      = url.searchParams.get('status') || null;
  const report_type = url.searchParams.get('type') || null;
  const severity    = url.searchParams.get('severity') || null;
  const limit       = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
  const offset      = parseInt(url.searchParams.get('offset') || '0', 10);

  let sql = 'SELECT * FROM public_reports WHERE 1=1';
  const binds: unknown[] = [];

  if (status)      { sql += ' AND status = ?';      binds.push(status); }
  if (report_type) { sql += ' AND report_type = ?'; binds.push(report_type); }
  if (severity)    { sql += ' AND severity = ?';    binds.push(severity); }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  binds.push(limit, offset);

  const [rows, total] = await Promise.all([
    db.prepare(sql).bind(...binds).all<PublicReportRow>(),
    db.prepare('SELECT COUNT(*) as n FROM public_reports').first<{ n: number }>(),
  ]);

  return jsonResponse({ items: rows.results || [], total: total?.n ?? 0, limit, offset });
};

export const onRequestOptions = optionsHandler;
