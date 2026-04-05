/**
 * Cloudflare Pages Function: Public metrics endpoint.
 * Returns cached platform metrics and sync status from KV.
 *
 * GET /api/metrics
 *
 * No auth required — serves public data for the homepage/metrics page.
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
      metrics: null,
      syncStatus: null,
    }), { status: 200, headers: corsHeaders });
  }

  try {
    const [metricsRaw, syncRaw] = await Promise.all([
      env.METRICS_KV.get('platform-metrics'),
      env.METRICS_KV.get('sync-status'),
    ]);

    return new Response(JSON.stringify({
      metrics: metricsRaw ? JSON.parse(metricsRaw) : null,
      syncStatus: syncRaw ? JSON.parse(syncRaw) : null,
    }), { status: 200, headers: corsHeaders });
  } catch {
    return new Response(JSON.stringify({
      error: 'Failed to read from KV',
      metrics: null,
      syncStatus: null,
    }), { status: 500, headers: corsHeaders });
  }
};
