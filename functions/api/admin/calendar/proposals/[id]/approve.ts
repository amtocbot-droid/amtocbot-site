// functions/api/admin/calendar/proposals/[id]/approve.ts
import { Env, jsonResponse, getSessionUser, optionsHandler, CalendarProposalRow, CalendarItemRow } from '../../_shared';

export const onRequestOptions = optionsHandler;

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const db = env.ENGAGE_DB;
  const id = params.id as string;

  const user = await getSessionUser(request, db);
  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    return jsonResponse({ error: 'Admin access required' }, 403);
  }

  const proposal = await db.prepare(
    'SELECT * FROM calendar_proposals WHERE id = ?'
  ).bind(id).first<CalendarProposalRow>();

  if (!proposal) {
    return jsonResponse({ error: 'Proposal not found' }, 404);
  }

  // Bulk approve: set proposal status and all proposed items to approved
  await db.prepare(
    `UPDATE calendar_proposals SET status = 'approved' WHERE id = ?`
  ).bind(id).run();

  await db.prepare(
    `UPDATE calendar_items SET status = 'approved', updated_at = datetime('now') WHERE proposal_id = ? AND status = 'proposed'`
  ).bind(id).run();

  // Read back
  const updated = await db.prepare(
    'SELECT * FROM calendar_proposals WHERE id = ?'
  ).bind(id).first<CalendarProposalRow>();

  const { results: items } = await db.prepare(
    'SELECT * FROM calendar_items WHERE proposal_id = ? ORDER BY day, slot'
  ).bind(id).all<CalendarItemRow>();

  return jsonResponse({ ok: true, proposal: updated, items: items || [] });
};
