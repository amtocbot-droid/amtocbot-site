/**
 * GET /api/dashboard/qa/history/trend
 *
 * Returns pass-rate trend across the last 30 finished runs.
 * Results are returned in ascending (oldest-first) order for chart rendering.
 * Requires: qa.view permission.
 *
 * Response:
 * {
 *   points: [{
 *     run_id: number,
 *     started_at: string,
 *     pass_rate: number,   // 0–1
 *     total_checks: number,
 *     total_fail: number,
 *   }]
 * }
 */
import {
  Env, jsonResponse, optionsHandler, getSessionUser, requirePermission,
} from '../../_shared/auth';

export const onRequestOptions = optionsHandler;

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getSessionUser(request, env.ENGAGE_DB);
  const deny = requirePermission(user, 'qa.view');
  if (deny) return deny;

  const { results } = await env.ENGAGE_DB
    .prepare(`
      SELECT r.id as run_id, r.started_at, r.total_checks, r.total_pass, r.total_fail, r.total_na
      FROM qa_runs r
      WHERE r.finished_at IS NOT NULL
      ORDER BY r.started_at DESC
      LIMIT 30
    `)
    .all<{
      run_id: number;
      started_at: string;
      total_checks: number;
      total_pass: number;
      total_fail: number;
      total_na: number;
    }>();

  // Return oldest first for chart rendering
  const points = results.reverse().map(r => ({
    run_id: r.run_id,
    started_at: r.started_at,
    pass_rate: r.total_checks > 0 ? r.total_pass / r.total_checks : 0,
    total_checks: r.total_checks,
    total_fail: r.total_fail,
  }));

  return jsonResponse({ points }, 200);
};
