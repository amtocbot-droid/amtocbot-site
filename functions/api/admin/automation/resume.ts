// POST /api/admin/automation/resume — clear paused flag
import { jsonResponse, getSessionUser, logAudit, optionsHandler } from '../../_shared/auth';

interface Env {
  ENGAGE_DB: D1Database;
}

export const onRequestOptions = optionsHandler;

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const db = env.ENGAGE_DB;

  const user = await getSessionUser(request, db);
  if (!user || user.role !== 'admin') {
    return jsonResponse({ error: 'Admin access required' }, 403);
  }

  const body = await request.json<{ job: string }>();
  const job = body?.job;
  if (!job) {
    return jsonResponse({ error: 'Missing "job" field' }, 400);
  }

  const key = `automation.${job}.paused`;

  const existing = await db.prepare(
    `SELECT value FROM site_config WHERE key = ?`
  ).bind(key).first<{ value: string }>();

  if (!existing) {
    return jsonResponse({ error: `Unknown job: ${job}` }, 404);
  }

  await db.prepare(
    `UPDATE site_config SET value = 'false', updated_by = ?, updated_at = datetime('now') WHERE key = ?`
  ).bind(user.username, key).run();

  await logAudit(db, user, 'automation.resume', `Resumed ${job}`, request);

  return jsonResponse({ ok: true, message: `${job} resumed` });
};
