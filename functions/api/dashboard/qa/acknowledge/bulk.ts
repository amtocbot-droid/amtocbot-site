/**
 * POST /api/dashboard/qa/acknowledge/bulk
 *
 * Bulk-acknowledge multiple (content_code, check_type) cells in one request.
 * Requires: qa.acknowledge permission.
 *
 * Body: { cells: [{content_code, check_type}][], reason: string, expires_in_days?: number }
 * Response 201: { count: number, acks: [{content_code, check_type, ack_id}], expires_at: string }
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

  let body: { cells?: unknown; reason?: string; expires_in_days?: number };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  // Validate cells array
  if (!Array.isArray(body.cells) || body.cells.length === 0) {
    return jsonResponse({ error: 'cells must be a non-empty array' }, 400);
  }
  if (body.cells.length > 500) {
    return jsonResponse({ error: 'cells array cannot exceed 500 items' }, 400);
  }

  // Validate each cell
  for (let i = 0; i < body.cells.length; i++) {
    const cell = body.cells[i] as { content_code?: unknown; check_type?: unknown };
    if (!cell || typeof cell !== 'object') {
      return jsonResponse({ error: `cells[${i}] must be an object` }, 400);
    }
    if (!cell.content_code || typeof cell.content_code !== 'string') {
      return jsonResponse({ error: `cells[${i}].content_code is required` }, 400);
    }
    if (!cell.check_type || !(QA_CHECK_TYPES as readonly string[]).includes(cell.check_type as string)) {
      return jsonResponse({ error: `cells[${i}].check_type must be one of: ${QA_CHECK_TYPES.join(', ')}` }, 400);
    }
  }

  // Validate reason
  if (!body.reason || typeof body.reason !== 'string' || body.reason.trim().length < 3) {
    return jsonResponse({ error: 'reason must be at least 3 characters' }, 400);
  }

  // Clamp expires_in_days 1..90, default 14
  let days = typeof body.expires_in_days === 'number' ? body.expires_in_days : 14;
  days = Math.max(1, Math.min(90, Math.round(days)));

  const expiresAt = new Date(Date.now() + days * 86_400_000).toISOString();
  const reason = body.reason.trim();
  const userId = user!.user_id;
  const db = env.ENGAGE_DB;

  const cells = body.cells as Array<{ content_code: string; check_type: string }>;
  const acks: Array<{ content_code: string; check_type: string; ack_id: number }> = [];

  // Batch inserts in chunks of 25
  const BATCH_SIZE = 25;
  for (let i = 0; i < cells.length; i += BATCH_SIZE) {
    const chunk = cells.slice(i, i + BATCH_SIZE);
    const stmts = chunk.map(cell =>
      db
        .prepare(
          `INSERT INTO qa_acknowledgements
             (content_code, check_type, acknowledged_by, reason, expires_at)
           VALUES (?, ?, ?, ?, ?)`
        )
        .bind(cell.content_code, cell.check_type, userId, reason, expiresAt)
    );
    const results = await db.batch(stmts);
    for (let j = 0; j < chunk.length; j++) {
      acks.push({
        content_code: chunk[j].content_code,
        check_type: chunk[j].check_type,
        ack_id: results[j].meta.last_row_id as number,
      });
    }
  }

  try {
    await logAudit(
      env.ENGAGE_DB,
      user!,
      'qa.acknowledge.bulk',
      JSON.stringify({ count: acks.length, expires_at: expiresAt, cells: cells.map(c => `${c.content_code}|${c.check_type}`) }),
      request,
    );
  } catch (e) {
    console.error('[qa/ack/bulk] logAudit failed:', e);
  }

  return jsonResponse({ count: acks.length, acks, expires_at: expiresAt }, 201);
};
