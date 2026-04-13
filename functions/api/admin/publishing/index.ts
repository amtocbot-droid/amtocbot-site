// GET  /api/admin/publishing — list content with cross-post status
// POST /api/admin/publishing — mark a platform as posted or unposted
import { Env, getSessionUser, requirePermission, jsonResponse, logAudit, optionsHandler } from '../../_shared/auth';

export const onRequestOptions = optionsHandler;

// ── GET ────────────────────────────────────────────────────────
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const db = env.ENGAGE_DB;

  const user = await getSessionUser(request, db);
  const denied = requirePermission(user, 'users.manage');
  if (denied) return denied;

  // Join content with cross-post rows for the three publishing platforms
  const { results } = await db.prepare(`
    SELECT
      c.id,
      c.title,
      c.type,
      c.qa_status,
      MAX(CASE WHEN ccp.platform = 'blogger'  THEN 1 ELSE 0 END) AS blogger_posted,
      MAX(CASE WHEN ccp.platform = 'blogger'  THEN ccp.posted_at END) AS blogger_posted_at,
      MAX(CASE WHEN ccp.platform = 'linkedin' THEN 1 ELSE 0 END) AS linkedin_posted,
      MAX(CASE WHEN ccp.platform = 'linkedin' THEN ccp.posted_at END) AS linkedin_posted_at,
      MAX(CASE WHEN ccp.platform = 'x'        THEN 1 ELSE 0 END) AS x_posted,
      MAX(CASE WHEN ccp.platform = 'x'        THEN ccp.posted_at END) AS x_posted_at
    FROM content c
    LEFT JOIN content_cross_posts ccp ON ccp.content_id = c.id
    WHERE c.qa_status IN ('approved', 'published', 'draft')
    GROUP BY c.id, c.title, c.type, c.qa_status
    ORDER BY c.date DESC
  `).all<{
    id: string; title: string; type: string; qa_status: string;
    blogger_posted: number; blogger_posted_at: string | null;
    linkedin_posted: number; linkedin_posted_at: string | null;
    x_posted: number; x_posted_at: string | null;
  }>();

  const items = (results || []).map(r => ({
    id: r.id,
    title: r.title,
    type: r.type,
    qa_status: r.qa_status,
    blogger_posted: r.blogger_posted === 1,
    blogger_posted_at: r.blogger_posted_at || null,
    linkedin_posted: r.linkedin_posted === 1,
    linkedin_posted_at: r.linkedin_posted_at || null,
    x_posted: r.x_posted === 1,
    x_posted_at: r.x_posted_at || null,
  }));

  return jsonResponse({ items });
};

// ── POST ───────────────────────────────────────────────────────
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const db = env.ENGAGE_DB;

  const user = await getSessionUser(request, db);
  const denied = requirePermission(user, 'users.manage');
  if (denied) return denied;

  const body = await request.json<{
    content_id: string;
    platform: 'blogger' | 'linkedin' | 'x';
    action: 'mark_posted' | 'mark_unposted';
    notes?: string;
  }>();

  const { content_id, platform, action, notes } = body || {};

  if (!content_id || !platform || !action) {
    return jsonResponse({ error: 'Missing required fields: content_id, platform, action' }, 400);
  }

  if (!['blogger', 'linkedin', 'x'].includes(platform)) {
    return jsonResponse({ error: 'Invalid platform. Must be blogger, linkedin, or x' }, 400);
  }

  if (!['mark_posted', 'mark_unposted'].includes(action)) {
    return jsonResponse({ error: 'Invalid action. Must be mark_posted or mark_unposted' }, 400);
  }

  if (action === 'mark_posted') {
    await db.prepare(`
      INSERT OR REPLACE INTO content_cross_posts (content_id, platform, posted_at, posted_by, notes)
      VALUES (?, ?, datetime('now'), ?, ?)
    `).bind(content_id, platform, user!.user_id, notes || null).run();
  } else {
    await db.prepare(`
      DELETE FROM content_cross_posts WHERE content_id = ? AND platform = ?
    `).bind(content_id, platform).run();
  }

  await logAudit(db, user!, 'content.cross_post', `${action} for ${content_id} on ${platform}`, request);

  return jsonResponse({ ok: true, action, content_id, platform });
};
