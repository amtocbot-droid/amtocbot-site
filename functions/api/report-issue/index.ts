/**
 * POST /api/report-issue
 * Public endpoint — no authentication required.
 * Accepts bug reports, image issues, video issues, and content errors from any visitor.
 */
import { Env, getSessionUser, jsonResponse } from '../_shared/auth';

const VALID_TYPES     = ['bug', 'image_issue', 'video_issue', 'content_error', 'performance', 'other'] as const;
const VALID_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
const VALID_CONTENT_TYPES = ['video', 'image', 'blog', 'general'] as const;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const db = env.ENGAGE_DB;

  // Optionally identify logged-in user (but don't require it)
  const sessionUser = await getSessionUser(request, db).catch(() => null);

  let body: {
    report_type?: string;
    title?: string;
    description?: string;
    page_url?: string;
    content_type?: string;
    content_ref?: string;
    severity?: string;
    name?: string;
    email?: string;
  };

  try {
    body = await request.json() as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  // Validation
  const report_type = body.report_type?.trim() || 'bug';
  if (!VALID_TYPES.includes(report_type as typeof VALID_TYPES[number])) {
    return jsonResponse({ error: `Invalid report_type. Must be one of: ${VALID_TYPES.join(', ')}` }, 400);
  }

  const title = body.title?.trim();
  if (!title) return jsonResponse({ error: 'title is required' }, 400);
  if (title.length > 200) return jsonResponse({ error: 'title must be 200 characters or fewer' }, 400);

  const description = body.description?.trim();
  if (!description) return jsonResponse({ error: 'description is required' }, 400);
  if (description.length > 8000) return jsonResponse({ error: 'description must be 8000 characters or fewer' }, 400);

  const severity = body.severity?.trim() || 'medium';
  if (!VALID_SEVERITIES.includes(severity as typeof VALID_SEVERITIES[number])) {
    return jsonResponse({ error: `Invalid severity. Must be one of: ${VALID_SEVERITIES.join(', ')}` }, 400);
  }

  const content_type = body.content_type?.trim() || null;
  if (content_type && !VALID_CONTENT_TYPES.includes(content_type as typeof VALID_CONTENT_TYPES[number])) {
    return jsonResponse({ error: `Invalid content_type. Must be one of: ${VALID_CONTENT_TYPES.join(', ')}` }, 400);
  }

  const page_url    = body.page_url?.trim()?.slice(0, 2000) || null;
  const content_ref = body.content_ref?.trim()?.slice(0, 500) || null;
  const name        = body.name?.trim()?.slice(0, 100) || null;
  const email       = body.email?.trim()?.slice(0, 200) || null;

  if (email && !email.includes('@')) {
    return jsonResponse({ error: 'Invalid email address' }, 400);
  }

  const ip       = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || null;
  const user_id  = sessionUser?.user_id ?? null;
  const username = sessionUser?.username ?? null;

  await db.prepare(
    `INSERT INTO public_reports
       (report_type, title, description, page_url, content_type, content_ref, severity, name, email, user_id, username, ip_address)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    report_type, title, description, page_url, content_type, content_ref,
    severity, name, email, user_id, username, ip
  ).run();

  return jsonResponse({ success: true, message: 'Issue reported successfully. Thank you!' }, 201);
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
