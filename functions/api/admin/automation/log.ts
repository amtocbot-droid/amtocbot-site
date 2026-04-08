// POST /api/admin/automation/log — record a completed run (bearer token or session auth)
import { jsonResponse, optionsHandler } from '../../_shared/auth';

interface Env {
  ENGAGE_DB: D1Database;
  SYNC_SECRET?: string;
}

export const onRequestOptions = optionsHandler;

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const db = env.ENGAGE_DB;

  // Auth: bearer token (cron wrapper) or Cloudflare Access JWT
  const auth = request.headers.get('Authorization');
  const hasCfAccess = request.headers.get('CF-Access-JWT-Assertion');
  if (!hasCfAccess && auth !== `Bearer ${env.SYNC_SECRET}`) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const body = await request.json<{
    job: string;
    status: string;
    summary?: string;
    started_at: string;
    finished_at?: string;
    trigger?: string;
  }>();

  if (!body?.job || !body?.status || !body?.started_at) {
    return jsonResponse({ error: 'Missing required fields: job, status, started_at' }, 400);
  }

  await db.prepare(
    `INSERT INTO automation_runs (job_name, started_at, finished_at, status, summary, trigger_type)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(
    body.job,
    body.started_at,
    body.finished_at || null,
    body.status,
    body.summary || null,
    body.trigger || 'cron',
  ).run();

  // Clear trigger_requested flag if this was a triggered run
  if (body.trigger === 'trigger-flag') {
    await db.prepare(
      `UPDATE site_config SET value = 'false', updated_at = datetime('now') WHERE key = ?`
    ).bind(`automation.${body.job}.trigger_requested`).run();
  }

  return jsonResponse({ ok: true });
};
