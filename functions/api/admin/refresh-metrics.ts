/**
 * Cloudflare Pages Function: Refresh platform metrics.
 * Pulls stats from YouTube Data API v3 and returns aggregated data.
 *
 * POST /api/admin/refresh-metrics
 *
 * Requires YOUTUBE_API_KEY env var in Cloudflare Pages.
 * Protected by Cloudflare Access at the edge.
 */

interface Env {
  YOUTUBE_API_KEY?: string;
}

interface PlatformMetric {
  platform: string;
  followers: number;
  totalViews: number;
  lastUpdated: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env } = context;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  const metrics: PlatformMetric[] = [];
  const now = new Date().toISOString();

  // YouTube metrics via Data API v3
  if (env.YOUTUBE_API_KEY) {
    try {
      const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics&forHandle=quietsentinelshadow&key=${env.YOUTUBE_API_KEY}`;
      const ytResp = await fetch(channelUrl);
      if (ytResp.ok) {
        const ytData = await ytResp.json() as {
          items?: Array<{
            statistics: {
              subscriberCount?: string;
              viewCount?: string;
              videoCount?: string;
            };
          }>;
        };
        if (ytData.items && ytData.items.length > 0) {
          const stats = ytData.items[0].statistics;
          metrics.push({
            platform: 'YouTube',
            followers: parseInt(stats.subscriberCount || '0'),
            totalViews: parseInt(stats.viewCount || '0'),
            lastUpdated: now,
          });
        }
      }
    } catch {
      metrics.push({
        platform: 'YouTube',
        followers: 0,
        totalViews: 0,
        lastUpdated: 'Error fetching',
      });
    }
  } else {
    metrics.push({
      platform: 'YouTube',
      followers: 0,
      totalViews: 0,
      lastUpdated: 'No API key configured',
    });
  }

  // TikTok — no public API, provide placeholder
  metrics.push({
    platform: 'TikTok',
    followers: 0,
    totalViews: 0,
    lastUpdated: 'Manual check required',
  });

  // Blogger — no simple API, provide placeholder
  metrics.push({
    platform: 'Blogger',
    followers: 0,
    totalViews: 0,
    lastUpdated: 'Manual check required',
  });

  // LinkedIn — no public API for page stats
  metrics.push({
    platform: 'LinkedIn',
    followers: 0,
    totalViews: 0,
    lastUpdated: 'Manual check required',
  });

  // Instagram — no public API for basic accounts
  metrics.push({
    platform: 'Instagram',
    followers: 0,
    totalViews: 0,
    lastUpdated: 'Manual check required',
  });

  return new Response(JSON.stringify({ metrics }), {
    status: 200,
    headers: corsHeaders,
  });
};
