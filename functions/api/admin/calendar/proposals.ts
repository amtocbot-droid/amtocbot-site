// functions/api/admin/calendar/proposals.ts
import { Env, jsonResponse, getSessionUser, optionsHandler, CalendarProposalRow } from './_shared';

export const onRequestOptions = optionsHandler;

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const db = env.ENGAGE_DB;

  const user = await getSessionUser(request, db);
  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    return jsonResponse({ error: 'Admin access required' }, 403);
  }

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get('status');
  const limit = parseInt(url.searchParams.get('limit') || '10', 10);

  let query = 'SELECT * FROM calendar_proposals';
  const binds: unknown[] = [];

  if (statusFilter) {
    query += ' WHERE status = ?';
    binds.push(statusFilter);
  }
  query += ' ORDER BY week_start DESC LIMIT ?';
  binds.push(limit);

  const stmt = db.prepare(query);
  const { results: proposals } = binds.length === 2
    ? await stmt.bind(binds[0], binds[1]).all<CalendarProposalRow>()
    : await stmt.bind(binds[0]).all<CalendarProposalRow>();

  // Get item counts per proposal
  const withCounts = await Promise.all(
    (proposals || []).map(async (p) => {
      const { results: counts } = await db.prepare(
        `SELECT status, COUNT(*) as count FROM calendar_items WHERE proposal_id = ? GROUP BY status`
      ).bind(p.id).all<{ status: string; count: number }>();

      return {
        ...p,
        item_counts: Object.fromEntries((counts || []).map(c => [c.status, c.count])),
      };
    })
  );

  return jsonResponse({ proposals: withCounts });
};
