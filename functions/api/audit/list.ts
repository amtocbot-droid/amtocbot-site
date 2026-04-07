/**
 * GET /api/audit/list
 * Returns paginated audit logs. Requires authenticated session.
 * Query params: ?page=1&limit=50&user=&action=
 */
import { Env, corsHeaders, jsonResponse, getSessionUser } from '../_shared/auth';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const db = env.ENGAGE_DB;

  try {
    const user = await getSessionUser(request, db);
    if (!user) {
      return jsonResponse({ error: 'Not authenticated' }, 401);
    }

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));
    const filterUser = url.searchParams.get('user') || '';
    const filterAction = url.searchParams.get('action') || '';
    const offset = (page - 1) * limit;

    let query = 'SELECT id, username, action, detail, ip_address, created_at FROM audit_logs';
    let countQuery = 'SELECT COUNT(*) as total FROM audit_logs';
    const conditions: string[] = [];
    const params: string[] = [];

    if (filterUser) {
      conditions.push('username = ?');
      params.push(filterUser);
    }
    if (filterAction) {
      conditions.push('action = ?');
      params.push(filterAction);
    }

    if (conditions.length > 0) {
      const where = ' WHERE ' + conditions.join(' AND ');
      query += where;
      countQuery += where;
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';

    // Get total count
    const countStmt = db.prepare(countQuery);
    const boundCount = params.length > 0 ? countStmt.bind(...params) : countStmt;
    const countRow = await boundCount.first<{ total: number }>();
    const total = countRow?.total || 0;

    // Get page of results
    const dataStmt = db.prepare(query);
    const allParams = [...params, limit.toString(), offset.toString()];
    const boundData = dataStmt.bind(...allParams);
    const { results } = await boundData.all();

    // Get distinct users and actions for filter dropdowns
    const users = await db.prepare('SELECT DISTINCT username FROM audit_logs ORDER BY username').all();
    const actions = await db.prepare('SELECT DISTINCT action FROM audit_logs ORDER BY action').all();

    return jsonResponse({
      logs: results,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      filters: {
        users: users.results?.map((r: any) => r.username) || [],
        actions: actions.results?.map((r: any) => r.action) || [],
      },
    });
  } catch (e) {
    console.error('Audit list error:', e);
    return jsonResponse({ error: 'Server error' }, 500);
  }
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { headers: corsHeaders });
};
