/**
 * DELETE /api/dashboard/qa/acknowledge/[id]
 *
 * Clear (soft-delete) an active acknowledgement by ID.
 * Requires: qa.acknowledge permission.
 *
 * Params: id (integer)
 * Body (optional): { reason?: string }
 * Response 200: { cleared: true }
 * Response 404: { error: 'not found or already cleared' }
 */
import {
  Env, jsonResponse, optionsHandler, getSessionUser, requirePermission, logAudit,
} from '../_shared';

export const onRequestOptions = optionsHandler;

export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  const user = await getSessionUser(request, env.ENGAGE_DB);
  const deny = requirePermission(user, 'qa.acknowledge');
  if (deny) return deny;

  const idRaw = params.id;
  const id = parseInt(Array.isArray(idRaw) ? idRaw[0] : idRaw, 10);
  if (isNaN(id) || id <= 0) {
    return jsonResponse({ error: 'id must be a positive integer' }, 400);
  }

  let reason: string | null = null;
  try {
    const body = await request.json() as { reason?: string };
    if (body.reason && typeof body.reason === 'string' && body.reason.trim()) {
      reason = body.reason.trim();
    }
  } catch {
    // Body is optional — ignore parse errors
  }

  const db = env.ENGAGE_DB;
  const result = await db
    .prepare(
      `UPDATE qa_acknowledgements
       SET cleared_at = datetime('now'), cleared_reason = ?
       WHERE id = ? AND cleared_at IS NULL`
    )
    .bind(reason, id)
    .run();

  if ((result.meta.changes ?? 0) === 0) {
    return jsonResponse({ error: 'not found or already cleared' }, 404);
  }

  try {
    await logAudit(
      env.ENGAGE_DB,
      user!,
      'qa.acknowledge.clear',
      JSON.stringify({ ack_id: id, cleared_reason: reason }),
      request,
    );
  } catch (e) {
    console.error('[qa/ack/clear] logAudit failed:', e);
  }

  return jsonResponse({ cleared: true }, 200);
};
