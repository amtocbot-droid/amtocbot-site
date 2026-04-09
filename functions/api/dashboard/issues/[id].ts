/**
 * GET   /api/dashboard/issues/:id — Issue detail with comments
 * PATCH /api/dashboard/issues/:id — Update status/assignee/severity
 */
import { Env, jsonResponse, optionsHandler, requireDashboardAuth, logAudit, hasPermission, ISSUE_STATUSES, ISSUE_SEVERITIES, type IssueRow, type IssueCommentRow } from '../_shared';

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  const db = env.ENGAGE_DB;
  const auth = await requireDashboardAuth(request, db, 'dashboard.view');
  if (auth instanceof Response) return auth;

  const issueId = parseInt(params.id as string, 10);
  if (isNaN(issueId)) return jsonResponse({ error: 'Invalid issue ID' }, 400);

  const [issue, comments] = await Promise.all([
    db.prepare(`
      SELECT i.*,
             creator.username as creator_name,
             assignee.username as assignee_name,
             closer.username as closer_name,
             c.title as content_title
      FROM issues i
      LEFT JOIN users creator ON i.created_by = creator.id
      LEFT JOIN users assignee ON i.assigned_to = assignee.id
      LEFT JOIN users closer ON i.closed_by = closer.id
      LEFT JOIN content c ON i.content_id = c.id
      WHERE i.id = ?
    `).bind(issueId).first(),
    db.prepare(
      'SELECT * FROM issue_comments WHERE issue_id = ? ORDER BY created_at ASC'
    ).bind(issueId).all<IssueCommentRow>(),
  ]);

  if (!issue) return jsonResponse({ error: 'Issue not found' }, 404);

  return jsonResponse({
    issue,
    comments: comments.results || [],
  });
};

export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) => {
  const db = env.ENGAGE_DB;
  const auth = await requireDashboardAuth(request, db, 'dashboard.view');
  if (auth instanceof Response) return auth;
  const { user } = auth;

  const issueId = parseInt(params.id as string, 10);
  if (isNaN(issueId)) return jsonResponse({ error: 'Invalid issue ID' }, 400);

  const issue = await db.prepare('SELECT * FROM issues WHERE id = ?').bind(issueId).first<IssueRow>();
  if (!issue) return jsonResponse({ error: 'Issue not found' }, 404);

  const body = await request.json() as {
    status?: string;
    severity?: string;
    assigned_to?: number | null;
  };

  const updates: string[] = [];
  const binds: unknown[] = [];

  // Status change
  if (body.status && body.status !== issue.status) {
    if (!ISSUE_STATUSES.includes(body.status as any)) {
      return jsonResponse({ error: `Invalid status. Must be one of: ${ISSUE_STATUSES.join(', ')}` }, 400);
    }

    const isClosing = body.status === 'closed' || body.status === 'wont_fix';
    if (isClosing) {
      if (!hasPermission(user, 'issues.close')) {
        return jsonResponse({ error: 'Only approvers and admins can close issues' }, 403);
      }
      updates.push('closed_by = ?', 'closed_at = datetime(\'now\')');
      binds.push(user.user_id);
    } else {
      if (!hasPermission(user, 'issues.update_status')) {
        return jsonResponse({ error: 'Insufficient permissions to change status' }, 403);
      }
    }
    updates.push('status = ?');
    binds.push(body.status);
  }

  // Severity change
  if (body.severity && body.severity !== issue.severity) {
    if (!ISSUE_SEVERITIES.includes(body.severity as any)) {
      return jsonResponse({ error: 'Invalid severity' }, 400);
    }
    if (!hasPermission(user, 'issues.update_status')) {
      return jsonResponse({ error: 'Insufficient permissions' }, 403);
    }
    updates.push('severity = ?');
    binds.push(body.severity);
  }

  // Assignment change (admin only)
  if (body.assigned_to !== undefined) {
    if (!hasPermission(user, 'issues.assign')) {
      return jsonResponse({ error: 'Only admins can assign issues' }, 403);
    }
    updates.push('assigned_to = ?');
    binds.push(body.assigned_to);
  }

  if (updates.length === 0) {
    return jsonResponse({ error: 'No valid fields to update' }, 400);
  }

  updates.push('updated_at = datetime(\'now\')');
  binds.push(issueId);

  await db.prepare(
    `UPDATE issues SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...binds).run();

  await logAudit(db, user, 'issue_updated', JSON.stringify({ issueId, changes: body }), request);

  return jsonResponse({ success: true });
};

export const onRequestOptions = optionsHandler;
