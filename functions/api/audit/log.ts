/**
 * POST /api/audit/log
 * Writes an audit log entry. Requires authenticated session.
 * Body: {action: 'tab_view'|'link_click'|'search', detail: {...}}
 */
import { Env, jsonResponse, optionsHandler, getSessionUser, logAudit } from '../_shared/auth';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const db = env.ENGAGE_DB;

  try {
    const user = await getSessionUser(request, db);
    if (!user) {
      return jsonResponse({ error: 'Not authenticated' }, 401);
    }

    const body = await request.json() as { action?: string; detail?: unknown };
    const action = body.action;

    if (!action) {
      return jsonResponse({ error: 'Action required' }, 400);
    }

    const detail = body.detail ? JSON.stringify(body.detail) : null;
    await logAudit(db, user, action, detail, request);

    return jsonResponse({ success: true });
  } catch (e) {
    console.error('Audit log error:', e);
    return jsonResponse({ error: 'Server error' }, 500);
  }
};

export const onRequestOptions = optionsHandler;
