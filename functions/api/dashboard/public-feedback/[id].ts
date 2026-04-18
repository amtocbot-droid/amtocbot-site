/**
 * PATCH /api/dashboard/public-feedback/:id
 * Update the status of a public feedback submission.
 * Requires: issues.update_status
 */
import { Env, jsonResponse, optionsHandler, requireDashboardAuth } from '../_shared';

const VALID_STATUSES = ['new', 'reviewed', 'actioned', 'dismissed'] as const;

export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) => {
  const db = env.ENGAGE_DB;
  const auth = await requireDashboardAuth(request, db, 'issues.update_status');
  if (auth instanceof Response) return auth;

  const id = parseInt(params.id as string, 10);
  if (isNaN(id)) return jsonResponse({ error: 'Invalid id' }, 400);

  const body = await request.json() as { status?: string };
  const status = body.status?.trim();

  if (!status || !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
    return jsonResponse({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, 400);
  }

  const existing = await db.prepare('SELECT id FROM public_feedback WHERE id = ?').bind(id).first();
  if (!existing) return jsonResponse({ error: 'Feedback not found' }, 404);

  await db.prepare('UPDATE public_feedback SET status = ? WHERE id = ?').bind(status, id).run();

  return jsonResponse({ success: true, id, status });
};

export const onRequestOptions = optionsHandler;
