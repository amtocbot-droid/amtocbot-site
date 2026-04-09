// functions/api/content-stats.ts — public stats endpoint, reads from D1
import { corsHeaders, jsonResponse, optionsHandler } from './_shared/auth';

interface Env {
  ENGAGE_DB: D1Database;
}

export const onRequestOptions = optionsHandler;

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;
  const db = env.ENGAGE_DB;

  try {
    const { results } = await db.prepare(`
      SELECT type, COUNT(*) as count FROM content GROUP BY type
    `).all<{ type: string; count: number }>();

    const counts: Record<string, number> = { blogs: 0, videos: 0, shorts: 0, podcasts: 0 };
    for (const row of results || []) {
      if (row.type === 'blog') counts.blogs = row.count;
      else if (row.type === 'video') counts.videos = row.count;
      else if (row.type === 'short') counts.shorts = row.count;
      else if (row.type === 'podcast') counts.podcasts = row.count;
    }

    // Scalar counts from site_config
    const { results: configRows } = await db.prepare(
      "SELECT key, value FROM site_config WHERE key IN ('tiktok_count', 'platform_count')"
    ).all<{ key: string; value: string }>();

    let tiktok = 0, platforms = 8;
    for (const row of configRows || []) {
      if (row.key === 'tiktok_count') tiktok = parseInt(row.value, 10) || 0;
      if (row.key === 'platform_count') platforms = parseInt(row.value, 10) || 8;
    }

    return jsonResponse({
      lastSync: new Date().toISOString(),
      ...counts,
      tiktok,
      platforms,
    });
  } catch (e) {
    return jsonResponse({
      lastSync: null,
      blogs: 0, videos: 0, shorts: 0, podcasts: 0, tiktok: 0, platforms: 8,
    });
  }
};
