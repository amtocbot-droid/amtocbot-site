/**
 * GET /api/dashboard/stats
 * Role-aware summary cards for the dashboard overview.
 */
import { Env, jsonResponse, optionsHandler, requireDashboardAuth } from './_shared';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const db = env.ENGAGE_DB;
  const auth = await requireDashboardAuth(request, db, 'dashboard.view');
  if (auth instanceof Response) return auth;
  const { user } = auth;

  const [issueStats, qaStats, contentCount, userCount, recentActivity] = await Promise.all([
    db.prepare(`
      SELECT status, COUNT(*) as count FROM issues GROUP BY status
    `).all<{ status: string; count: number }>(),
    db.prepare(`
      SELECT qa_status, COUNT(*) as count FROM content WHERE qa_status IS NOT NULL GROUP BY qa_status
    `).all<{ qa_status: string; count: number }>(),
    db.prepare('SELECT COUNT(*) as total FROM content').first<{ total: number }>(),
    db.prepare('SELECT COUNT(*) as total FROM users').first<{ total: number }>(),
    db.prepare(`
      SELECT action, username, detail, created_at
      FROM audit_logs ORDER BY created_at DESC LIMIT 20
    `).all<{ action: string; username: string; detail: string | null; created_at: string }>(),
  ]);

  const issuesByStatus: Record<string, number> = {};
  for (const row of issueStats.results || []) {
    issuesByStatus[row.status] = row.count;
  }

  const contentByQA: Record<string, number> = {};
  for (const row of qaStats.results || []) {
    contentByQA[row.qa_status] = row.count;
  }

  const openIssues = (issuesByStatus.open || 0) + (issuesByStatus.in_progress || 0);
  const pendingApprovals = contentByQA.in_review || 0;

  const base = {
    openIssues,
    pendingApprovals,
    totalContent: contentCount?.total || 0,
    issuesByStatus,
    contentByQA,
    recentActivity: recentActivity.results || [],
  };

  // Add admin-only extras
  if (user.role === 'admin' || user.role === 'superadmin') {
    const [alertCount, alertRecent] = await Promise.all([
      db.prepare(`
        SELECT COUNT(*) as count FROM audit_logs
        WHERE action = 'access.denied'
          AND created_at >= datetime('now', '-24 hours')
      `).first<{ count: number }>(),
      db.prepare(`
        SELECT username, detail, ip_address, created_at
        FROM audit_logs
        WHERE action = 'access.denied'
          AND created_at >= datetime('now', '-24 hours')
        ORDER BY created_at DESC LIMIT 5
      `).all<{ username: string; detail: string; ip_address: string; created_at: string }>(),
    ]);

    const recentAlerts = (alertRecent.results || []).map(row => {
      let path = ''; let reason: 'unauthenticated' | 'unauthorized' = 'unauthorized';
      try {
        const p = JSON.parse(row.detail) as { path?: string; reason?: string };
        path = p.path || ''; reason = p.reason === 'unauthenticated' ? 'unauthenticated' : 'unauthorized';
      } catch { /* ignore */ }
      return { username: row.username, path, reason, ip: row.ip_address, created_at: row.created_at };
    });

    return jsonResponse({
      ...base,
      totalUsers: userCount?.total || 0,
      securityAlerts: { count: alertCount?.count || 0, recent: recentAlerts },
    });
  }

  // Add role-specific stats
  if (user.role === 'tester') {
    const myIssues = await db.prepare(
      'SELECT COUNT(*) as count FROM issues WHERE created_by = ?'
    ).bind(user.user_id).first<{ count: number }>();
    const assignedToMe = await db.prepare(
      'SELECT COUNT(*) as count FROM issues WHERE assigned_to = ? AND status NOT IN (\'closed\', \'wont_fix\')'
    ).bind(user.user_id).first<{ count: number }>();
    return jsonResponse({ ...base, myIssuesCount: myIssues?.count || 0, assignedToMe: assignedToMe?.count || 0 });
  }

  return jsonResponse(base);
};

export const onRequestOptions = optionsHandler;
