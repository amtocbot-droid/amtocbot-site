// GET  /api/admin/social — list social posts queue
// POST /api/admin/social — update social post status OR sync from published content
import { Env, getSessionUser, requirePermission, jsonResponse, logAudit, optionsHandler } from '../../_shared/auth';

export const onRequestOptions = optionsHandler;

// ── GET ────────────────────────────────────────────────────────
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const db = env.ENGAGE_DB;

  const user = await getSessionUser(request, db);
  const denied = requirePermission(user, 'users.manage');
  if (denied) return denied;

  const { results } = await db.prepare(`
    SELECT sp.*, c.title, c.type
    FROM social_posts sp
    JOIN content c ON sp.content_id = c.id
    ORDER BY sp.updated_at DESC
    LIMIT 100
  `).all();

  return jsonResponse({ posts: results || [] });
};

// ── POST ───────────────────────────────────────────────────────
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const db = env.ENGAGE_DB;

  const user = await getSessionUser(request, db);
  const denied = requirePermission(user, 'users.manage');
  if (denied) return denied;

  const body = await request.json<{
    action: 'update' | 'sync';
    content_id?: string;
    platform?: string;
    status?: 'posted' | 'skipped' | 'pending';
    draft_body?: string;
  }>();

  const { action } = body || {};

  if (!action || !['update', 'sync'].includes(action)) {
    return jsonResponse({ error: 'Missing or invalid action. Must be update or sync' }, 400);
  }

  // ── Mode 1: update ────────────────────────────────────────────
  if (action === 'update') {
    const { content_id, platform, status, draft_body } = body;

    if (!content_id || !platform || !status) {
      return jsonResponse({ error: 'Missing required fields: content_id, platform, status' }, 400);
    }

    if (!['posted', 'skipped', 'pending'].includes(status)) {
      return jsonResponse({ error: 'Invalid status. Must be posted, skipped, or pending' }, 400);
    }

    // Check if row exists
    const existing = await db.prepare(
      `SELECT id FROM social_posts WHERE content_id = ? AND platform = ?`
    ).bind(content_id, platform).first<{ id: number }>();

    if (existing) {
      await db.prepare(`
        UPDATE social_posts
        SET status      = ?,
            posted_at   = CASE WHEN ? = 'posted' THEN datetime('now') ELSE NULL END,
            draft_body  = COALESCE(?, draft_body),
            updated_at  = datetime('now')
        WHERE content_id = ? AND platform = ?
      `).bind(status, status, draft_body ?? null, content_id, platform).run();
    } else {
      await db.prepare(`
        INSERT INTO social_posts (content_id, platform, status, draft_body, posted_at, posted_by)
        VALUES (?, ?, ?, ?, CASE WHEN ? = 'posted' THEN datetime('now') ELSE NULL END, ?)
      `).bind(content_id, platform, status, draft_body ?? null, status, user!.user_id).run();
    }

    await logAudit(db, user!, 'social.update', `${content_id} on ${platform} → ${status}`, request);

    return jsonResponse({ ok: true, action: 'update', content_id, platform, status });
  }

  // ── Mode 2: sync ─────────────────────────────────────────────
  // Ensure linkedin + x rows exist (status=pending) for all published content
  const { results: published } = await db.prepare(`
    SELECT id FROM content
    WHERE qa_status = 'published' OR status = 'Published'
  `).all<{ id: string }>();

  let synced = 0;
  const platforms = ['linkedin', 'x'];

  for (const row of published || []) {
    for (const platform of platforms) {
      const exists = await db.prepare(
        `SELECT id FROM social_posts WHERE content_id = ? AND platform = ?`
      ).bind(row.id, platform).first<{ id: number }>();

      if (!exists) {
        await db.prepare(`
          INSERT INTO social_posts (content_id, platform, status)
          VALUES (?, ?, 'pending')
        `).bind(row.id, platform).run();
        synced++;
      }
    }
  }

  await logAudit(db, user!, 'social.sync', `Synced ${synced} social post rows`, request);

  return jsonResponse({ ok: true, action: 'sync', synced });
};
