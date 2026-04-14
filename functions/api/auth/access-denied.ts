/**
 * POST /api/auth/access-denied
 * Logs unauthorized route access attempts. No auth required.
 * Rate-limited: max 10 writes per IP per minute (in-memory).
 */
import { Env, jsonResponse, optionsHandler, getClientIP, getSessionUser } from '../_shared/auth';

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  if (entry.count >= 10) return true;
  entry.count++;
  return false;
}

interface AccessDeniedBody {
  path?: string;
  reason?: 'unauthenticated' | 'unauthorized';
  role?: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const ip = getClientIP(request);
  if (isRateLimited(ip)) return jsonResponse({ ok: true });

  let body: AccessDeniedBody = {};
  try { body = await request.json() as AccessDeniedBody; } catch { return jsonResponse({ ok: true }); }

  const path = String(body.path || '').slice(0, 200);
  const reason = body.reason === 'unauthenticated' ? 'unauthenticated' : 'unauthorized';

  const db = env.ENGAGE_DB;
  const sessionUser = await getSessionUser(request, db);

  const detail = JSON.stringify({ path, reason, role: body.role ?? null, ip });
  const userId = sessionUser?.user_id ?? 0;
  const username = sessionUser?.username ?? 'anonymous';

  try {
    await db.prepare(
      'INSERT INTO audit_logs (user_id, username, action, detail, ip_address) VALUES (?, ?, ?, ?, ?)'
    ).bind(userId, username, 'access.denied', detail, ip).run();
  } catch { /* swallow */ }

  return jsonResponse({ ok: true });
};

export const onRequestOptions = optionsHandler;
