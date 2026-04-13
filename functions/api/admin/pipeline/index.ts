// GET  /api/admin/pipeline — list tracked + untracked podcast/short items
// POST /api/admin/pipeline — add item to pipeline or update stage
import { Env, getSessionUser, requirePermission, jsonResponse, logAudit, optionsHandler } from '../../_shared/auth';

const VALID_STAGES = ['scripted', 'narrated', 'uploaded', 'published'] as const;
type Stage = typeof VALID_STAGES[number];

export const onRequestOptions = optionsHandler;

// ── GET ────────────────────────────────────────────────────────
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const db = env.ENGAGE_DB;

  const user = await getSessionUser(request, db);
  const denied = requirePermission(user, 'users.manage');
  if (denied) return denied;

  const [trackedResult, untrackedResult] = await Promise.all([
    db.prepare(`
      SELECT pp.*, c.title, c.type, c.date
      FROM production_pipeline pp
      JOIN content c ON pp.content_id = c.id
      ORDER BY pp.created_at DESC
    `).all(),
    db.prepare(`
      SELECT id, title, type, date
      FROM content
      WHERE type IN ('podcast', 'short')
        AND id NOT IN (SELECT content_id FROM production_pipeline)
      ORDER BY date DESC
      LIMIT 50
    `).all(),
  ]);

  return jsonResponse({
    tracked: trackedResult.results || [],
    untracked: untrackedResult.results || [],
  });
};

// ── POST ───────────────────────────────────────────────────────
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const db = env.ENGAGE_DB;

  const user = await getSessionUser(request, db);
  const denied = requirePermission(user, 'users.manage');
  if (denied) return denied;

  const body = await request.json<{
    action: 'add' | 'update';
    content_id: string;
    stage?: string;
    notes?: string;
  }>();

  const { action, content_id } = body || {};

  if (!action || !content_id) {
    return jsonResponse({ error: 'Missing required fields: action, content_id' }, 400);
  }

  if (!['add', 'update'].includes(action)) {
    return jsonResponse({ error: 'Invalid action. Must be add or update' }, 400);
  }

  // ── Add ───────────────────────────────────────────────────────
  if (action === 'add') {
    await db.prepare(`
      INSERT INTO production_pipeline (content_id, stage, stage_updated_by)
      VALUES (?, 'scripted', ?)
    `).bind(content_id, user!.user_id).run();

    await logAudit(db, user!, 'pipeline.add', `Added ${content_id} to production pipeline`, request);

    return jsonResponse({ ok: true, action: 'add', content_id });
  }

  // ── Update ────────────────────────────────────────────────────
  const { stage, notes } = body;

  if (!stage) {
    return jsonResponse({ error: 'Missing required field: stage' }, 400);
  }

  if (!VALID_STAGES.includes(stage as Stage)) {
    return jsonResponse(
      { error: `Invalid stage. Must be one of: ${VALID_STAGES.join(', ')}` },
      400,
    );
  }

  await db.prepare(`
    UPDATE production_pipeline
    SET stage            = ?,
        stage_updated_at = datetime('now'),
        stage_updated_by = ?,
        notes            = COALESCE(?, notes)
    WHERE content_id = ?
  `).bind(stage, user!.user_id, notes ?? null, content_id).run();

  await logAudit(db, user!, 'pipeline.update', `${content_id} → stage: ${stage}`, request);

  return jsonResponse({ ok: true, action: 'update', content_id, stage });
};
