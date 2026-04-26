/**
 * GET /api/dashboard/qa/runs
 *
 * Paginated list of QA runs, newest first.
 * Requires: qa.view permission.
 *
 * Query params:
 *   limit  - int 1-100, default 20
 *   offset - int ≥0, default 0
 *   source - filter by source (cron|manual|dispatch)
 *
 * Response: { runs: QaRunRow[], total: number, limit, offset }
 */
import {
  Env, jsonResponse, optionsHandler, getSessionUser, requirePermission,
  QaRunRow, QA_RUN_SOURCES,
} from '../_shared';

export const onRequestOptions = optionsHandler;

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getSessionUser(request, env.ENGAGE_DB);
  const deny = requirePermission(user, 'qa.view');
  if (deny) return deny;

  const url = new URL(request.url);
  const limitRaw = parseInt(url.searchParams.get('limit') || '20', 10);
  const offsetRaw = parseInt(url.searchParams.get('offset') || '0', 10);
  const sourceFilter = url.searchParams.get('source') || null;

  const limit = Math.min(Math.max(1, isNaN(limitRaw) ? 20 : limitRaw), 100);
  const offset = Math.max(0, isNaN(offsetRaw) ? 0 : offsetRaw);

  if (sourceFilter && !QA_RUN_SOURCES.includes(sourceFilter as typeof QA_RUN_SOURCES[number])) {
    return jsonResponse({ error: `invalid source filter: ${sourceFilter}` }, 400);
  }

  const db = env.ENGAGE_DB;
  let whereClause = '';
  const binds: unknown[] = [];

  if (sourceFilter) {
    whereClause = 'WHERE source = ?';
    binds.push(sourceFilter);
  }

  // Count total for pagination metadata
  const countRow = await db
    .prepare(`SELECT COUNT(*) as n FROM qa_runs ${whereClause}`)
    .bind(...binds)
    .first<{ n: number }>();
  const total = countRow?.n ?? 0;

  // Fetch page
  const { results: runs } = await db
    .prepare(`
      SELECT id, client_run_id, source, started_at, finished_at,
             total_checks, total_pass, total_fail, total_na, notes
      FROM qa_runs ${whereClause}
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `)
    .bind(...binds, limit, offset)
    .all<QaRunRow>();

  return jsonResponse({ runs, total, limit, offset }, 200);
};
