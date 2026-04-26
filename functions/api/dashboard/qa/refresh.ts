/**
 * POST /api/dashboard/qa/refresh
 *
 * Triggers the GH Actions qa-suite.yml workflow dispatch.
 * Requires: qa.refresh permission.
 *
 * Optional body: { kind?: string, code?: string, check_only?: string }
 *
 * Response: 202 { dispatched: true, tracking_run_after }
 */
import {
  Env, jsonResponse, optionsHandler, getSessionUser, requirePermission, logAudit,
} from './_shared';

export const onRequestOptions = optionsHandler;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getSessionUser(request, env.ENGAGE_DB);
  const deny = requirePermission(user, 'qa.refresh');
  if (deny) return deny;

  const pat = (env as any).GH_REPOSITORY_DISPATCH_TOKEN as string | undefined;
  if (!pat) {
    return jsonResponse({ error: 'GH_REPOSITORY_DISPATCH_TOKEN not configured' }, 500);
  }

  // Parse optional body
  let kind: string | undefined;
  let code: string | undefined;
  let check_only: string | undefined;
  try {
    const ct = request.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const body = await request.json() as Record<string, unknown>;
      if (typeof body.kind === 'string') kind = body.kind;
      if (typeof body.code === 'string') code = body.code;
      if (typeof body.check_only === 'string') check_only = body.check_only;
    }
  } catch {
    // body is optional — ignore parse errors
  }

  // Capture tracking timestamp BEFORE the GH call
  const tracking_run_after = new Date().toISOString();

  // Build GH Actions workflow inputs (omit undefined values)
  const inputs: Record<string, string> = {};
  if (kind !== undefined) inputs.kind = kind;
  if (code !== undefined) inputs.code = code;
  if (check_only !== undefined) inputs.check_only = check_only;

  const ghResp = await fetch(
    'https://api.github.com/repos/amtocbot-droid/amtocsoft-content/actions/workflows/qa-suite.yml/dispatches',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${pat}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'amtocbot-site',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref: 'main', inputs }),
    },
  );

  if (!ghResp.ok) {
    return jsonResponse({ error: `workflow dispatch failed: ${ghResp.status}` }, 502);
  }

  // Audit log (non-fatal)
  try {
    await logAudit(
      env.ENGAGE_DB,
      user!,
      'qa.refresh',
      JSON.stringify({ kind, code, check_only, tracking_run_after }),
      request,
    );
  } catch (e) {
    console.error('logAudit failed:', e);
  }

  return jsonResponse({ dispatched: true, tracking_run_after }, 202);
};
