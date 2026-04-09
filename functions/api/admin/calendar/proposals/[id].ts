// functions/api/admin/calendar/proposals/[id].ts
import { Env, jsonResponse, getSessionUser, optionsHandler, CalendarProposalRow, CalendarItemRow } from '../_shared';

export const onRequestOptions = optionsHandler;

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const db = env.ENGAGE_DB;
  const id = params.id as string;

  const user = await getSessionUser(request, db);
  if (!user || user.role !== 'admin') {
    return jsonResponse({ error: 'Admin access required' }, 403);
  }

  const proposal = await db.prepare(
    'SELECT * FROM calendar_proposals WHERE id = ?'
  ).bind(id).first<CalendarProposalRow>();

  if (!proposal) {
    return jsonResponse({ error: 'Proposal not found' }, 404);
  }

  const { results: items } = await db.prepare(
    'SELECT * FROM calendar_items WHERE proposal_id = ? ORDER BY day, slot'
  ).bind(id).all<CalendarItemRow>();

  return jsonResponse({
    proposal,
    items: items || [],
  });
};
