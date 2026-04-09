// functions/api/admin/calendar/items/[id].ts
import { Env, jsonResponse, getSessionUser, optionsHandler, CalendarItemRow } from '../_shared';

export const onRequestOptions = optionsHandler;

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const db = env.ENGAGE_DB;
  const id = params.id as string;

  const user = await getSessionUser(request, db);
  if (!user || user.role !== 'admin') {
    return jsonResponse({ error: 'Admin access required' }, 403);
  }

  const existing = await db.prepare(
    'SELECT * FROM calendar_items WHERE id = ?'
  ).bind(id).first<CalendarItemRow>();

  if (!existing) {
    return jsonResponse({ error: 'Item not found' }, 404);
  }

  const body = await request.json<Partial<CalendarItemRow>>();
  const allowed = ['title', 'topic', 'level', 'type', 'day', 'slot', 'status'] as const;

  const updates: string[] = [];
  const values: unknown[] = [];

  for (const field of allowed) {
    if (body[field] !== undefined) {
      updates.push(`${field} = ?`);
      values.push(body[field]);
    }
  }

  if (updates.length === 0) {
    return jsonResponse({ error: 'No valid fields to update' }, 400);
  }

  updates.push(`updated_at = datetime('now')`);
  values.push(id);

  await db.prepare(
    `UPDATE calendar_items SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  const updated = await db.prepare(
    'SELECT * FROM calendar_items WHERE id = ?'
  ).bind(id).first<CalendarItemRow>();

  return jsonResponse({ ok: true, item: updated });
};
