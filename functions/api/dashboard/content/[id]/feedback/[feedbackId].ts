/**
 * PATCH /api/dashboard/content/:id/feedback/:feedbackId
 * Resolve or reopen a feedback item.
 */
import { Env, jsonResponse, optionsHandler, requireDashboardAuth, logAudit, FEEDBACK_STATUSES, type FeedbackStatus } from '../../../_shared';

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const db = env.ENGAGE_DB;
  const contentId = params.id as string;
  const feedbackId = params.feedbackId as string;

  const auth = await requireDashboardAuth(request, db, 'content.qa.approve');
  if (auth instanceof Response) return auth;
  const { user } = auth;

  const body = await request.json() as { status?: string };
  const newStatus = body.status as FeedbackStatus;

  if (!newStatus || !(FEEDBACK_STATUSES as readonly string[]).includes(newStatus)) {
    return jsonResponse({ error: `status must be one of: ${FEEDBACK_STATUSES.join(', ')}` }, 400);
  }

  // Verify feedback exists and belongs to this content item
  const existing = await db.prepare(
    'SELECT id, status FROM content_feedback WHERE id = ? AND content_id = ?'
  ).bind(feedbackId, contentId).first<{ id: number; status: string }>();

  if (!existing) return jsonResponse({ error: 'Feedback not found' }, 404);

  const isResolving = newStatus === 'resolved';

  await db.prepare(
    `UPDATE content_feedback
     SET status = ?,
         resolved_by = ?,
         resolved_at = ?
     WHERE id = ? AND content_id = ?`
  ).bind(
    newStatus,
    isResolving ? user.user_id : null,
    isResolving ? new Date().toISOString().replace('T', ' ').slice(0, 19) : null,
    feedbackId,
    contentId,
  ).run();

  await logAudit(
    db,
    user,
    'feedback.status_changed',
    JSON.stringify({ content_id: contentId, feedback_id: feedbackId, from: existing.status, to: newStatus }),
    request,
  );

  return jsonResponse({ success: true });
};

export const onRequestOptions = optionsHandler;
