/**
 * Shared auth helper for Cloudflare Pages Functions.
 * Reads the engage_session cookie and validates against D1.
 */

export interface SessionUser {
  user_id: number;
  username: string;
  role: string;
}

export interface Env {
  BREVO_API_KEY: string;
  ENGAGE_DB: D1Database;
  METRICS_KV?: KVNamespace;
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true',
};

export function getCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get('Cookie') || '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function setSessionCookie(sessionId: string, maxAge = 604800): string {
  return `engage_session=${sessionId}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

export function clearSessionCookie(): string {
  return 'engage_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0';
}

export async function getSessionUser(request: Request, db: D1Database): Promise<SessionUser | null> {
  const sessionId = getCookie(request, 'engage_session');
  if (!sessionId) return null;

  const row = await db.prepare(`
    SELECT s.user_id, u.username, u.role
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = ? AND s.verified = 1 AND s.expires_at > datetime('now')
  `).bind(sessionId).first<{ user_id: number; username: string; role: string }>();

  return row || null;
}

export function jsonResponse(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders, ...extraHeaders },
  });
}

export function getClientIP(request: Request): string {
  return request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
}

export async function logAudit(
  db: D1Database,
  userId: number,
  username: string,
  action: string,
  detail: string | null,
  ipAddress: string,
): Promise<void> {
  await db.prepare(
    'INSERT INTO audit_logs (user_id, username, action, detail, ip_address) VALUES (?, ?, ?, ?, ?)'
  ).bind(userId, username, action, detail, ipAddress).run();
}
