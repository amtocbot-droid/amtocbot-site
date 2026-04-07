/**
 * Cloudflare Pages Function: Public content stats endpoint.
 * Returns blog/video/shorts/podcast counts from cached sync status in KV.
 *
 * GET /api/content-stats
 *
 * No auth required — serves public data for the homepage stats bar.
 */
import { Env, corsHeaders, jsonResponse, optionsHandler, countContent, ContentJson } from './_shared/auth';

export const onRequestOptions = optionsHandler;

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;

  const countFromJson = async (): Promise<Response> => {
    try {
      const jsonUrl = new URL('/assets/data/content.json', context.request.url);
      const resp = await fetch(jsonUrl.toString());
      if (!resp.ok) throw new Error('Failed to fetch content.json');
      const data = await resp.json() as ContentJson;
      const stats = countContent(data);
      return jsonResponse({ ...stats, lastSync: null });
    } catch {
      return jsonResponse({ blogs: 0, videos: 0, shorts: 0, podcasts: 0, tiktok: 0, platforms: 0, lastSync: null });
    }
  };

  if (!env.METRICS_KV) {
    return countFromJson();
  }

  try {
    const syncRaw = await env.METRICS_KV.get('sync-status');
    if (!syncRaw) return countFromJson();

    // KV already contains merged stats (D1 overrides applied at sync/update time)
    return new Response(syncRaw, {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch {
    return jsonResponse({
      error: 'Failed to read from KV',
      blogs: 0, videos: 0, shorts: 0, podcasts: 0, tiktok: 0, platforms: 0, lastSync: null,
    }, 500);
  }
};
