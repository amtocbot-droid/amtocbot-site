/**
 * Cloudflare Pages Function: Sync content from GitHub repo.
 * Fetches the latest content.json and updates KV stats.
 *
 * POST /api/admin/sync-content
 *
 * Auth: Cloudflare Access at the edge OR Bearer token (for GitHub Actions).
 */
import { Env as BaseEnv, jsonResponse, optionsHandler, fetchContentFromGitHub, countContent } from '../_shared/auth';

interface Env extends BaseEnv {
  SYNC_SECRET?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  // Allow Bearer token auth for GitHub Actions webhook
  if (env.SYNC_SECRET) {
    const auth = request.headers.get('Authorization');
    const hasCfAccess = request.headers.get('CF-Access-JWT-Assertion');
    if (!hasCfAccess && auth !== `Bearer ${env.SYNC_SECRET}`) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
  }

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
