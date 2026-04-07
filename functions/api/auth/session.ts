/**
 * GET /api/auth/session
 * Reads session cookie, returns user info or 401.
 */
import { Env, jsonResponse, optionsHandler, getSessionUser } from '../_shared/auth';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    const user = await getSessionUser(request, env.ENGAGE_DB);
    if (!user) {
      return jsonResponse({ authenticated: false }, 200);
    }
    return jsonResponse({ authenticated: true, username: user.username, role: user.role });
  } catch (e) {
    console.error('Session check error:', e);
    return jsonResponse({ authenticated: false }, 200);
  }
};

export const onRequestOptions = optionsHandler;
