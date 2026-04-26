/**
 * POST /api/dashboard/qa/signoff
 *
 * Submits the weekly QA sign-off, recording metrics about regressions,
 * persistent failures, newly green checks, and steady green checks.
 * Requires: qa.signoff permission.
 *
 * Body: { notes?: string }
 *
 * Eligibility is re-validated server-side:
 *   - 422 if not eligible (with reasons array)
 *   - 409 if already signed this week
 *
 * Response: 201 { signoff_id, week_start_date, based_on_run_id }
 */
import {
  Env, jsonResponse, optionsHandler, getSessionUser, requirePermission, logAudit,
} from '../_shared';

export const onRequestOptions = optionsHandler;

/** Compute Monday of the current UTC week as YYYY-MM-DD. */
function currentWeekStartDate(): string {
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0=Sun, 1=Mon ... 6=Sat
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + daysToMonday);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getSessionUser(request, env.ENGAGE_DB);
  const deny = requirePermission(user, 'qa.signoff');
  if (deny) return deny;

  // Parse optional notes
  let notes: string | null = null;
  try {
    const ct = request.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const body = await request.json() as Record<string, unknown>;
      if (typeof body.notes === 'string') notes = body.notes;
    }
  } catch {
    // notes is optional
  }

  const db = env.ENGAGE_DB;
  const weekStartDate = currentWeekStartDate();
  const reasons: string[] = [];

  // ── Re-validate eligibility ────────────────────────────────────────────────

  // 1. Latest finished run
  const latestRun = await db
    .prepare(`
      SELECT id, started_at, finished_at, total_checks, total_pass, total_fail, total_na
      FROM qa_runs
      WHERE finished_at IS NOT NULL
      ORDER BY started_at DESC
      LIMIT 1
    `)
    .first<{
      id: number;
      started_at: string;
      finished_at: string;
      total_checks: number;
      total_pass: number;
      total_fail: number;
      total_na: number;
    }>();

  if (!latestRun) {
    reasons.push('No finished QA run exists');
  }

  // 2. Run must be < 48h old
  if (latestRun) {
    const ageCheck = await db
      .prepare(`SELECT id FROM qa_runs WHERE id = ? AND started_at > datetime('now', '-48 hours')`)
      .bind(latestRun.id)
      .first<{ id: number }>();
    if (!ageCheck) {
      reasons.push('Most recent run is older than 48 hours');
    }
  }

  // 3. Already signed this week?
  const existingSignoff = await db
    .prepare(`SELECT id FROM qa_weekly_signoffs WHERE week_start_date = ? LIMIT 1`)
    .bind(weekStartDate)
    .first<{ id: number }>();

  if (existingSignoff) {
    return jsonResponse({ error: 'already signed this week' }, 409);
  }

  if (reasons.length > 0) {
    return jsonResponse({ error: 'not eligible for sign-off', reasons }, 422);
  }

  // ── Compute comparison metrics ─────────────────────────────────────────────
  // Find previous signoff's run
  const prevSignoff = await db
    .prepare(`
      SELECT based_on_run_id FROM qa_weekly_signoffs
      WHERE week_start_date < ?
      ORDER BY week_start_date DESC
      LIMIT 1
    `)
    .bind(weekStartDate)
    .first<{ based_on_run_id: number }>();

  let countRegressions = 0;   // fail in latest AND pass in prior
  let countPersistent = 0;    // fail in latest AND fail in prior
  let countNewGreen = 0;      // pass in latest AND fail in prior
  let countSteadyGreen = 0;   // pass in latest AND pass in prior

  if (prevSignoff && latestRun) {
    const [{ results: latestResults }, { results: priorResults }] = await Promise.all([
      db
        .prepare(`SELECT content_code, check_type, status FROM qa_check_results WHERE run_id = ?`)
        .bind(latestRun.id)
        .all<{ content_code: string; check_type: string; status: string }>(),
      db
        .prepare(`SELECT content_code, check_type, status FROM qa_check_results WHERE run_id = ?`)
        .bind(prevSignoff.based_on_run_id)
        .all<{ content_code: string; check_type: string; status: string }>(),
    ]);

    // Build lookup: key → status for prior run
    const priorStatusMap = new Map<string, string>();
    for (const r of priorResults) {
      priorStatusMap.set(`${r.content_code}:${r.check_type}`, r.status);
    }

    for (const r of latestResults) {
      const key = `${r.content_code}:${r.check_type}`;
      const priorStatus = priorStatusMap.get(key);
      const latestFail = r.status === 'fail';
      const latestPass = r.status === 'pass';
      const priorFail = priorStatus === 'fail';
      const priorPass = priorStatus === 'pass';

      if (latestFail && priorPass) countRegressions++;
      if (latestFail && priorFail) countPersistent++;
      if (latestPass && priorFail) countNewGreen++;
      if (latestPass && priorPass) countSteadyGreen++;
    }
  }

  // ── Insert sign-off record ─────────────────────────────────────────────────
  const insertResult = await db
    .prepare(`
      INSERT INTO qa_weekly_signoffs
        (week_start_date, signed_by, signed_at, based_on_run_id,
         count_regressions, count_persistent, count_new_green, count_steady_green, notes)
      VALUES (?, ?, datetime('now'), ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      weekStartDate,
      user!.user_id,
      latestRun!.id,
      countRegressions,
      countPersistent,
      countNewGreen,
      countSteadyGreen,
      notes,
    )
    .run();

  const signoffId = insertResult.meta?.last_row_id ?? null;

  // Audit log (non-fatal)
  try {
    await logAudit(
      db,
      user!,
      'qa.signoff',
      JSON.stringify({
        week_start_date: weekStartDate,
        based_on_run_id: latestRun!.id,
        count_regressions: countRegressions,
        count_persistent: countPersistent,
        count_new_green: countNewGreen,
        count_steady_green: countSteadyGreen,
      }),
      request,
    );
  } catch (e) {
    console.error('logAudit failed:', e);
  }

  return jsonResponse({
    signoff_id: signoffId,
    week_start_date: weekStartDate,
    based_on_run_id: latestRun!.id,
  }, 201);
};
