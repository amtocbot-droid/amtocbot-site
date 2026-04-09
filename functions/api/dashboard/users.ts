/**
 * GET /api/dashboard/users — List all users (admin only)
 */
import { Env, jsonResponse, optionsHandler, requireDashboardAuth } from './_shared';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const db = env.ENGAGE_DB;
  const auth = await requireDashboardAuth(request, db, 'users.manage');
  if (auth instanceof Response) return auth;

  const result = await db.prepare(
    'SELECT id, username, email, role, invited_by, created_at FROM users ORDER BY created_at DESC'
  ).all<{ id: number; username: string; email: string; role: string; invited_by: string | null; created_at: string }>();

  return jsonResponse({ users: result.results || [] });
};

export const onRequestOptions = optionsHandler;
