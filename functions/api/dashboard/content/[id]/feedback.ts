/**
 * GET  /api/dashboard/content/:id/feedback  — List all feedback for a content item.
 * POST /api/dashboard/content/:id/feedback  — Add a feedback comment to a content item.
 */
import { Env, jsonResponse, optionsHandler, requireDashboardAuth, logAudit, type ContentFeedbackRow } from '../../_shared';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const db = env.ENGAGE_DB;
  const contentId = params.id as string;

  const auth = await requireDashboardAuth(request, db, 'dashboard.view');
  if (auth instanceof Response) return auth;

  const result = await db.prepare(
    `SELECT id, content_id, user_id, username, body, status, resolved_by, resolved_at, created_at
     FROM content_feedback
     WHERE content_id = ?
     ORDER BY created_at ASC`
  ).bind(contentId).all<ContentFeedbackRow>();

  return jsonResponse({ items: result.results || [] });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const db = env.ENGAGE_DB;
  const contentId = params.id as string;

  const auth = await requireDashboardAuth(request, db, 'content.qa.update');
  if (auth instanceof Response) return auth;
  const { user } = auth;

  const body = await request.json() as { body?: string };

  if (!body.body || !body.body.trim()) {
    return jsonResponse({ error: 'body is required' }, 400);
  }
  if (body.body.length > 5000) {
    return jsonResponse({ error: 'body must be 5000 characters or fewer' }, 400);
  }

  // Verify content exists
  const content = await db.prepare('SELECT id FROM content WHERE id = ?').bind(contentId).first<{ id: string }>();
  if (!content) return jsonResponse({ error: 'Content not found' }, 404);

  const result = await db.prepare(
    `INSERT INTO content_feedback (content_id, user_id, username, body)
     VALUES (?, ?, ?, ?)
     RETURNING id, content_id, user_id, username, body, status, resolved_by, resolved_at, created_at`
  ).bind(contentId, user.user_id, user.username, body.body.trim()).first<ContentFeedbackRow>();

  await logAudit(db, user, 'feedback.created', JSON.stringify({ content_id: contentId, feedback_id: result?.id }), request);

  return jsonResponse({ success: true, item: result }, 201);
};

export const onRequestOptions = optionsHandler;
