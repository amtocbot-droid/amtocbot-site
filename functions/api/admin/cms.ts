/**
 * Admin CMS API - Full content management for authenticated admins.
 *
 * GET  /api/admin/cms              - Get all stats + config
 * POST /api/admin/cms              - Update stats/config
 * POST /api/admin/cms?action=sync  - Recount content from D1
 *
 * All endpoints require admin session via engage_session cookie.
 */
import {
  Env, jsonResponse, getSessionUser, requirePermission, logAudit, optionsHandler,
  applyConfigOverrides,
} from '../_shared/auth';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const db = env.ENGAGE_DB;

  const user = await getSessionUser(request, db);
  const denied = requirePermission(user, 'users.manage');
  if (denied) return denied;

  // Count content from D1
  const { results: counts } = await db.prepare(
    `SELECT type, COUNT(*) as cnt FROM content GROUP BY type`
  ).all<{ type: string; cnt: number }>();
  const statsMap: Record<string, number> = {};
  for (const row of counts || []) statsMap[row.type] = row.cnt;

  const stats: Record<string, unknown> = {
    blogs: statsMap['blog'] ?? 0,
    videos: statsMap['video'] ?? 0,
    shorts: statsMap['short'] ?? 0,
    podcasts: statsMap['podcast'] ?? 0,
    tiktok: 0,
    platforms: 8,
  };
  await applyConfigOverrides(db, stats);

  const { results: configs } = await db.prepare('SELECT key, value, updated_by, updated_at FROM site_config').all();

  return jsonResponse({
    stats,
    config: configs,
    user: { username: user.username, role: user.role },
  });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const db = env.ENGAGE_DB;

  const user = await getSessionUser(request, db);
  const denied = requirePermission(user, 'users.manage');
  if (denied) return denied;

  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  if (action === 'sync') {
    // Count content from D1 directly
    const { results: counts } = await db.prepare(
      `SELECT type, COUNT(*) as cnt FROM content GROUP BY type`
    ).all<{ type: string; cnt: number }>();
    const statsMap: Record<string, number> = {};
    for (const row of counts || []) statsMap[row.type] = row.cnt;

    const syncData: Record<string, unknown> = {
      lastSync: new Date().toISOString(),
      blogs: statsMap['blog'] ?? 0,
      videos: statsMap['video'] ?? 0,
      shorts: statsMap['short'] ?? 0,
      podcasts: statsMap['podcast'] ?? 0,
      tiktok: 0,
      platforms: 8,
    };

    await applyConfigOverrides(db, syncData);

    await logAudit(db, user, 'cms_sync', JSON.stringify(syncData), request);
    return jsonResponse({ success: true, stats: syncData });
  }

  const body = await request.json() as { updates?: Record<string, string | number> };
  if (!body.updates || typeof body.updates !== 'object') {
    return jsonResponse({ error: 'Updates object required' }, 400);
  }

  const updates = body.updates;
  const stmts = Object.entries(updates).map(([key, value]) =>
    db.prepare(
      `INSERT INTO site_config (key, value, updated_by, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = ?, updated_by = ?, updated_at = datetime('now')`
    ).bind(key, String(value), user.username, String(value), user.username)
  );
  if (stmts.length > 0) await db.batch(stmts);

  await logAudit(db, user, 'cms_update', JSON.stringify({ keys: Object.keys(updates), values: updates }), request);

  return jsonResponse({ success: true, updated: Object.keys(updates) });
};

export const onRequestOptions = optionsHandler;
