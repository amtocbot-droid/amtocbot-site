/**
 * GET /api/dashboard/qa/matrix
 *
 * Returns the full QA traceability matrix for a given run (defaults to latest).
 * Requires: qa.view permission.
 *
 * Query params:
 *   run_id  - integer; default = latest run
 *   kind    - filter by content_kind (tale|podcast|video|blog|tutorial|linkedin_article)
 *
 * Response shape:
 * {
 *   run_id: number,
 *   run: { source, started_at, finished_at, total_checks, total_pass, total_fail, total_na },
 *   rows: Array<{
 *     content_code: string,
 *     content_kind: string,
 *     content_title: string | null,
 *     checks: Record<CheckType, { status, error_detail, ack: AckInfo | null }>,
 *   }>,
 *   check_types: string[],   // ordered list of all check columns
 *   total_rows: number,
 * }
 */
import {
  Env, jsonResponse, optionsHandler, getSessionUser, requirePermission,
  QA_CHECK_TYPES, QaCheckType, QaRunRow,
} from './_shared';

export const onRequestOptions = optionsHandler;

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getSessionUser(request, env.ENGAGE_DB);
  const deny = requirePermission(user, 'qa.view');
  if (deny) return deny;

  const url = new URL(request.url);
  const kindFilter = url.searchParams.get('kind') || null;

  const db = env.ENGAGE_DB;

  // Resolve which run to use
  let runId: number;
  const runIdParam = url.searchParams.get('run_id');
  if (runIdParam) {
    runId = parseInt(runIdParam, 10);
    if (isNaN(runId)) return jsonResponse({ error: 'run_id must be an integer' }, 400);
  } else {
    const latest = await db
      .prepare('SELECT id FROM qa_runs ORDER BY id DESC LIMIT 1')
      .first<{ id: number }>();
    if (!latest) {
      return jsonResponse({ run_id: null, run: null, rows: [], check_types: QA_CHECK_TYPES, total_rows: 0 }, 200);
    }
    runId = latest.id;
  }

  // Fetch the run header
  const run = await db
    .prepare('SELECT id, source, started_at, finished_at, total_checks, total_pass, total_fail, total_na, notes FROM qa_runs WHERE id = ?')
    .bind(runId)
    .first<QaRunRow>();
  if (!run) return jsonResponse({ error: `run ${runId} not found` }, 404);

  // Fetch all check results for this run (with optional kind filter)
  let resultsQuery = `
    SELECT content_code, content_kind, content_title, check_type, status, error_detail, checked_at
    FROM qa_check_results
    WHERE run_id = ?`;
  const binds: unknown[] = [runId];
  if (kindFilter) {
    resultsQuery += ' AND content_kind = ?';
    binds.push(kindFilter);
  }
  resultsQuery += ' ORDER BY content_code, check_type';

  const { results: rawResults } = await db
    .prepare(resultsQuery)
    .bind(...binds)
    .all<{
      content_code: string;
      content_kind: string;
      content_title: string | null;
      check_type: QaCheckType;
      status: string;
      error_detail: string | null;
      checked_at: string;
    }>();

  // Fetch active acknowledgements (not cleared, not expired)
  const { results: rawAcks } = await db
    .prepare(`
      SELECT content_code, check_type, acknowledged_by, reason, expires_at, acknowledged_at
      FROM qa_acknowledgements
      WHERE cleared_at IS NULL
        AND expires_at > datetime('now')
      ORDER BY content_code, check_type
    `)
    .all<{
      content_code: string;
      check_type: string;
      acknowledged_by: number;
      reason: string;
      expires_at: string;
      acknowledged_at: string;
    }>();

  // Build ack lookup: "content_code:check_type" → ack object
  const ackMap = new Map<string, { acknowledged_by: number; reason: string; expires_at: string; acknowledged_at: string }>();
  for (const ack of rawAcks) {
    ackMap.set(`${ack.content_code}:${ack.check_type}`, ack);
  }

  // Pivot results into per-content-row structure
  type CheckCell = { status: string; error_detail: string | null; ack: { acknowledged_by: number; reason: string; expires_at: string; acknowledged_at: string } | null };
  type ContentRow = {
    content_code: string;
    content_kind: string;
    content_title: string | null;
    checks: Partial<Record<QaCheckType, CheckCell>>;
  };

  const rowMap = new Map<string, ContentRow>();

  for (const r of rawResults) {
    if (!rowMap.has(r.content_code)) {
      rowMap.set(r.content_code, {
        content_code: r.content_code,
        content_kind: r.content_kind,
        content_title: r.content_title,
        checks: {},
      });
    }
    const row = rowMap.get(r.content_code)!;
    const ackKey = `${r.content_code}:${r.check_type}`;
    row.checks[r.check_type] = {
      status: r.status,
      error_detail: r.error_detail,
      ack: ackMap.get(ackKey) || null,
    };
  }

  // Fill missing check types with "unknown" so every row has all columns
  for (const row of rowMap.values()) {
    for (const ct of QA_CHECK_TYPES) {
      if (!row.checks[ct]) {
        row.checks[ct] = { status: 'unknown', error_detail: null, ack: null };
      }
    }
  }

  const rows = Array.from(rowMap.values()).sort((a, b) => a.content_code.localeCompare(b.content_code));

  return jsonResponse({
    run_id: runId,
    run: {
      source: run.source,
      started_at: run.started_at,
      finished_at: run.finished_at,
      total_checks: run.total_checks,
      total_pass: run.total_pass,
      total_fail: run.total_fail,
      total_na: run.total_na,
      notes: run.notes,
    },
    rows,
    check_types: [...QA_CHECK_TYPES],
    total_rows: rows.length,
  }, 200);
};
