/**
 * GET   /api/dashboard/content/:id  — Fetch a single content item.
 * PATCH /api/dashboard/content/:id  — Update editable fields of a content item.
 */
import { Env, jsonResponse, optionsHandler, requireDashboardAuth, logAudit, getSessionUser, requirePermission } from '../../_shared';

interface ContentRow {
  id: string;
  type: string;
  title: string;
  date: string;
  level: string | null;
  topic: string | null;
  status: string;
  qa_status: string;
  qa_updated_at: string | null;
  blog_url: string | null;
  youtube_url: string | null;
  description: string | null;
  external_url: string | null;
  reviewer_instructions: string | null;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const db = env.ENGAGE_DB;
  const contentId = params.id as string;

  const auth = await requireDashboardAuth(request, db, 'dashboard.view');
  if (auth instanceof Response) return auth;

  const row = await db.prepare(
    `SELECT id, type, title, date, level, topic, status, qa_status, qa_updated_at,
            blog_url, youtube_url, description, external_url, reviewer_instructions
     FROM content WHERE id = ?`
  ).bind(contentId).first<ContentRow>();

  if (!row) return jsonResponse({ error: 'Content not found' }, 404);

  return jsonResponse({ content: row });
};

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const db = env.ENGAGE_DB;
  const contentId = params.id as string;

  const auth = await requireDashboardAuth(request, db, 'content.qa.update');
  if (auth instanceof Response) return auth;
  const { user } = auth;

  const body = await request.json() as {
    title?: string;
    level?: string;
    topic?: string;
    body_draft?: string;
    external_url?: string;
    reviewer_instructions?: string;
  };

  const sets: string[] = [];
  const binds: unknown[] = [];

  if (body.title !== undefined && body.title !== null) {
    sets.push('title = ?');
    binds.push(body.title);
  }
  if (body.level !== undefined && body.level !== null) {
    sets.push('level = ?');
    binds.push(body.level);
  }
  if (body.topic !== undefined && body.topic !== null) {
    sets.push('topic = ?');
    binds.push(body.topic);
  }
  if (body.body_draft !== undefined && body.body_draft !== null) {
    sets.push('description = ?');
    binds.push(body.body_draft);
  }
  if (body.external_url !== undefined && body.external_url !== null) {
    sets.push('external_url = ?');
    binds.push(body.external_url);
  }
  // Only admins can update reviewer_instructions
  if (body.reviewer_instructions !== undefined && body.reviewer_instructions !== null && (user.role === 'admin' || user.role === 'superadmin')) {
    sets.push('reviewer_instructions = ?');
    binds.push(body.reviewer_instructions);
  }

  if (sets.length === 0) {
    return jsonResponse({ error: 'No valid fields provided to update' }, 400);
  }

  binds.push(contentId);
  await db.prepare(`UPDATE content SET ${sets.join(', ')} WHERE id = ?`).bind(...binds).run();

  await logAudit(db, user, 'content.updated', JSON.stringify({ id: contentId, fields: sets.map(s => s.split(' ')[0]) }), request);

  return jsonResponse({ success: true });
};

export const onRequestOptions = optionsHandler;

export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  const db = env.ENGAGE_DB;
  const user = await getSessionUser(request, db);
  const denied = requirePermission(user, 'content.delete');
  if (denied) return denied;

  const id = (params as Record<string, string>)['id'];
  if (!id) return jsonResponse({ error: 'Content ID required' }, 400);

  const existing = await db.prepare('SELECT id, title FROM content WHERE id = ?')
    .bind(id).first<{ id: string; title: string }>();
  if (!existing) return jsonResponse({ error: 'Content not found' }, 404);

  await db.prepare('DELETE FROM content WHERE id = ?').bind(id).run();

  await logAudit(db, user!, 'content.deleted_permanently',
    JSON.stringify({ id, title: existing.title }), request);

  return jsonResponse({ success: true, id });
};
