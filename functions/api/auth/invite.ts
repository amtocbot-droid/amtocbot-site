/**
 * POST /api/auth/invite
 * Admin-only: creates a new user and sends welcome email.
 */
import { Env, corsHeaders, jsonResponse, getSessionUser, getClientIP, logAudit } from '../_shared/auth';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const db = env.ENGAGE_DB;

  try {
    const caller = await getSessionUser(request, db);
    if (!caller || caller.role !== 'admin') {
      return jsonResponse({ error: 'Admin access required' }, 403);
    }

    const body = await request.json() as { username?: string; email?: string; role?: string };
    const username = body.username?.trim();
    const email = body.email?.trim().toLowerCase();
    const role = body.role === 'admin' ? 'admin' : 'member';

    if (!username || !email || !email.includes('@')) {
      return jsonResponse({ error: 'Username and valid email required' }, 400);
    }

    // Check for duplicates
    const existing = await db.prepare(
      'SELECT id FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?'
    ).bind(username.toLowerCase(), email).first();

    if (existing) {
      return jsonResponse({ error: 'Username or email already exists' }, 409);
    }

    // Insert user
    await db.prepare(
      'INSERT INTO users (username, email, role, invited_by) VALUES (?, ?, ?, ?)'
    ).bind(username, email, role, caller.username).run();

    // Send welcome email
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': env.BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'AmtocSoft Engage', email: 'amtocbot@gmail.com' },
        to: [{ email, name: username }],
        subject: 'You\'ve been invited to AmtocSoft Engage Hub',
        htmlContent: `
          <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
            <h2 style="color: #0f172a;">Welcome to AmtocSoft Engage Hub</h2>
            <p>Hi <b>${username}</b>,</p>
            <p><b>${caller.username}</b> has invited you to the AmtocSoft Engage Hub.</p>
            <p>To log in, visit the link below and enter your username and this email address. You'll receive a magic link to authenticate.</p>
            <a href="https://amtocbot.com/engage.html" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">
              Go to Engage Hub
            </a>
            <p style="color: #64748b; font-size: 13px;">Your username: <b>${username}</b><br/>Your email: <b>${email}</b></p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="color: #94a3b8; font-size: 12px;">AmtocSoft - AI & Software Engineering</p>
          </div>
        `,
      }),
    });

    // Log audit
    const ip = getClientIP(request);
    await logAudit(db, caller.user_id, caller.username, 'invite_sent', JSON.stringify({ username, email, role }), ip);

    return jsonResponse({ success: true, message: `Invited ${username} (${role})` });
  } catch (e) {
    console.error('Invite error:', e);
    return jsonResponse({ error: 'Server error' }, 500);
  }
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { headers: corsHeaders });
};
