/**
 * Cloudflare Pages Function: Sync content from GitHub repo.
 * Fetches the latest content.json from the GitHub repo and returns stats.
 *
 * POST /api/admin/sync-content
 *
 * Protected by Cloudflare Access at the edge — no auth code needed here.
 */

interface Env {
  GITHUB_TOKEN?: string;
  METRICS_KV?: KVNamespace;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env } = context;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    // Fetch latest content.json from GitHub (public repo, no token needed)
    const githubUrl = 'https://raw.githubusercontent.com/amtocbot-droid/amtocbot-site/main/public/assets/data/content.json';
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (env.GITHUB_TOKEN) {
      headers['Authorization'] = `token ${env.GITHUB_TOKEN}`;
    }

    const resp = await fetch(githubUrl, { headers });
    if (!resp.ok) {
      return new Response(JSON.stringify({ error: 'Failed to fetch from GitHub', status: resp.status }), {
        status: 502, headers: corsHeaders,
      });
    }

    const content = await resp.json() as {
      blogs?: unknown[];
      videos?: unknown[];
    };

    const blogs = content.blogs || [];
    const allVideos = content.videos || [];
    const videos = allVideos.filter((v: any) => v.type === 'video');
    const shorts = allVideos.filter((v: any) => v.type === 'short');
    const podcasts = allVideos.filter((v: any) => v.type === 'podcast');

    const syncData = {
      lastSync: new Date().toISOString(),
      blogs: blogs.length,
      videos: videos.length,
      shorts: shorts.length,
      podcasts: podcasts.length,
      tiktok: (content as any).tiktokCount ?? 0,
      platforms: (content as any).platformCount ?? 8,
    };

    // Persist to KV for the public /api/content-stats endpoint
    if (env.METRICS_KV) {
      try {
        await env.METRICS_KV.put('sync-status', JSON.stringify(syncData));
      } catch {
        // KV write failure is non-fatal — still return the response
      }
    }

    return new Response(JSON.stringify(syncData), { status: 200, headers: corsHeaders });

  } catch (e) {
    return new Response(JSON.stringify({ error: 'Sync failed', details: String(e) }), {
      status: 500, headers: corsHeaders,
    });
  }
};
