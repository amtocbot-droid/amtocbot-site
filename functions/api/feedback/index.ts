/**
 * POST /api/feedback
 * Public endpoint — no authentication required.
 * Accepts general feedback, suggestions, and improvement ideas from any visitor.
 */
import { Env, getSessionUser, jsonResponse } from '../_shared/auth';

const VALID_CATEGORIES = ['general', 'suggestion', 'improvement', 'ux', 'content', 'other'] as const;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const db = env.ENGAGE_DB;

  // Optionally identify logged-in user (but don't require it)
  const sessionUser = await getSessionUser(request, db).catch(() => null);

  let body: {
    category?: string;
    subject?: string;
    message?: string;
    name?: string;
    email?: string;
  };

  try {
    body = await request.json() as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  // Validation
  const category = body.category?.trim() || 'general';
  if (!VALID_CATEGORIES.includes(category as typeof VALID_CATEGORIES[number])) {
    return jsonResponse({ error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` }, 400);
  }

  const subject = body.subject?.trim();
  if (!subject) return jsonResponse({ error: 'subject is required' }, 400);
  if (subject.length > 200) return jsonResponse({ error: 'subject must be 200 characters or fewer' }, 400);

  const message = body.message?.trim();
  if (!message) return jsonResponse({ error: 'message is required' }, 400);
  if (message.length > 5000) return jsonResponse({ error: 'message must be 5000 characters or fewer' }, 400);

  const name = body.name?.trim()?.slice(0, 100) || null;
  const email = body.email?.trim()?.slice(0, 200) || null;

  // Basic email format check if provided
  if (email && !email.includes('@')) {
    return jsonResponse({ error: 'Invalid email address' }, 400);
  }

  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || null;

  const user_id = sessionUser?.user_id ?? null;
  const username = sessionUser?.username ?? null;

  await db.prepare(
    `INSERT INTO public_feedback (category, subject, message, name, email, user_id, username, ip_address)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(category, subject, message, name, email, user_id, username, ip).run();

  return jsonResponse({ success: true, message: 'Thank you for your feedback!' }, 201);
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
};
