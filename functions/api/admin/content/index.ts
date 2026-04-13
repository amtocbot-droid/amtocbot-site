// functions/api/admin/content/index.ts
import { jsonResponse, getSessionUser, logAudit, optionsHandler } from '../../_shared/auth';
import type { SessionUser } from '../../_shared/auth';

interface Env {
  ENGAGE_DB: D1Database;
}

export const onRequestOptions = optionsHandler;

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const db = env.ENGAGE_DB;

  const user = await getSessionUser(request, db);
  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    return jsonResponse({ error: 'Admin access required' }, 403);
  }

  const body = await request.json<Record<string, unknown>>();
  const id = body.id as string;
  if (!id || !body.type || !body.title || !body.date) {
    return jsonResponse({ error: 'Missing required fields: id, type, title, date' }, 400);
  }

  await db.prepare(`
    INSERT OR REPLACE INTO content (id, type, title, date, level, status, topic, tags, blog_url, youtube_url, youtube_id, linkedin_url, twitter_url, spotify_url, duration, description, views, likes, comments, last_scraped, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(
    id,
    body.type as string,
    body.title as string,
    body.date as string,
    (body.level as string) || null,
    (body.status as string) || 'Published',
    (body.topic as string) || null,
    body.tags ? JSON.stringify(body.tags) : null,
    (body.blog_url as string) || null,
    (body.youtube_url as string) || null,
    (body.youtube_id as string) || null,
    (body.linkedin_url as string) || null,
    (body.twitter_url as string) || null,
    (body.spotify_url as string) || null,
    (body.duration as string) || null,
    (body.description as string) || null,
    (body.views as number) || 0,
    (body.likes as number) || 0,
    (body.comments as number) || 0,
    (body.last_scraped as string) || null,
  ).run();

  await logAudit(db, user, 'content.upsert', `Upserted ${id}`, request);

  return jsonResponse({ ok: true, id });
};
