/**
 * PATCH /api/dashboard/public-reports/:id
 * Update status, assignment, or resolution of a public report.
 * Requires: issues.update_status (status/assign) or issues.close (resolve/dismiss)
 */
import { Env, jsonResponse, optionsHandler, requireDashboardAuth, logAudit } from '../_shared';

const VALID_STATUSES = ['new', 'acknowledged', 'in_progress', 'resolved', 'dismissed'] as const;

export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) => {
  const db   = env.ENGAGE_DB;
  const auth = await requireDashboardAuth(request, db, 'issues.update_status');
  if (auth instanceof Response) return auth;
  const { user } = auth;

  const id = parseInt(params.id as string, 10);
  if (isNaN(id)) return jsonResponse({ error: 'Invalid id' }, 400);

  const existing = await db.prepare('SELECT id, status FROM public_reports WHERE id = ?')
    .bind(id).first<{ id: number; status: string }>();
  if (!existing) return jsonResponse({ error: 'Report not found' }, 404);

  const body = await request.json() as {
    status?: string;
    assigned_to?: number | null;
    resolution?: string;
  };

  const sets: string[] = ["updated_at = datetime('now')"];
  const binds: unknown[] = [];

  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status as typeof VALID_STATUSES[number])) {
      return jsonResponse({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, 400);
    }
    sets.push('status = ?');
    binds.push(body.status);
    if (body.status === 'resolved' || body.status === 'dismissed') {
      sets.push("resolved_at = datetime('now')");
    }
  }

  if ('assigned_to' in body) {
    sets.push('assigned_to = ?');
    binds.push(body.assigned_to ?? null);
  }

  if (body.resolution !== undefined) {
    sets.push('resolution = ?');
    binds.push(body.resolution?.trim()?.slice(0, 2000) || null);
  }

  binds.push(id);
  await db.prepare(`UPDATE public_reports SET ${sets.join(', ')} WHERE id = ?`).bind(...binds).run();

  await logAudit(db, user, 'public_report.updated',
    JSON.stringify({ report_id: id, changes: body }), request);

  return jsonResponse({ success: true, id });
};

export const onRequestOptions = optionsHandler;
