/**
 * GET /api/dashboard/content
 * List content with QA status, filterable by type/qa_status/date.
 */
import { Env, jsonResponse, optionsHandler, requireDashboardAuth } from '../_shared';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const db = env.ENGAGE_DB;
  const auth = await requireDashboardAuth(request, db, 'dashboard.view');
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const type = url.searchParams.get('type');
  const qaStatus = url.searchParams.get('qa_status');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 500);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  let sql = 'SELECT id, type, title, date, level, status, qa_status, qa_updated_at, topic, blog_url, youtube_url FROM content WHERE 1=1';
  const binds: unknown[] = [];

  if (type) {
    sql += ' AND type = ?';
    binds.push(type);
  }
  if (qaStatus) {
    sql += ' AND qa_status = ?';
    binds.push(qaStatus);
  }

  sql += ' ORDER BY date DESC LIMIT ? OFFSET ?';
  binds.push(limit, offset);

  const result = await db.prepare(sql).bind(...binds).all();

  return jsonResponse({
    items: result.results || [],
    meta: { limit, offset },
  });
};

export const onRequestOptions = optionsHandler;
