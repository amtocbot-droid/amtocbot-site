/**
 * GET  /api/dashboard/issues — List issues with filters
 * POST /api/dashboard/issues — Create a new issue
 */
import { Env, jsonResponse, optionsHandler, requireDashboardAuth, logAudit, ISSUE_TYPES, ISSUE_SEVERITIES } from '../_shared';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const db = env.ENGAGE_DB;
  const auth = await requireDashboardAuth(request, db, 'dashboard.view');
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const type = url.searchParams.get('type');
  const severity = url.searchParams.get('severity');
  const assignedTo = url.searchParams.get('assigned_to');
  const contentId = url.searchParams.get('content_id');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  let sql = `
    SELECT i.*,
           creator.username as creator_name,
           assignee.username as assignee_name
    FROM issues i
    LEFT JOIN users creator ON i.created_by = creator.id
    LEFT JOIN users assignee ON i.assigned_to = assignee.id
    WHERE 1=1
  `;
  const binds: unknown[] = [];

  if (status) { sql += ' AND i.status = ?'; binds.push(status); }
  if (type) { sql += ' AND i.type = ?'; binds.push(type); }
  if (severity) { sql += ' AND i.severity = ?'; binds.push(severity); }
  if (assignedTo) { sql += ' AND i.assigned_to = ?'; binds.push(parseInt(assignedTo, 10)); }
  if (contentId) { sql += ' AND i.content_id = ?'; binds.push(contentId); }

  sql += ' ORDER BY i.created_at DESC LIMIT ? OFFSET ?';
  binds.push(limit, offset);

  const result = await db.prepare(sql).bind(...binds).all();

  return jsonResponse({ items: result.results || [], meta: { limit, offset } });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const db = env.ENGAGE_DB;
  const auth = await requireDashboardAuth(request, db, 'issues.create');
  if (auth instanceof Response) return auth;
  const { user } = auth;

  const body = await request.json() as {
    title?: string;
    description?: string;
    type?: string;
    severity?: string;
    content_id?: string;
    assigned_to?: number;
  };

  if (!body.title?.trim()) {
    return jsonResponse({ error: 'Title is required' }, 400);
  }

  const type = body.type && ISSUE_TYPES.includes(body.type as any) ? body.type : 'bug';
  const severity = body.severity && ISSUE_SEVERITIES.includes(body.severity as any) ? body.severity : 'medium';

  const result = await db.prepare(`
    INSERT INTO issues (title, description, type, severity, content_id, created_by, assigned_to)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    body.title.trim(),
    body.description?.trim() || null,
    type,
    severity,
    body.content_id || null,
    user.user_id,
    body.assigned_to || null,
  ).run();

  await logAudit(db, user, 'issue_created', JSON.stringify({ title: body.title, type, severity }), request);

  return jsonResponse({ success: true, id: result.meta.last_row_id }, 201);
};

export const onRequestOptions = optionsHandler;
