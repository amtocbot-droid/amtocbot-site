// functions/api/admin/content/metrics.ts
import { jsonResponse, optionsHandler } from '../../_shared/auth';

interface Env {
  ENGAGE_DB: D1Database;
  SYNC_SECRET?: string;
}

interface MetricsPayload {
  youtube?: Record<string, { views: number; likes: number; comments: number }>;
  blogger?: { total_views: number };
}

export const onRequestOptions = optionsHandler;

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const db = env.ENGAGE_DB;

  // Bearer token auth (cron scraper)
  const auth = request.headers.get('Authorization');
  const hasCfAccess = request.headers.get('CF-Access-JWT-Assertion');
  if (!hasCfAccess && auth !== `Bearer ${env.SYNC_SECRET}`) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const body = await request.json<MetricsPayload>();
  const today = new Date().toISOString().split('T')[0];
  let updated = 0;

  // YouTube metrics
  if (body.youtube) {
    for (const [contentId, stats] of Object.entries(body.youtube)) {
      // Update current metrics on content row
      await db.prepare(
        `UPDATE content SET views = ?, likes = ?, comments = ?, last_scraped = ?, updated_at = datetime('now') WHERE id = ?`
      ).bind(stats.views, stats.likes, stats.comments, today, contentId).run();

      // Insert daily snapshot (upsert via UNIQUE constraint)
      await db.prepare(
        `INSERT OR REPLACE INTO metrics_history (content_id, scraped_date, views, likes, comments) VALUES (?, ?, ?, ?, ?)`
      ).bind(contentId, today, stats.views, stats.likes, stats.comments).run();

      updated++;
    }
  }

  // Blogger total views
  if (body.blogger?.total_views !== undefined) {
    await db.prepare(
      "INSERT OR REPLACE INTO site_config (key, value, updated_at) VALUES ('blog_total_views', ?, datetime('now'))"
    ).bind(String(body.blogger.total_views)).run();
  }

  return jsonResponse({ ok: true, updated, date: today });
};
