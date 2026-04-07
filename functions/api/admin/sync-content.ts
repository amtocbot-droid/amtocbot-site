/**
 * Cloudflare Pages Function: Sync content from GitHub repo.
 * Fetches the latest content.json and updates KV stats.
 *
 * POST /api/admin/sync-content
 *
 * Protected by Cloudflare Access at the edge.
 */
import { Env, jsonResponse, optionsHandler, fetchContentFromGitHub, countContent } from '../_shared/auth';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env } = context;

  try {
    const content = await fetchContentFromGitHub(env.GITHUB_TOKEN);
    const stats = countContent(content);
    const syncData = { lastSync: new Date().toISOString(), ...stats };

    if (env.METRICS_KV) {
      try {
        await env.METRICS_KV.put('sync-status', JSON.stringify(syncData));
      } catch { /* KV write failure is non-fatal */ }
    }

    return jsonResponse(syncData);
  } catch (e) {
    return jsonResponse({ error: 'Sync failed', details: String(e) }, 500);
  }
};

export const onRequestOptions = optionsHandler;
