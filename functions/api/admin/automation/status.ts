// GET /api/admin/automation/status — return job status, pause state, last run
import { jsonResponse, getSessionUser, optionsHandler } from '../../_shared/auth';

interface Env {
  ENGAGE_DB: D1Database;
}

export const onRequestOptions = optionsHandler;

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const db = env.ENGAGE_DB;

  const user = await getSessionUser(request, db);
  if (!user || user.role !== 'admin') {
    return jsonResponse({ error: 'Admin access required' }, 403);
  }

  const url = new URL(request.url);
  const jobFilter = url.searchParams.get('job');

  // Get all automation config flags
  const { results: configRows } = await db.prepare(
    `SELECT key, value FROM site_config WHERE key LIKE 'automation.%'`
  ).all<{ key: string; value: string }>();

  // Parse config into job map
  const jobConfigs: Record<string, { paused: boolean; trigger_requested: boolean }> = {};
  for (const row of configRows || []) {
    const parts = row.key.split('.');
    if (parts.length !== 3) continue;
    const jobName = parts[1];
    const field = parts[2];
    if (!jobConfigs[jobName]) {
      jobConfigs[jobName] = { paused: false, trigger_requested: false };
    }
    if (field === 'paused') jobConfigs[jobName].paused = row.value === 'true';
    if (field === 'trigger_requested') jobConfigs[jobName].trigger_requested = row.value === 'true';
  }

  const jobNames = jobFilter ? [jobFilter] : Object.keys(jobConfigs);
  const jobs: Record<string, unknown> = {};

  for (const jobName of jobNames) {
    const lastRun = await db.prepare(
      `SELECT * FROM automation_runs WHERE job_name = ? ORDER BY started_at DESC LIMIT 1`
    ).bind(jobName).first();

    const recentRuns = await db.prepare(
      `SELECT * FROM automation_runs WHERE job_name = ? ORDER BY started_at DESC LIMIT 10`
    ).bind(jobName).all();

    const schedules: Record<string, string> = {
      'metrics-scrape': '1:30 AM ET daily',
      'engage-refresh': '2:00 AM ET daily',
      'calendar-generate': '11:00 PM ET Sunday',
    };

    jobs[jobName] = {
      paused: jobConfigs[jobName]?.paused ?? false,
      trigger_requested: jobConfigs[jobName]?.trigger_requested ?? false,
      schedule: schedules[jobName] || 'unknown',
      last_run: lastRun || null,
      recent_runs: recentRuns.results || [],
    };
  }

  return jsonResponse({ jobs });
};
