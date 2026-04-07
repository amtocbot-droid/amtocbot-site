/**
 * POST /api/auth/verify
 * Accepts {token, session_id}, validates token, activates session, sets cookie.
 */
import { Env, jsonResponse, optionsHandler, setSessionCookie, logAudit } from '../_shared/auth';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const db = env.ENGAGE_DB;

  try {
    const body = await request.json() as { token?: string; session_id?: string };
    const { token, session_id } = body;

    if (!token || !session_id) {
      return jsonResponse({ error: 'Token and session_id required' }, 400);
    }

    const session = await db.prepare(`
      SELECT s.id, s.user_id, s.token, s.token_exp, s.verified, u.username, u.role
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ? AND s.token = ? AND s.verified = 0
    `).bind(session_id, token).first<{
      id: string; user_id: number; token: string; token_exp: string;
      verified: number; username: string; role: string;
    }>();

    if (!session) {
      return jsonResponse({ error: 'Invalid or expired magic link' }, 401);
    }

    if (new Date(session.token_exp) < new Date()) {
      return jsonResponse({ error: 'Magic link has expired. Please request a new one.' }, 401);
    }

    await db.prepare(
      "UPDATE sessions SET verified = 1, token = NULL, token_exp = NULL WHERE id = ?"
    ).bind(session_id).run();

    // logAudit expects SessionUser but we only have session data here — construct inline
    const sessionUser = { user_id: session.user_id, username: session.username, role: session.role };
    await logAudit(db, sessionUser, 'login', null, request);

    return jsonResponse(
      { success: true, username: session.username, role: session.role },
      200,
      { 'Set-Cookie': setSessionCookie(session_id) },
    );
  } catch (e) {
    console.error('Verify error:', e);
    return jsonResponse({ error: 'Server error' }, 500);
  }
};

export const onRequestOptions = optionsHandler;
