/**
 * GET /api/dashboard/qa/monitor
 *
 * Public health-check endpoint for Brevo/external uptime monitors.
 * No authentication required.
 *
 * Checks whether a finished QA run has been received in the last 36 hours.
 *
 * Response (healthy):  200 { healthy: true, last_run_id, last_run_at, total_fail, message }
 * Response (unhealthy): 503 { healthy: false, message }
 */
import { Env, jsonResponse, optionsHandler } from '../_shared/auth';

export const onRequestOptions = optionsHandler;

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const latestRun = await env.ENGAGE_DB
    .prepare(`
      SELECT id, started_at, total_checks, total_fail
      FROM qa_runs
      WHERE started_at > datetime('now', '-36 hours') AND finished_at IS NOT NULL
      ORDER BY started_at DESC
      LIMIT 1
    `)
    .first<{ id: number; started_at: string; total_checks: number; total_fail: number }>();

  if (latestRun) {
    return jsonResponse({
      healthy: true,
      last_run_id: latestRun.id,
      last_run_at: latestRun.started_at,
      total_fail: latestRun.total_fail,
      message: 'QA suite ran within 36h',
    }, 200);
  }

  return jsonResponse({
    healthy: false,
    message: 'No QA run in last 36h',
  }, 503);
};
