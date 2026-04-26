/**
 * GET /api/dashboard/qa/history/heatmap
 *
 * Returns fail frequency per (content_code, check_type) pair over the last 90 days.
 * Useful for identifying persistently failing checks.
 * Requires: qa.view permission.
 *
 * Response: { cells: [{ content_code, check_type, fail_count }], window_days: 90 }
 */
import {
  Env, jsonResponse, optionsHandler, getSessionUser, requirePermission,
} from '../_shared';

export const onRequestOptions = optionsHandler;

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getSessionUser(request, env.ENGAGE_DB);
  const deny = requirePermission(user, 'qa.view');
  if (deny) return deny;

  const { results } = await env.ENGAGE_DB
    .prepare(`
      SELECT content_code, check_type, COUNT(*) as fail_count
      FROM qa_check_results
      WHERE status = 'fail' AND checked_at > datetime('now', '-90 days')
      GROUP BY content_code, check_type
      ORDER BY fail_count DESC
      LIMIT 500
    `)
    .all<{ content_code: string; check_type: string; fail_count: number }>();

  return jsonResponse({ cells: results, window_days: 90 }, 200);
};
