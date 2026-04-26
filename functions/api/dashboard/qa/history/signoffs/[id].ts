/**
 * GET /api/dashboard/qa/history/signoffs/[id]
 *
 * Returns a single weekly sign-off by its integer ID, plus a summary
 * of the QA run it was based on.
 * Requires: qa.view permission.
 *
 * Response:
 * {
 *   signoff: { id, week_start_date, signed_at, based_on_run_id,
 *              count_regressions, count_persistent, count_new_green,
 *              count_steady_green, notes, signed_by_username },
 *   run_summary: { total_checks, total_pass, total_fail, total_na }
 * }
 */
import {
  Env, jsonResponse, optionsHandler, getSessionUser, requirePermission,
} from '../../_shared';

export const onRequestOptions = optionsHandler;

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  const user = await getSessionUser(request, env.ENGAGE_DB);
  const deny = requirePermission(user, 'qa.view');
  if (deny) return deny;

  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) {
    return jsonResponse({ error: 'id must be an integer' }, 400);
  }

  const db = env.ENGAGE_DB;

  // Fetch the sign-off header
  const signoff = await db
    .prepare(`
      SELECT s.id, s.week_start_date, s.signed_at, s.based_on_run_id,
             s.count_regressions, s.count_persistent, s.count_new_green, s.count_steady_green,
             s.notes, u.username as signed_by_username
      FROM qa_weekly_signoffs s
      JOIN users u ON s.signed_by = u.id
      WHERE s.id = ?
    `)
    .bind(id)
    .first<{
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

  if (!signoff) {
    return jsonResponse({ error: `signoff ${id} not found` }, 404);
  }

  // Fetch run summary from the based_on_run
  const runSummary = await db
    .prepare(`SELECT total_checks, total_pass, total_fail, total_na FROM qa_runs WHERE id = ?`)
    .bind(signoff.based_on_run_id)
    .first<{ total_checks: number; total_pass: number; total_fail: number; total_na: number }>();

  return jsonResponse({
    signoff,
    run_summary: runSummary ?? { total_checks: 0, total_pass: 0, total_fail: 0, total_na: 0 },
  }, 200);
};
