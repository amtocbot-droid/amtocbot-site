// POST /api/admin/automation/resume-all — resume all automation jobs
import { jsonResponse, getSessionUser, requirePermission, logAudit, optionsHandler } from '../../_shared/auth';

interface Env {
  ENGAGE_DB: D1Database;
}

export const onRequestOptions = optionsHandler;

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const db = env.ENGAGE_DB;

  const user = await getSessionUser(request, db);
  const denied = requirePermission(user, 'users.manage');
  if (denied) return denied;

  // Fetch all automation pause keys
  const { results: keys } = await db.prepare(
    `SELECT key FROM site_config WHERE key LIKE 'automation.%.paused'`
  ).all<{ key: string }>();

  if (!keys || keys.length === 0) {
    return jsonResponse({ success: true, resumed: 0 });
  }

  // Batch-update all keys to 'false'
  const statements = keys.map(({ key }) =>
    db.prepare(
      `UPDATE site_config SET value = 'false', updated_by = ?, updated_at = datetime('now') WHERE key = ?`
    ).bind(user!.username, key)
  );

  await db.batch(statements);

  await logAudit(db, user!, 'automation.resume_all', `Resumed ${keys.length} automation jobs`, request);

  return jsonResponse({ success: true, resumed: keys.length });
};
