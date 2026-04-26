/**
 * POST /api/dashboard/qa/acknowledge
 *
 * Create a single QA acknowledgement for a (content_code, check_type) cell.
 * Requires: qa.acknowledge permission.
 *
 * Body: { content_code: string, check_type: string, reason: string, expires_in_days?: number }
 * Response 201: { ack_id: number, expires_at: string }
 */
import {
  Env, jsonResponse, optionsHandler, getSessionUser, requirePermission, logAudit,
  QA_CHECK_TYPES,
} from '../_shared';

export const onRequestOptions = optionsHandler;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getSessionUser(request, env.ENGAGE_DB);
  const deny = requirePermission(user, 'qa.acknowledge');
  if (deny) return deny;

  let body: { content_code?: string; check_type?: string; reason?: string; expires_in_days?: number };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  // Validate content_code
  if (!body.content_code || typeof body.content_code !== 'string') {
    return jsonResponse({ error: 'content_code is required' }, 400);
  }

  // Validate check_type
  if (!body.check_type || !(QA_CHECK_TYPES as readonly string[]).includes(body.check_type)) {
    return jsonResponse({ error: `check_type must be one of: ${QA_CHECK_TYPES.join(', ')}` }, 400);
  }

  // Validate reason
  if (!body.reason || typeof body.reason !== 'string' || body.reason.trim().length < 3) {
    return jsonResponse({ error: 'reason must be at least 3 characters' }, 400);
  }

  // Clamp expires_in_days 1..90, default 14
  let days = typeof body.expires_in_days === 'number' ? body.expires_in_days : 14;
  days = Math.max(1, Math.min(90, Math.round(days)));

  const expiresAt = new Date(Date.now() + days * 86_400_000).toISOString();

  const db = env.ENGAGE_DB;
  const result = await db
    .prepare(
      `INSERT INTO qa_acknowledgements
         (content_code, check_type, acknowledged_by, reason, expires_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(
      body.content_code,
      body.check_type,
      user!.user_id,
      body.reason.trim(),
      expiresAt,
    )
    .run();

  const ackId = result.meta.last_row_id as number;

  try {
    await logAudit(
      env.ENGAGE_DB,
      user!,
      'qa.acknowledge',
      JSON.stringify({ ack_id: ackId, content_code: body.content_code, check_type: body.check_type, expires_at: expiresAt }),
      request,
    );
  } catch (e) {
    console.error('[qa/ack] logAudit failed:', e);
  }

  return jsonResponse({ ack_id: ackId, expires_at: expiresAt }, 201);
};
