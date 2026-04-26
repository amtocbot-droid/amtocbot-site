/**
 * POST /api/dashboard/qa/ingest
 * Bearer-token authenticated. GitHub Actions writes a full run + all check results.
 * Idempotent via run.client_run_id (UNIQUE).
 */
import {
  Env, jsonResponse, optionsHandler, requireIngestToken,
  validateIngestPayload, QaIngestPayload, QA_CHECK_TYPES, logAudit,
} from './_shared';

export const onRequestOptions = optionsHandler;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const tokenErr = await requireIngestToken(request, env);
  if (tokenErr) return tokenErr;

  let payload: QaIngestPayload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid JSON' }, 400);
  }

  const errors = validateIngestPayload(payload);
  if (errors.length > 0) {
    return jsonResponse({ error: 'validation failed', details: errors }, 422);
  }

  const db = env.ENGAGE_DB;

  // Idempotency: if client_run_id already exists, return that run_id.
  if (payload.run.client_run_id) {
    const existing = await db
      .prepare('SELECT id FROM qa_runs WHERE client_run_id = ?')
      .bind(payload.run.client_run_id)
      .first<{ id: number }>();
    if (existing) {
      return jsonResponse({ run_id: existing.id, idempotent: true }, 200);
    }
  }

  // Compute totals
  let totalChecks = 0, totalPass = 0, totalFail = 0, totalNa = 0;
  for (const r of payload.results) {
    for (const ct of QA_CHECK_TYPES) {
      const cell = r.checks[ct];
      if (!cell) continue;
      totalChecks++;
      if (cell.status === 'pass') totalPass++;
      else if (cell.status === 'fail') totalFail++;
      else if (cell.status === 'na') totalNa++;
    }
  }

  // Insert qa_runs row
  const runInsert = await db.prepare(
    `INSERT INTO qa_runs (client_run_id, started_at, finished_at, source, total_checks, total_pass, total_fail, total_na, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    payload.run.client_run_id || null,
    payload.run.started_at,
    payload.run.finished_at,
    payload.run.source,
    totalChecks, totalPass, totalFail, totalNa,
    payload.run.notes || null,
  ).run();

  const runId = runInsert.meta.last_row_id as number;

  // Chunk inserts: D1 batch is up to 50 statements; multi-row VALUES with up to 50 rows each.
  const ROWS_PER_STATEMENT = 50;
  const STATEMENTS_PER_BATCH = 25;

  const flatRows: Array<[number, string, string, string | null, string, string, string | null, string]> = [];
  for (const r of payload.results) {
    for (const ct of QA_CHECK_TYPES) {
      const cell = r.checks[ct];
      if (!cell) continue;
      flatRows.push([
        runId,
        r.content_code,
        r.content_kind,
        r.content_title || null,
        ct,
        cell.status,
        cell.error_detail || null,
        payload.run.finished_at,
      ]);
    }
  }

  // Build statements
  const statements: D1PreparedStatement[] = [];
  for (let i = 0; i < flatRows.length; i += ROWS_PER_STATEMENT) {
    const chunk = flatRows.slice(i, i + ROWS_PER_STATEMENT);
    const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const binds = chunk.flat();
    statements.push(
      db.prepare(
        `INSERT INTO qa_check_results
           (run_id, content_code, content_kind, content_title, check_type, status, error_detail, checked_at)
         VALUES ${placeholders}`
      ).bind(...binds)
    );
  }

  // Execute batches
  for (let i = 0; i < statements.length; i += STATEMENTS_PER_BATCH) {
    await db.batch(statements.slice(i, i + STATEMENTS_PER_BATCH));
  }

  // Audit log — system actor uses a synthetic SessionUser (user_id 0) and forwards the
  // original request so logAudit can extract the caller IP.
  const systemActor = { user_id: 0, username: 'system', role: 'superadmin' } as const;
  await logAudit(db, systemActor, 'qa.ingest', JSON.stringify({
    run_id: runId, total_checks: totalChecks, total_fail: totalFail,
  }), request);

  return jsonResponse({ run_id: runId, total_checks: totalChecks, total_fail: totalFail }, 201);
};
