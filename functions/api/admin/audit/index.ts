// GET /api/admin/audit — Full audit log viewer (superadmin only)
import { Env, getSessionUser, requirePermission, jsonResponse, optionsHandler } from '../../_shared/auth';

export const onRequestOptions = optionsHandler;

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const db = env.ENGAGE_DB;

  const user = await getSessionUser(request, db);
  const denied = requirePermission(user, 'audit.view');
  if (denied) return denied;

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 500);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);
  const username = url.searchParams.get('username');
  const action = url.searchParams.get('action');

  let sql = `SELECT id, user_id, username, action, detail, ip_address, created_at
             FROM audit_logs WHERE 1=1`;
  const binds: unknown[] = [];

  if (username) { sql += ' AND username = ?'; binds.push(username); }
  if (action)   { sql += ' AND action LIKE ?'; binds.push(`%${action}%`); }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  binds.push(limit, offset);

  const { results } = await db.prepare(sql).bind(...binds).all();
  const countRow = await db.prepare('SELECT COUNT(*) as total FROM audit_logs')
    .first<{ total: number }>();

  return jsonResponse({
    items: results || [],
    meta: { limit, offset, total: countRow?.total || 0 },
  });
};
