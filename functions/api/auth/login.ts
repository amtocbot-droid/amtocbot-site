/**
 * POST /api/auth/login
 * Accepts {username, email}, validates against users table,
 * creates session with magic link token, sends email via Brevo.
 */
import { Env, corsHeaders, jsonResponse, getClientIP } from '../_shared/auth';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const db = env.ENGAGE_DB;

  try {
    const body = await request.json() as { username?: string; email?: string };
    const username = body.username?.trim().toLowerCase();
    const email = body.email?.trim().toLowerCase();

    if (!username || !email || !email.includes('@')) {
      return jsonResponse({ error: 'Username and valid email required' }, 400);
    }

    // Look up user by both username AND email
    const user = await db.prepare(
      'SELECT id, username, email FROM users WHERE LOWER(username) = ? AND LOWER(email) = ?'
    ).bind(username, email).first<{ id: number; username: string; email: string }>();

    if (!user) {
      return jsonResponse({ error: 'No account found. This is an invite-only system.' }, 403);
    }

    // Generate magic link token
    const token = crypto.randomUUID();
    const sessionId = crypto.randomUUID();
    const now = new Date();
    const tokenExp = new Date(now.getTime() + 15 * 60 * 1000).toISOString(); // 15 min
    const sessionExp = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days
    const ip = getClientIP(request);
    const ua = request.headers.get('User-Agent') || '';

    await db.prepare(`
      INSERT INTO sessions (id, user_id, token, token_exp, verified, ip_address, user_agent, expires_at)
      VALUES (?, ?, ?, ?, 0, ?, ?, ?)
    `).bind(sessionId, user.id, token, tokenExp, ip, ua, sessionExp).run();

    // Send magic link via Brevo transactional email
    const magicLink = `https://amtocbot.com/engage.html?token=${token}&session=${sessionId}`;

    const emailResp = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': env.BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'AmtocSoft Engage', email: 'amtocbot@gmail.com' },
        to: [{ email: user.email, name: user.username }],
        subject: 'Your AmtocSoft Engage Login Link',
        htmlContent: `
          <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
            <h2 style="color: #0f172a;">AmtocSoft Engage Hub</h2>
            <p>Hi <b>${user.username}</b>,</p>
            <p>Click the button below to log in. This link expires in 15 minutes.</p>
            <a href="${magicLink}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">
              Log In to Engage Hub
            </a>
            <p style="color: #64748b; font-size: 13px;">If you didn't request this, you can safely ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="color: #94a3b8; font-size: 12px;">AmtocSoft - AI & Software Engineering</p>
          </div>
        `,
      }),
    });

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

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { headers: corsHeaders });
};
