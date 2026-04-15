// functions/api/admin/pipeline/index.ts
// GET  /api/admin/pipeline — list tracked + untracked items
// POST /api/admin/pipeline — add item to pipeline or update stage/output

import { Env, getSessionUser, requirePermission, jsonResponse, logAudit, optionsHandler } from '../../_shared/auth';

const VALID_STAGES = [
  'scripted', 'narrating', 'narrated', 'assembling', 'assembled',
  'uploading', 'uploaded', 'published',
] as const;
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
    content_id?: string;
    // For "add" of a pre-upload item (no content row yet):
    item_id?: string;        // e.g. "116-short-1"
    item_type?: string;      // "short" | "podcast"
    title?: string;
    stage?: string;
    notes?: string;
    script_file?: string;
    audio_dir?: string;
    output_file?: string;
    youtube_url?: string;
  }>();

  const { action } = body || {};

  if (!action) {
    return jsonResponse({ error: 'action required' }, 400);
  }

  if (action === 'add') {
    // content_id may be blank for pre-upload items — use item_id as synthetic key
    const cid = body.content_id || body.item_id;
    if (!cid) return jsonResponse({ error: 'content_id or item_id required' }, 400);

    // For pre-upload items without a content row, insert a synthetic content row first
    if (!body.content_id && body.item_id) {
      await db.prepare(`
        INSERT OR IGNORE INTO content (id, type, title, date, status)
        VALUES (?, ?, ?, date('now'), 'Draft')
      `).bind(cid, body.item_type || 'short', body.title || cid).run();
    }

    await db.prepare(`
      INSERT OR IGNORE INTO production_pipeline
        (content_id, stage, item_type, script_file, notes)
      VALUES (?, 'scripted', ?, ?, ?)
    `).bind(cid, body.item_type || 'short', body.script_file || null, body.notes || null).run();

    await logAudit(db, user!, 'pipeline.add', cid, request);
    return jsonResponse({ success: true });
  }

  if (action === 'update') {
    const cid = body.content_id || body.item_id;
    if (!cid) return jsonResponse({ error: 'content_id or item_id required' }, 400);

    const stage = body.stage;
    if (stage && !VALID_STAGES.includes(stage as Stage)) {
      return jsonResponse({ error: `invalid stage: ${stage}` }, 400);
    }

    // Build dynamic SET clause for provided fields
    const sets: string[] = ['stage_updated_at = datetime(\'now\')', 'stage_updated_by = ?'];
    const vals: unknown[] = [user!.user_id];

    if (stage) { sets.push('stage = ?'); vals.push(stage); }
    if (body.notes !== undefined) { sets.push('notes = ?'); vals.push(body.notes); }
    if (body.script_file !== undefined) { sets.push('script_file = ?'); vals.push(body.script_file); }
    if (body.audio_dir !== undefined) { sets.push('audio_dir = ?'); vals.push(body.audio_dir); }
    if (body.output_file !== undefined) { sets.push('output_file = ?'); vals.push(body.output_file); }
    if (body.youtube_url !== undefined) { sets.push('youtube_url = ?'); vals.push(body.youtube_url); }

    vals.push(cid);
    await db.prepare(
      `UPDATE production_pipeline SET ${sets.join(', ')} WHERE content_id = ?`
    ).bind(...vals).run();

    await logAudit(db, user!, 'pipeline.update', `${cid} → ${stage ?? 'fields'}`, request);
    return jsonResponse({ success: true });
  }

  return jsonResponse({ error: `unknown action: ${action}` }, 400);
};
