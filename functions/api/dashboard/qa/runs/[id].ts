/**
 * GET /api/dashboard/qa/runs/[id]
 *
 * Fetch a single run's header + per-check summary counts.
 * Requires: qa.view permission.
 *
 * Response:
 * {
 *   run: QaRunRow,
 *   summary: { pass: number, fail: number, na: number, unknown: number },
 *   top_failures: Array<{ content_code, check_type, error_detail }>,
 * }
 */
import {
  Env, jsonResponse, optionsHandler, getSessionUser, requirePermission,
  QaRunRow, QaCheckResultRow,
} from '../_shared';

export const onRequestOptions = optionsHandler;

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  const user = await getSessionUser(request, env.ENGAGE_DB);
  const deny = requirePermission(user, 'qa.view');
  if (deny) return deny;

  const runId = parseInt(params.id as string, 10);
  if (isNaN(runId)) return jsonResponse({ error: 'run id must be an integer' }, 400);

  const db = env.ENGAGE_DB;

  const run = await db
    .prepare(`
      SELECT id, client_run_id, source, started_at, finished_at,
             total_checks, total_pass, total_fail, total_na, notes
      FROM qa_runs WHERE id = ?
    `)
    .bind(runId)
    .first<QaRunRow>();

  if (!run) return jsonResponse({ error: `run ${runId} not found` }, 404);

  // Status breakdown counts (should match run.total_*, here for verification)
  const { results: statusCounts } = await db
    .prepare(`
      SELECT status, COUNT(*) as n
      FROM qa_check_results
      WHERE run_id = ?
      GROUP BY status
    `)
    .bind(runId)
    .all<{ status: string; n: number }>();

  const summary: Record<string, number> = { pass: 0, fail: 0, na: 0, unknown: 0 };
  for (const row of statusCounts) {
    summary[row.status] = row.n;
  }

  // Top failures (up to 20), for quick triage view
  const { results: topFailures } = await db
    .prepare(`
      SELECT content_code, check_type, error_detail
      FROM qa_check_results
      WHERE run_id = ? AND status = 'fail'
      ORDER BY content_code, check_type
      LIMIT 20
    `)
    .bind(runId)
    .all<Pick<QaCheckResultRow, 'content_code' | 'check_type' | 'error_detail'>>();

  return jsonResponse({ run, summary, top_failures: topFailures }, 200);
};
