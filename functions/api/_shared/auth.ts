/**
 * Shared helpers for Cloudflare Pages Functions.
 * Auth, CORS, email, content sync, and audit utilities.
 */

export interface SessionUser {
  user_id: number;
  username: string;
  role: string;
}

// ── Role & Permission System ──────────────────────────────────
export type Role = 'admin' | 'tester' | 'approver' | 'reviewer';
export const VALID_ROLES: readonly string[] = ['admin', 'tester', 'approver', 'reviewer'] as const;

export type Permission =
  | 'dashboard.view'
  | 'issues.create' | 'issues.update_status' | 'issues.assign' | 'issues.close' | 'issues.comment'
  | 'content.qa.update' | 'content.qa.approve' | 'content.qa.reject'
  | 'users.manage';

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin:    [], // admin bypasses the map — gets all permissions
  tester:   ['dashboard.view', 'issues.create', 'issues.update_status', 'issues.comment', 'content.qa.update'],
  approver: ['dashboard.view', 'issues.close', 'issues.comment', 'content.qa.approve', 'content.qa.reject'],
  reviewer: ['dashboard.view', 'issues.comment'],
};

export function hasPermission(user: SessionUser, perm: Permission): boolean {
  if (user.role === 'admin') return true;
  const perms = ROLE_PERMISSIONS[user.role as Role];
  return perms ? perms.includes(perm) : false;
}

export function requirePermission(user: SessionUser | null, perm: Permission): Response | null {
  if (!user) return jsonResponse({ error: 'Authentication required' }, 401);
  if (!hasPermission(user, perm)) return jsonResponse({ error: 'Insufficient permissions' }, 403);
  return null;
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
  milestones?: unknown[];
  platforms?: unknown[];
  weeklySummary?: unknown[];
  monthlySummary?: unknown[];
  tiktokCount?: number;
  platformCount?: number;
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

export interface ContentRow {
  id: string;
  type: string;
  title: string;
  date: string;
  level: string | null;
  status: string;
  topic: string | null;
  tags: string | null;
  blog_url: string | null;
  youtube_url: string | null;
  youtube_id: string | null;
  linkedin_url: string | null;
  twitter_url: string | null;
  spotify_url: string | null;
  duration: string | null;
  description: string | null;
  views: number;
  likes: number;
  comments: number;
  last_scraped: string | null;
}

/** Convert a D1 content row to the camelCase shape the frontend expects for blogs. */
export function toBlogJson(row: ContentRow) {
  return {
    id: row.id,
    date: row.date,
    title: row.title,
    level: row.level || '',
    topic: row.topic || '',
    blogUrl: row.blog_url || '',
    linkedinUrl: row.linkedin_url || '',
    twitterUrl: row.twitter_url || '',
    status: row.status,
  };
}

/** Convert a D1 content row to the camelCase shape the frontend expects for videos/shorts/podcasts. */
export function toVideoJson(row: ContentRow) {
  const obj: Record<string, unknown> = {
    id: row.id,
    type: row.type,
    title: row.title,
    date: row.date,
    level: row.level || '',
    youtubeUrl: row.youtube_url || '',
    youtubeId: row.youtube_id || '',
    duration: row.duration || '',
    views: row.views,
    likes: row.likes,
    comments: row.comments,
    lastScraped: row.last_scraped || '',
  };
  if (row.tags) {
    try { obj.tags = JSON.parse(row.tags); } catch { obj.tags = []; }
  }
  if (row.spotify_url) obj.spotifyUrl = row.spotify_url;
  if (row.description) obj.description = row.description;
  return obj;
}

/** Fetch all content from D1 and assemble into the ContentJson shape. */
export async function getContentFromD1(db: D1Database): Promise<ContentJson & Record<string, unknown>> {
  const [contentResult, milestonesResult, platformsResult, weeklySummaryResult, monthlySummaryResult, configResult] = await Promise.all([
    db.prepare('SELECT * FROM content ORDER BY date DESC').all<ContentRow>(),
    db.prepare('SELECT * FROM milestones').all(),
    db.prepare('SELECT * FROM platforms').all(),
    db.prepare("SELECT * FROM summaries WHERE period = 'week' ORDER BY id DESC").all(),
    db.prepare("SELECT * FROM summaries WHERE period = 'month' ORDER BY id DESC").all(),
    db.prepare("SELECT key, value FROM site_config WHERE key IN ('tiktok_count', 'platform_count')").all<{ key: string; value: string }>(),
  ]);

  const rows = contentResult.results || [];
  const blogs = rows.filter(r => r.type === 'blog').map(toBlogJson);
  const videos = rows.filter(r => r.type !== 'blog').map(toVideoJson);

  let tiktokCount = 0;
  let platformCount = 8;
  for (const row of configResult.results || []) {
    if (row.key === 'tiktok_count') tiktokCount = parseInt(row.value, 10) || 0;
    if (row.key === 'platform_count') platformCount = parseInt(row.value, 10) || 8;
  }

  return {
    blogs,
    videos: videos as Array<{ type?: string }>,
    milestones: milestonesResult.results || [],
    platforms: platformsResult.results || [],
    weeklySummary: (weeklySummaryResult.results || []).map(r => {
      const s = r as Record<string, unknown>;
      return { week: s.label, blogs: s.blogs, videos: s.videos, shorts: s.shorts, podcasts: s.podcasts, socialPosts: s.social_posts };
    }),
    monthlySummary: (monthlySummaryResult.results || []).map(r => {
      const s = r as Record<string, unknown>;
      return { month: s.label, blogs: s.blogs, videos: s.videos, podcasts: s.podcasts };
    }),
    tiktokCount,
    platformCount,
  };
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

/** Delete expired sessions. Called opportunistically on login. */
export async function cleanExpiredSessions(db: D1Database): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE expires_at < datetime(\'now\')').run();
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
