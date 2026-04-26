/**
 * POST /api/dashboard/qa/issue-from-cell
 *
 * Create an issue directly from a failing QA matrix cell.
 * Requires: qa.acknowledge permission.
 *
 * Body: { content_code: string, check_type: string, severity?: string, description?: string }
 * Response 201: { issue_id: number, title: string, severity: string }
 */
import {
  Env, jsonResponse, optionsHandler, getSessionUser, requirePermission, logAudit,
  QA_CHECK_TYPES,
} from './_shared';

export const onRequestOptions = optionsHandler;

const VALID_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getSessionUser(request, env.ENGAGE_DB);
  const deny = requirePermission(user, 'qa.acknowledge');
  if (deny) return deny;

  let body: { content_code?: string; check_type?: string; severity?: string; description?: string };
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

  // Severity defaults to 'medium' if not valid
  const severity: string =
    body.severity && (VALID_SEVERITIES as readonly string[]).includes(body.severity)
      ? body.severity
      : 'medium';

  const db = env.ENGAGE_DB;

  // Look up latest error_detail and content_title for this cell
  const lastResult = await db
    .prepare(
      `SELECT error_detail, content_title
       FROM qa_check_results
       WHERE content_code = ? AND check_type = ?
       ORDER BY checked_at DESC
       LIMIT 1`
    )
    .bind(body.content_code, body.check_type)
    .first<{ error_detail: string | null; content_title: string | null }>();

  const lastError = lastResult?.error_detail ?? null;
  const contentTitle = lastResult?.content_title ?? null;

  // Build title and description
  const title = `[QA] ${body.content_code} · ${body.check_type} fail`;

  const descParts: string[] = [];
  if (body.description?.trim()) {
    descParts.push(body.description.trim());
    descParts.push('');
  }
  descParts.push(`**Content:** ${body.content_code}${contentTitle ? ` — ${contentTitle}` : ''}`);
  descParts.push(`**Check type:** ${body.check_type}`);
  if (lastError) {
    descParts.push(`**Last error:** ${lastError}`);
  }
  const description = descParts.join('\n');

  // Insert into issues table (with qa_* fields from migration 011)
  const result = await db
    .prepare(
      `INSERT INTO issues
         (title, description, type, severity, status, content_id, qa_content_code, qa_check_type, created_by)
       VALUES (?, ?, 'quality', ?, 'open', NULL, ?, ?, ?)`
    )
    .bind(title, description, severity, body.content_code, body.check_type, user!.user_id)
    .run();

  const issueId = result.meta.last_row_id as number;

  try {
    await logAudit(
      env.ENGAGE_DB,
      user!,
      'qa.issue_from_cell',
      JSON.stringify({ issue_id: issueId, content_code: body.content_code, check_type: body.check_type, severity }),
      request,
    );
  } catch (e) {
    console.error('[qa/issue-from-cell] logAudit failed:', e);
  }

  return jsonResponse({ issue_id: issueId, title, severity }, 201);
};
