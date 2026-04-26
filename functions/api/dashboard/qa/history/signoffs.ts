/**
 * GET /api/dashboard/qa/history/signoffs
 *
 * Returns the last 52 weekly sign-offs (approximately 1 year).
 * Results are in descending order (most recent first).
 * Requires: qa.view permission.
 *
 * Response: { signoffs: [...] }
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
      SELECT s.id, s.week_start_date, s.signed_at, s.based_on_run_id,
             s.count_regressions, s.count_persistent, s.count_new_green, s.count_steady_green,
             s.notes, u.username as signed_by_username
      FROM qa_weekly_signoffs s
      JOIN users u ON s.signed_by = u.id
      ORDER BY s.week_start_date DESC
      LIMIT 52
    `)
    .all<{
      id: number;
      week_start_date: string;
      signed_at: string;
      based_on_run_id: number;
      count_regressions: number;
      count_persistent: number;
      count_new_green: number;
      count_steady_green: number;
      notes: string | null;
      signed_by_username: string;
    }>();

  return jsonResponse({ signoffs: results }, 200);
};
