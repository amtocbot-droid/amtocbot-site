/**
 * PATCH /api/dashboard/content/:id/qa
 * Update the QA status of a content item.
 * Permissions vary by transition.
 */
import { Env, jsonResponse, optionsHandler, requireDashboardAuth, logAudit, hasPermission, type QAStatus, QA_STATUSES } from '../../_shared';

interface QABody { qa_status?: string }

// Map transitions to required permissions
const TRANSITION_PERMS: Record<string, string> = {
  'draft->in_review': 'content.qa.update',
  'flagged->in_review': 'content.qa.update',
  'rejected->in_review': 'content.qa.update',
  'in_review->approved': 'content.qa.approve',
  'in_review->rejected': 'content.qa.reject',
  'approved->published': 'users.manage', // admin only
};

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const db = env.ENGAGE_DB;
  const contentId = params.id as string;

  // Base auth — any dashboard role
  const auth = await requireDashboardAuth(request, db, 'dashboard.view');
  if (auth instanceof Response) return auth;
  const { user } = auth;

  const body = await request.json() as QABody;
  const newStatus = body.qa_status as QAStatus;
  if (!newStatus || !QA_STATUSES.includes(newStatus)) {
    return jsonResponse({ error: `Invalid qa_status. Must be one of: ${QA_STATUSES.join(', ')}` }, 400);
  }

  // Get current QA status
  const content = await db.prepare('SELECT id, qa_status, title FROM content WHERE id = ?').bind(contentId).first<{ id: string; qa_status: string; title: string }>();
  if (!content) return jsonResponse({ error: 'Content not found' }, 404);

  const currentStatus = content.qa_status || 'draft';

  // Allow flagging from any state for testers
  if (newStatus === 'flagged') {
    if (!hasPermission(user, 'content.qa.update')) {
      return jsonResponse({ error: 'Insufficient permissions' }, 403);
    }
  } else {
    const transitionKey = `${currentStatus}->${newStatus}`;
    const requiredPerm = TRANSITION_PERMS[transitionKey];
    if (!requiredPerm) {
      return jsonResponse({ error: `Invalid transition: ${currentStatus} → ${newStatus}` }, 400);
    }
    if (!hasPermission(user, requiredPerm as any)) {
      return jsonResponse({ error: 'Insufficient permissions for this transition' }, 403);
    }
  }

  await db.prepare(
    'UPDATE content SET qa_status = ?, qa_updated_at = datetime(\'now\'), qa_updated_by = ? WHERE id = ?'
  ).bind(newStatus, user.user_id, contentId).run();

  await logAudit(db, user, 'qa_status_change', JSON.stringify({ contentId, from: currentStatus, to: newStatus, title: content.title }), request);

  return jsonResponse({ success: true, qa_status: newStatus });
};

export const onRequestOptions = optionsHandler;
