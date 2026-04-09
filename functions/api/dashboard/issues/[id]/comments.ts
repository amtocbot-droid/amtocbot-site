/**
 * POST /api/dashboard/issues/:id/comments
 * Add a comment to an issue. All dashboard roles can comment.
 */
import { Env, jsonResponse, optionsHandler, requireDashboardAuth } from '../../_shared';

export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
  const db = env.ENGAGE_DB;
  const auth = await requireDashboardAuth(request, db, 'issues.comment');
  if (auth instanceof Response) return auth;
  const { user } = auth;

  const issueId = parseInt(params.id as string, 10);
  if (isNaN(issueId)) return jsonResponse({ error: 'Invalid issue ID' }, 400);

  // Verify issue exists
  const issue = await db.prepare('SELECT id FROM issues WHERE id = ?').bind(issueId).first();
  if (!issue) return jsonResponse({ error: 'Issue not found' }, 404);

  const body = await request.json() as { body?: string };
  if (!body.body?.trim()) {
    return jsonResponse({ error: 'Comment body is required' }, 400);
  }

  const result = await db.prepare(`
    INSERT INTO issue_comments (issue_id, user_id, username, body) VALUES (?, ?, ?, ?)
  `).bind(issueId, user.user_id, user.username, body.body.trim()).run();

  return jsonResponse({
    success: true,
    comment: {
      id: result.meta.last_row_id,
      issue_id: issueId,
      user_id: user.user_id,
      username: user.username,
      body: body.body.trim(),
    },
  }, 201);
};

export const onRequestOptions = optionsHandler;
