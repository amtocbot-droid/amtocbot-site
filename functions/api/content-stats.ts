/**
 * Cloudflare Pages Function: Public content stats endpoint.
 * Returns blog/video/shorts/podcast counts from cached sync status in KV.
 *
 * GET /api/content-stats
 *
 * No auth required — serves public data for the homepage stats bar.
 */

interface Env {
  METRICS_KV?: KVNamespace;
}

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: corsHeaders });
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;

  if (!env.METRICS_KV) {
    return new Response(JSON.stringify({
      error: 'KV not configured',
      blogs: 0,
      videos: 0,
      shorts: 0,
      podcasts: 0,
      lastSync: null,
    }), { status: 200, headers: corsHeaders });
  }

  try {
    const syncRaw = await env.METRICS_KV.get('sync-status');

    if (!syncRaw) {
      return new Response(JSON.stringify({
        blogs: 0,
        videos: 0,
        shorts: 0,
        podcasts: 0,
        lastSync: null,
      }), { status: 200, headers: corsHeaders });
    }

    const syncData = JSON.parse(syncRaw) as {
      lastSync: string;
      blogs: number;
      videos: number;
      shorts: number;
      podcasts: number;
    };

    return new Response(JSON.stringify({
      blogs: syncData.blogs,
      videos: syncData.videos,
      shorts: syncData.shorts,
      podcasts: syncData.podcasts,
      lastSync: syncData.lastSync,
    }), { status: 200, headers: corsHeaders });
  } catch {
    return new Response(JSON.stringify({
      error: 'Failed to read from KV',
      blogs: 0,
      videos: 0,
      shorts: 0,
      podcasts: 0,
      lastSync: null,
    }), { status: 500, headers: corsHeaders });
  }
};
