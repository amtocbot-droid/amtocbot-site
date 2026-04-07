/**
 * POST /api/auth/logout
 * Deletes session, clears cookie, logs audit.
 */
import { Env, corsHeaders, jsonResponse, getSessionUser, getCookie, clearSessionCookie, getClientIP, logAudit } from '../_shared/auth';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const db = env.ENGAGE_DB;

  try {
    const user = await getSessionUser(request, db);
    const sessionId = getCookie(request, 'engage_session');

    if (user && sessionId) {
      await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
      const ip = getClientIP(request);
      await logAudit(db, user.user_id, user.username, 'logout', null, ip);
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

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { headers: corsHeaders });
};
