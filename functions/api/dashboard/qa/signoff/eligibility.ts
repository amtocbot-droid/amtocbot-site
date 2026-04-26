/**
 * GET /api/dashboard/qa/signoff/eligibility
 *
 * Checks whether the current user is eligible to submit a weekly QA sign-off.
 * Requires: qa.view permission.
 *
 * Eligibility conditions:
 *   1. A finished run exists (finished_at IS NOT NULL)
 *   2. The latest run is < 48h old (started_at > datetime('now', '-48 hours'))
 *   3. No sign-off has already been submitted for this ISO week (Monday boundary)
 *
 * Also computes regressions: checks that are 'fail' in the latest run but were
 * 'pass' in the run that the previous weekly sign-off was based on.
 *
 * Response:
 * {
 *   eligible: boolean,
 *   reasons: string[],
 *   latest_run_id: number | null,
 *   latest_run_finished_at: string | null,
 *   week_start_date: string,
 *   already_signed: boolean,
 *   count_fail: number,
 *   count_regressions: number,
 *   count_pass: number,
 *   count_na: number,
 * }
 */
import {
  Env, jsonResponse, optionsHandler, getSessionUser, requirePermission,
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

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getSessionUser(request, env.ENGAGE_DB);
  const deny = requirePermission(user, 'qa.view');
  if (deny) return deny;

  const db = env.ENGAGE_DB;
  const weekStartDate = currentWeekStartDate();
  const reasons: string[] = [];

  // Fetch the latest finished run
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

  // Check age (< 48h)
  if (latestRun) {
    const ageCheck = await db
      .prepare(`SELECT id FROM qa_runs WHERE id = ? AND started_at > datetime('now', '-48 hours')`)
      .bind(latestRun.id)
      .first<{ id: number }>();
    if (!ageCheck) {
      reasons.push('Most recent run is older than 48 hours');
    }
  }

  // Check if already signed this week
  const existingSignoff = await db
    .prepare(`SELECT id FROM qa_weekly_signoffs WHERE week_start_date = ? LIMIT 1`)
    .bind(weekStartDate)
    .first<{ id: number }>();
  const alreadySigned = !!existingSignoff;
  if (alreadySigned) {
    reasons.push('Already signed off this week');
  }

  // Compute regressions (fail in latest run that were pass in previous signoff's run)
  let countRegressions = 0;
  if (latestRun) {
    // Find the most recent previous signoff (not this week)
    const prevSignoff = await db
      .prepare(`
        SELECT based_on_run_id FROM qa_weekly_signoffs
        WHERE week_start_date < ?
        ORDER BY week_start_date DESC
        LIMIT 1
      `)
      .bind(weekStartDate)
      .first<{ based_on_run_id: number }>();

    if (prevSignoff) {
      // Fails in latest run
      const { results: latestFails } = await db
        .prepare(`
          SELECT content_code, check_type FROM qa_check_results
          WHERE run_id = ? AND status = 'fail'
        `)
        .bind(latestRun.id)
        .all<{ content_code: string; check_type: string }>();

      if (latestFails.length > 0) {
        // For each fail, check if it was pass in previous signoff's run
        // Build a set of "code:type" that were pass in the prior run
        const { results: priorPasses } = await db
          .prepare(`
            SELECT content_code, check_type FROM qa_check_results
            WHERE run_id = ? AND status = 'pass'
          `)
          .bind(prevSignoff.based_on_run_id)
          .all<{ content_code: string; check_type: string }>();

        const priorPassSet = new Set(priorPasses.map(r => `${r.content_code}:${r.check_type}`));
        for (const f of latestFails) {
          if (priorPassSet.has(`${f.content_code}:${f.check_type}`)) {
            countRegressions++;
          }
        }
      }
    }
  }

  const eligible = reasons.length === 0;

  return jsonResponse({
    eligible,
    reasons,
    latest_run_id: latestRun?.id ?? null,
    latest_run_finished_at: latestRun?.finished_at ?? null,
    week_start_date: weekStartDate,
    already_signed: alreadySigned,
    count_fail: latestRun?.total_fail ?? 0,
    count_regressions: countRegressions,
    count_pass: latestRun?.total_pass ?? 0,
    count_na: latestRun?.total_na ?? 0,
  }, 200);
};
