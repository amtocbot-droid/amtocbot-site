/**
 * POST /api/auth/login
 * Accepts {username, email}, validates against users table,
 * creates session with magic link token, sends email via Brevo.
 */
import { Env, jsonResponse, optionsHandler, getClientIP, sendBrevoEmail, cleanExpiredSessions } from '../_shared/auth';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const db = env.ENGAGE_DB;

  try {
    cleanExpiredSessions(db).catch(() => {}); // fire-and-forget cleanup

    const body = await request.json() as { username?: string; email?: string };
    const username = body.username?.trim().toLowerCase();
    const email = body.email?.trim().toLowerCase();

    if (!username || !email || !email.includes('@')) {
      return jsonResponse({ error: 'Username and valid email required' }, 400);
    }

    const user = await db.prepare(
      'SELECT id, username, email FROM users WHERE LOWER(username) = ? AND LOWER(email) = ?'
    ).bind(username, email).first<{ id: number; username: string; email: string }>();

    if (!user) {
      return jsonResponse({ error: 'No account found. This is an invite-only system.' }, 403);
    }

    const token = crypto.randomUUID();
    const sessionId = crypto.randomUUID();
    const now = new Date();
    const tokenExp = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
    const sessionExp = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const ip = getClientIP(request);
    const ua = request.headers.get('User-Agent') || '';

    await db.prepare(`
      INSERT INTO sessions (id, user_id, token, token_exp, verified, ip_address, user_agent, expires_at)
      VALUES (?, ?, ?, ?, 0, ?, ?, ?)
    `).bind(sessionId, user.id, token, tokenExp, ip, ua, sessionExp).run();

    const magicLink = `https://amtocbot.com/engage.html?token=${token}&session=${sessionId}`;

    const emailResp = await sendBrevoEmail(
      env.BREVO_API_KEY,
      { email: user.email, name: user.username },
      'Your AmtocSoft Engage Login Link',
      `
        <h2 style="color: #0f172a;">AmtocSoft Engage Hub</h2>
        <p>Hi <b>${user.username}</b>,</p>
        <p>Click the button below to log in. This link expires in 15 minutes.</p>
        <a href="${magicLink}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">
          Log In to Engage Hub
        </a>
        <p style="color: #64748b; font-size: 13px;">If you didn't request this, you can safely ignore this email.</p>
      `,
    );

    if (!emailResp.ok) {
      const errBody = await emailResp.text();
      console.error('Brevo email error:', errBody);
      return jsonResponse({ error: 'Failed to send magic link email' }, 500);
    }

    return jsonResponse({ success: true, message: 'Check your email for a magic link' });
  } catch (e) {
    console.error('Login error:', e);
    return jsonResponse({ error: 'Server error' }, 500);
  }
};

export const onRequestOptions = optionsHandler;
