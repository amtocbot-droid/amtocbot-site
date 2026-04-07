/**
 * Admin CMS API - Full content management for authenticated admins.
 *
 * GET  /api/admin/cms              - Get all stats + config
 * POST /api/admin/cms              - Update stats/config
 * POST /api/admin/cms?action=sync  - Trigger GitHub sync + KV update
 *
 * All endpoints require admin session via engage_session cookie.
 */
import { Env, corsHeaders, jsonResponse, getSessionUser, getClientIP, logAudit } from '../_shared/auth';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const db = env.ENGAGE_DB;

  const user = await getSessionUser(request, db);
  if (!user || user.role !== 'admin') {
    return jsonResponse({ error: 'Admin access required' }, 403);
  }

  // Read current stats from KV
  let kvStats: Record<string, unknown> = {};
  if (env.METRICS_KV) {
    const raw = await env.METRICS_KV.get('sync-status');
    if (raw) kvStats = JSON.parse(raw);
  }

  // Read config overrides from D1
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
  const ip = getClientIP(request);

  // Action: sync - trigger GitHub sync
  if (action === 'sync') {
    const githubUrl = `https://raw.githubusercontent.com/amtocbot-droid/amtocbot-site/main/public/assets/data/content.json?t=${Date.now()}`;
    const resp = await fetch(githubUrl, { headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' } });
    if (!resp.ok) {
      return jsonResponse({ error: 'GitHub sync failed' }, 502);
    }
    const content = await resp.json() as any;
    const allVideos = content.videos || [];

    const syncData = {
      lastSync: new Date().toISOString(),
      blogs: (content.blogs || []).length,
      videos: allVideos.filter((v: any) => v.type === 'video').length,
      shorts: allVideos.filter((v: any) => v.type === 'short').length,
      podcasts: allVideos.filter((v: any) => v.type === 'podcast').length,
      tiktok: content.tiktokCount ?? 0,
      platforms: content.platformCount ?? 8,
    };

    // Apply any D1 config overrides
    const { results: overrides } = await db.prepare(
      "SELECT key, value FROM site_config WHERE key IN ('blogs','videos','shorts','podcasts','tiktok','platforms')"
    ).all();
    for (const row of (overrides || []) as any[]) {
      (syncData as any)[row.key] = parseInt(row.value, 10) || (syncData as any)[row.key];
    }

    if (env.METRICS_KV) {
      await env.METRICS_KV.put('sync-status', JSON.stringify(syncData));
    }

    await logAudit(db, user.user_id, user.username, 'cms_sync', JSON.stringify(syncData), ip);
    return jsonResponse({ success: true, stats: syncData });
  }

  // Action: update stats/config
  const body = await request.json() as { updates?: Record<string, string | number> };
  if (!body.updates || typeof body.updates !== 'object') {
    return jsonResponse({ error: 'Updates object required' }, 400);
  }

  const updates = body.updates;
  const updatedKeys: string[] = [];

  for (const [key, value] of Object.entries(updates)) {
    const strValue = String(value);
    await db.prepare(
      `INSERT INTO site_config (key, value, updated_by, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = ?, updated_by = ?, updated_at = datetime('now')`
    ).bind(key, strValue, user.username, strValue, user.username).run();
    updatedKeys.push(key);
  }

  // Also update KV cache immediately
  if (env.METRICS_KV) {
    const raw = await env.METRICS_KV.get('sync-status');
    const current = raw ? JSON.parse(raw) : {};
    for (const [key, value] of Object.entries(updates)) {
      current[key] = typeof value === 'number' ? value : parseInt(String(value), 10) || value;
    }
    current.lastSync = new Date().toISOString();
    await env.METRICS_KV.put('sync-status', JSON.stringify(current));
  }

  await logAudit(db, user.user_id, user.username, 'cms_update', JSON.stringify({ keys: updatedKeys, values: updates }), ip);

  return jsonResponse({ success: true, updated: updatedKeys });
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { headers: corsHeaders });
};
