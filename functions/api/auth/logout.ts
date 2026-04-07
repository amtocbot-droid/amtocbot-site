/**
 * POST /api/auth/logout
 * Deletes session, clears cookie, logs audit.
 */
import { Env, jsonResponse, optionsHandler, getSessionUser, getCookie, clearSessionCookie, logAudit } from '../_shared/auth';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const db = env.ENGAGE_DB;

  try {
    const sessionId = getCookie(request, 'engage_session');
    if (sessionId) {
      const user = await getSessionUser(request, db);
      if (user) {
        await Promise.all([
          db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run(),
          logAudit(db, user, 'logout', null, request),
        ]);
      } else {
        await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
      }
    }

    return jsonResponse(
      { success: true },
      200,
      { 'Set-Cookie': clearSessionCookie() },
    );
  } catch (e) {
    console.error('Logout error:', e);
    return jsonResponse({ error: 'Server error' }, 500);
  }
};

export const onRequestOptions = optionsHandler;
