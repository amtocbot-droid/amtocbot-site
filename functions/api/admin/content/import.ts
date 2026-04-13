// functions/api/admin/content/import.ts
import { jsonResponse, getSessionUser, logAudit, optionsHandler } from '../../_shared/auth';

interface Env {
  ENGAGE_DB: D1Database;
  SYNC_SECRET?: string;
}

export const onRequestOptions = optionsHandler;

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const db = env.ENGAGE_DB;

  // Auth: session (admin) or bearer token
  const user = await getSessionUser(request, db);
  const auth = request.headers.get('Authorization');
  if ((!user || (user.role !== 'admin' && user.role !== 'superadmin')) && auth !== `Bearer ${env.SYNC_SECRET}`) {
    return jsonResponse({ error: 'Admin access required' }, 403);
  }

  const body = await request.json<Record<string, unknown>>();
  const blogs = (body.blogs || []) as Array<Record<string, unknown>>;
  const videos = (body.videos || []) as Array<Record<string, unknown>>;
  const milestones = (body.milestones || []) as Array<Record<string, unknown>>;
  const platforms = (body.platforms || []) as Array<Record<string, unknown>>;
  const weeklySummary = (body.weeklySummary || []) as Array<Record<string, unknown>>;
  const monthlySummary = (body.monthlySummary || []) as Array<Record<string, unknown>>;

  let imported = 0;

  // Import blogs
  const blogStmt = db.prepare(`
    INSERT OR REPLACE INTO content (id, type, title, date, level, status, topic, blog_url, linkedin_url, twitter_url, updated_at)
    VALUES (?, 'blog', ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);
  for (const b of blogs) {
    await blogStmt.bind(
      b.id, b.title, b.date, b.level || null, b.status || 'Published',
      b.topic || null, b.blogUrl || null, b.linkedinUrl || null, b.twitterUrl || null,
    ).run();
    imported++;
  }

  // Import videos/shorts/podcasts
  const videoStmt = db.prepare(`
    INSERT OR REPLACE INTO content (id, type, title, date, level, status, tags, youtube_url, youtube_id, spotify_url, duration, description, views, likes, comments, last_scraped, updated_at)
    VALUES (?, ?, ?, ?, ?, 'Published', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);
  for (const v of videos) {
    let ytId = (v.youtubeId as string) || '';
    if (!ytId) {
      const url = (v.youtubeUrl as string) || '';
      if (url.includes('youtu.be/')) ytId = url.split('youtu.be/')[1]?.split('?')[0] || '';
      else if (url.includes('/shorts/')) ytId = url.split('/shorts/')[1]?.split('?')[0] || '';
    }
    await videoStmt.bind(
      v.id, v.type || 'video', v.title, v.date, v.level || null,
      v.tags ? JSON.stringify(v.tags) : (v.topics ? JSON.stringify(v.topics) : null),
      v.youtubeUrl || null, ytId || null, v.spotifyUrl || null,
      v.duration || null, v.description || null,
      v.views || 0, v.likes || 0, v.comments || 0, v.lastScraped || null,
    ).run();
    imported++;
  }

  // Import milestones
  for (const m of milestones) {
    await db.prepare('INSERT OR REPLACE INTO milestones (name, target, current, status) VALUES (?, ?, ?, ?)')
      .bind(m.name, m.target, m.current || 0, m.status || 'in-progress').run();
  }

  // Import platforms
  for (const p of platforms) {
    await db.prepare('INSERT OR REPLACE INTO platforms (platform, handle, url, icon) VALUES (?, ?, ?, ?)')
      .bind(p.platform, p.handle, p.url || null, p.icon || null).run();
  }

  // Import weekly summaries
  for (const s of weeklySummary) {
    await db.prepare('INSERT OR IGNORE INTO summaries (period, label, blogs, videos, shorts, podcasts, social_posts) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind('week', s.week, s.blogs || 0, s.videos || 0, s.shorts || 0, s.podcasts || 0, s.socialPosts || 0).run();
  }

  // Import monthly summaries
  for (const s of monthlySummary) {
    await db.prepare('INSERT OR IGNORE INTO summaries (period, label, blogs, videos, podcasts) VALUES (?, ?, ?, ?, ?)')
      .bind('month', s.month, s.blogs || 0, s.videos || 0, s.podcasts || 0).run();
  }

  // Update scalar counts
  const tiktokCount = body.tiktokCount as number ?? 0;
  const platformCount = body.platformCount as number ?? 8;
  await db.prepare("INSERT OR REPLACE INTO site_config (key, value, updated_at) VALUES ('tiktok_count', ?, datetime('now'))").bind(String(tiktokCount)).run();
  await db.prepare("INSERT OR REPLACE INTO site_config (key, value, updated_at) VALUES ('platform_count', ?, datetime('now'))").bind(String(platformCount)).run();

  if (user) {
    await logAudit(db, user, 'content.import', `Imported ${imported} content items`, request);
  }

  return jsonResponse({ ok: true, imported });
};
