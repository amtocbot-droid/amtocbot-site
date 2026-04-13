/**
 * GET  /api/dashboard/content  — List content with QA status, filterable by type/qa_status/date.
 * POST /api/dashboard/content  — Create a new content item.
 */
import { Env, jsonResponse, optionsHandler, requireDashboardAuth, logAudit } from '../_shared';

const CONTENT_TYPES = ['blog', 'video', 'short', 'podcast'] as const;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const db = env.ENGAGE_DB;
  const auth = await requireDashboardAuth(request, db, 'dashboard.view');
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const type = url.searchParams.get('type');
  const qaStatus = url.searchParams.get('qa_status');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 500);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  let sql = 'SELECT id, type, title, date, level, status, qa_status, qa_updated_at, topic, blog_url, youtube_url FROM content WHERE 1=1';
  const binds: unknown[] = [];

  if (type) {
    sql += ' AND type = ?';
    binds.push(type);
  }
  if (qaStatus) {
    sql += ' AND qa_status = ?';
    binds.push(qaStatus);
  }

  sql += ' ORDER BY date DESC LIMIT ? OFFSET ?';
  binds.push(limit, offset);

  const result = await db.prepare(sql).bind(...binds).all();

  return jsonResponse({
    items: result.results || [],
    meta: { limit, offset },
  });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const db = env.ENGAGE_DB;
  const auth = await requireDashboardAuth(request, db, 'content.qa.update');
  if (auth instanceof Response) return auth;
  const { user } = auth;

  const body = await request.json() as {
    title?: string;
    type?: string;
    date?: string;
    level?: string;
    topic?: string;
    body_draft?: string;
    external_url?: string;
    reviewer_instructions?: string;
  };

  if (!body.title || !body.title.trim()) {
    return jsonResponse({ error: 'title is required' }, 400);
  }
  if (!body.type || !(CONTENT_TYPES as readonly string[]).includes(body.type)) {
    return jsonResponse({ error: `type must be one of: ${CONTENT_TYPES.join(', ')}` }, 400);
  }
  if (!body.date || !DATE_RE.test(body.date)) {
    return jsonResponse({ error: 'date is required and must be YYYY-MM-DD format' }, 400);
  }

  const id = `dc-${body.date.replace(/-/g, '')}-${Math.random().toString(36).slice(2, 7)}`;

  await db.prepare(
    `INSERT INTO content (id, type, title, date, level, topic, description, external_url, reviewer_instructions, status, qa_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft', 'draft')`
  ).bind(
    id,
    body.type,
    body.title.trim(),
    body.date,
    body.level ?? null,
    body.topic ?? null,
    body.body_draft ?? null,
    body.external_url ?? null,
    body.reviewer_instructions ?? null,
  ).run();

  await logAudit(db, user, 'content.created', JSON.stringify({ id, title: body.title, type: body.type }), request);

  return jsonResponse({ success: true, id }, 201);
};

export const onRequestOptions = optionsHandler;
