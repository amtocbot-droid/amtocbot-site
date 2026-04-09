/**
 * Admin CMS API - Full content management for authenticated admins.
 *
 * GET  /api/admin/cms              - Get all stats + config
 * POST /api/admin/cms              - Update stats/config
 * POST /api/admin/cms?action=sync  - Trigger GitHub sync + KV update
 *
 * All endpoints require admin session via engage_session cookie.
 */
import {
  Env, jsonResponse, getSessionUser, logAudit, optionsHandler,
  applyConfigOverrides,
} from '../_shared/auth';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const db = env.ENGAGE_DB;

  const user = await getSessionUser(request, db);
  if (!user || user.role !== 'admin') {
    return jsonResponse({ error: 'Admin access required' }, 403);
  }

  let kvStats: Record<string, unknown> = {};
  if (env.METRICS_KV) {
    const raw = await env.METRICS_KV.get('sync-status');
    if (raw) kvStats = JSON.parse(raw);
  }

  const { results: configs } = await db.prepare('SELECT key, value, updated_by, updated_at FROM site_config').all();

  return jsonResponse({
    stats: kvStats,
    config: configs,
    user: { username: user.username, role: user.role },
  });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const db = env.ENGAGE_DB;

  const user = await getSessionUser(request, db);
  if (!user || user.role !== 'admin') {
    return jsonResponse({ error: 'Admin access required' }, 403);
  }

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

    if (env.METRICS_KV) {
      await env.METRICS_KV.put('sync-status', JSON.stringify(syncData));
    }

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

  // Update KV cache with merged values
  if (env.METRICS_KV) {
    const raw = await env.METRICS_KV.get('sync-status');
    const current = raw ? JSON.parse(raw) : {};
    for (const [key, value] of Object.entries(updates)) {
      current[key] = typeof value === 'number' ? value : parseInt(String(value), 10) || value;
    }
    current.lastSync = new Date().toISOString();
    await env.METRICS_KV.put('sync-status', JSON.stringify(current));
  }

  await logAudit(db, user, 'cms_update', JSON.stringify({ keys: Object.keys(updates), values: updates }), request);

  return jsonResponse({ success: true, updated: Object.keys(updates) });
};

export const onRequestOptions = optionsHandler;
