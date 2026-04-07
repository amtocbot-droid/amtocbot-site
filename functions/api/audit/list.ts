/**
 * GET /api/audit/list
 * Returns paginated audit logs. Requires authenticated session.
 * Query params: ?page=1&limit=50&user=&action=
 */
import { Env, jsonResponse, optionsHandler, getSessionUser } from '../_shared/auth';

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

    const countStmt = params.length > 0 ? db.prepare(countQuery).bind(...params) : db.prepare(countQuery);
    const dataStmt = db.prepare(query).bind(...params, limit.toString(), offset.toString());
    const usersStmt = db.prepare('SELECT DISTINCT username FROM audit_logs ORDER BY username');
    const actionsStmt = db.prepare('SELECT DISTINCT action FROM audit_logs ORDER BY action');

    const [countRow, dataResult, usersResult, actionsResult] = await Promise.all([
      countStmt.first<{ total: number }>(),
      dataStmt.all(),
      usersStmt.all(),
      actionsStmt.all(),
    ]);

    const total = countRow?.total || 0;

    return jsonResponse({
      logs: dataResult.results,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      filters: {
        users: usersResult.results?.map((r: any) => r.username) || [],
        actions: actionsResult.results?.map((r: any) => r.action) || [],
      },
    });
  } catch (e) {
    console.error('Audit list error:', e);
    return jsonResponse({ error: 'Server error' }, 500);
  }
};

export const onRequestOptions = optionsHandler;
