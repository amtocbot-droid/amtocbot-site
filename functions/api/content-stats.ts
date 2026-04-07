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

  // If KV is not configured or has no sync data, count directly from content.json
  const countFromJson = async (): Promise<Response> => {
    try {
      const jsonUrl = new URL('/assets/data/content.json', context.request.url);
      const resp = await fetch(jsonUrl.toString());
      if (!resp.ok) throw new Error('Failed to fetch content.json');
      const data = await resp.json() as { blogs?: unknown[]; videos?: Array<{ type?: string }> };
      const blogs = data.blogs?.length ?? 0;
      const allVideos = data.videos ?? [];
      const videos = allVideos.filter(v => v.type === 'video').length;
      const shorts = allVideos.filter(v => v.type === 'short').length;
      const podcasts = allVideos.filter(v => v.type === 'podcast').length;
      const tiktok = (data as any).tiktok ?? 0;
      const platforms = (data as any).platforms ?? 0;
      return new Response(JSON.stringify({ blogs, videos, shorts, podcasts, tiktok, platforms, lastSync: null }), {
        status: 200,
        headers: corsHeaders,
      });
    } catch {
      return new Response(JSON.stringify({ blogs: 0, videos: 0, shorts: 0, podcasts: 0, lastSync: null }), {
        status: 200,
        headers: corsHeaders,
      });
    }
  };

  if (!env.METRICS_KV) {
    return countFromJson();
  }

  try {
    const syncRaw = await env.METRICS_KV.get('sync-status');

    if (!syncRaw) {
      return countFromJson();
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
      tiktok: (syncData as any).tiktok ?? 0,
      platforms: (syncData as any).platforms ?? 0,
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
