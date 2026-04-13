/**
 * POST /api/auth/invite
 * Admin-only: creates a new user and sends welcome email.
 */
import { Env, jsonResponse, optionsHandler, getSessionUser, logAudit, sendBrevoEmail, VALID_ROLES } from '../_shared/auth';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const db = env.ENGAGE_DB;

  try {
    const caller = await getSessionUser(request, db);
    if (!caller || (caller.role !== 'admin' && caller.role !== 'superadmin')) {
      return jsonResponse({ error: 'Admin access required' }, 403);
    }

    const body = await request.json() as { username?: string; email?: string; role?: string };
    const username = body.username?.trim();
    const email = body.email?.trim().toLowerCase();
    // Only superadmin can assign the superadmin role
    const allowedInviteRoles = [...VALID_ROLES].filter(r =>
      r !== 'superadmin' || caller.role === 'superadmin'
    );
    const role = body.role && allowedInviteRoles.includes(body.role) ? body.role : 'member';

    if (!username || !email || !email.includes('@')) {
      return jsonResponse({ error: 'Username and valid email required' }, 400);
    }

    const existing = await db.prepare(
      'SELECT id FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?'
    ).bind(username.toLowerCase(), email).first();

    if (existing) {
      return jsonResponse({ error: 'Username or email already exists' }, 409);
    }

    await db.prepare(
      'INSERT INTO users (username, email, role, invited_by) VALUES (?, ?, ?, ?)'
    ).bind(username, email, role, caller.username).run();

    await sendBrevoEmail(
      env.BREVO_API_KEY,
      { email, name: username },
      "You've been invited to AmtocSoft Engage Hub",
      `
        <h2 style="color: #0f172a;">Welcome to AmtocSoft Engage Hub</h2>
        <p>Hi <b>${username}</b>,</p>
        <p><b>${caller.username}</b> has invited you to the AmtocSoft Engage Hub.</p>
        <p>To log in, visit the link below and enter your username and this email address. You'll receive a magic link to authenticate.</p>
        <a href="https://amtocbot.com/engage.html" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">
          Go to Engage Hub
        </a>
        <p style="color: #64748b; font-size: 13px;">Your username: <b>${username}</b><br/>Your email: <b>${email}</b></p>
      `,
    );

    await logAudit(db, caller, 'invite_sent', JSON.stringify({ username, email, role }), request);

    return jsonResponse({ success: true, message: `Invited ${username} (${role})` });
  } catch (e) {
    console.error('Invite error:', e);
    return jsonResponse({ error: 'Server error' }, 500);
  }
};

export const onRequestOptions = optionsHandler;
