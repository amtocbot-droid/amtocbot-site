// GET /api/admin/sessions — Active session viewer (superadmin only)
import { Env, getSessionUser, requirePermission, jsonResponse, optionsHandler } from '../../_shared/auth';

export const onRequestOptions = optionsHandler;

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const db = env.ENGAGE_DB;

  const user = await getSessionUser(request, db);
  const denied = requirePermission(user, 'sessions.view');
  if (denied) return denied;

  const { results } = await db.prepare(`
    SELECT s.id, s.user_id, u.username, u.role, s.verified,
           s.created_at, s.expires_at
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.verified = 1 AND s.expires_at > datetime('now')
    ORDER BY s.created_at DESC
    LIMIT 200
  `).all();

  return jsonResponse({ sessions: results || [] });
};
