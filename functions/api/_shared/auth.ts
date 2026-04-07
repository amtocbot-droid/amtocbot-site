/**
 * Shared helpers for Cloudflare Pages Functions.
 * Auth, CORS, email, content sync, and audit utilities.
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
  GITHUB_TOKEN?: string;
}

export interface ContentJson {
  blogs?: unknown[];
  videos?: Array<{ type?: string }>;
  tiktokCount?: number;
  platformCount?: number;
  platforms?: unknown[];
}

export interface SyncData {
  lastSync: string;
  blogs: number;
  videos: number;
  shorts: number;
  podcasts: number;
  tiktok: number;
  platforms: number;
}

const STAT_KEYS = ['blogs', 'videos', 'shorts', 'podcasts', 'tiktok', 'platforms'] as const;

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const optionsHandler: PagesFunction = async () =>
  new Response(null, { headers: corsHeaders });

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
  user: SessionUser,
  action: string,
  detail: string | null,
  request: Request,
): Promise<void> {
  const ip = getClientIP(request);
  await db.prepare(
    'INSERT INTO audit_logs (user_id, username, action, detail, ip_address) VALUES (?, ?, ?, ?, ?)'
  ).bind(user.user_id, user.username, action, detail, ip).run();
}

/** Fetch content.json from GitHub with cache-busting. */
export async function fetchContentFromGitHub(githubToken?: string): Promise<ContentJson> {
  const url = `https://raw.githubusercontent.com/amtocbot-droid/amtocbot-site/main/public/assets/data/content.json?t=${Date.now()}`;
  const headers: Record<string, string> = { 'Accept': 'application/json', 'Cache-Control': 'no-cache' };
  if (githubToken) headers['Authorization'] = `token ${githubToken}`;

  const resp = await fetch(url, { headers });
  if (!resp.ok) throw new Error(`GitHub fetch failed: ${resp.status}`);
  return resp.json() as Promise<ContentJson>;
}

/** Count content items from parsed content.json in a single pass. */
export function countContent(content: ContentJson): Omit<SyncData, 'lastSync'> {
  const allVideos = content.videos || [];
  let videos = 0, shorts = 0, podcasts = 0;
  for (const v of allVideos) {
    if (v.type === 'video') videos++;
    else if (v.type === 'short') shorts++;
    else if (v.type === 'podcast') podcasts++;
  }
  return {
    blogs: (content.blogs || []).length,
    videos,
    shorts,
    podcasts,
    tiktok: content.tiktokCount ?? 0,
    platforms: content.platformCount ?? 8,
  };
}

/** Apply D1 site_config overrides to a stats object. Mutates in place. */
export async function applyConfigOverrides(db: D1Database, stats: Record<string, unknown>): Promise<void> {
  const { results } = await db.prepare(
    `SELECT key, value FROM site_config WHERE key IN ('blogs','videos','shorts','podcasts','tiktok','platforms')`
  ).all();
  for (const row of (results || []) as Array<{ key: string; value: string }>) {
    const parsed = parseInt(row.value, 10);
    if (!isNaN(parsed)) stats[row.key] = parsed;
  }
}

/** Send a transactional email via Brevo. */
export async function sendBrevoEmail(
  apiKey: string,
  to: { email: string; name: string },
  subject: string,
  bodyHtml: string,
): Promise<Response> {
  return fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { name: 'AmtocSoft Engage', email: 'amtocbot@gmail.com' },
      to: [to],
      subject,
      htmlContent: `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          ${bodyHtml}
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="color: #94a3b8; font-size: 12px;">AmtocSoft - AI &amp; Software Engineering</p>
        </div>
      `,
    }),
  });
}
