/**
 * PATCH /api/dashboard/users/:id — Update user role (admin only)
 */
import { Env, jsonResponse, optionsHandler, requireDashboardAuth, logAudit } from '../_shared';
import { VALID_ROLES } from '../../_shared/auth';

export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) => {
  const db = env.ENGAGE_DB;
  const auth = await requireDashboardAuth(request, db, 'users.manage');
  if (auth instanceof Response) return auth;
  const { user } = auth;

  const userId = parseInt(params.id as string, 10);
  if (isNaN(userId)) return jsonResponse({ error: 'Invalid user ID' }, 400);

  const body = await request.json() as { role?: string };
  if (!body.role || ![...VALID_ROLES, 'member'].includes(body.role)) {
    return jsonResponse({ error: `Invalid role. Must be one of: ${[...VALID_ROLES, 'member'].join(', ')}` }, 400);
  }

  // Prevent admins from demoting themselves
  if (userId === user.user_id && body.role !== 'admin') {
    return jsonResponse({ error: 'Cannot change your own role' }, 400);
  }

  const target = await db.prepare('SELECT id, username, role FROM users WHERE id = ?').bind(userId).first<{ id: number; username: string; role: string }>();
  if (!target) return jsonResponse({ error: 'User not found' }, 404);

  await db.prepare('UPDATE users SET role = ? WHERE id = ?').bind(body.role, userId).run();
  await logAudit(db, user, 'role_changed', JSON.stringify({ userId, username: target.username, from: target.role, to: body.role }), request);

  return jsonResponse({ success: true, username: target.username, role: body.role });
};

export const onRequestOptions = optionsHandler;
