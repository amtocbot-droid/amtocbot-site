// functions/api/learn/[language]/[slug]/recordings.ts
// GET  /api/learn/:language/:slug/recordings?level=beginner  — list recordings for a lesson
// POST /api/learn/:language/:slug/recordings                 — upload new recording

import {
  Env,
  jsonResponse,
  optionsHandler,
} from '../../../_shared/auth';

export const onRequestOptions = optionsHandler;

const VALID_LANGUAGES = new Set(['html', 'linux', 'csharp', 'java']);
const VALID_LEVELS    = new Set(['beginner', 'intermediate', 'advanced']);
const MAX_BYTES       = 50 * 1024 * 1024; // 50 MB

// ── GET — list recordings for a lesson ───────────────────────────────────────

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { language, slug } = context.params as { language: string; slug: string };
  const level = new URL(context.request.url).searchParams.get('level') ?? 'beginner';

  if (!VALID_LANGUAGES.has(language)) return jsonResponse({ error: 'Invalid language' }, 400);
  if (!VALID_LEVELS.has(level)) return jsonResponse({ error: 'Invalid level' }, 400);
  if (!slug || slug.length > 120) return jsonResponse({ error: 'Invalid slug' }, 400);

  const rows = await context.env.ENGAGE_DB.prepare(`
    SELECT id, display_name, public_url, duration_ms, created_at
    FROM tutorial_recordings
    WHERE language = ? AND level = ? AND slug = ? AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 50
  `).bind(language, level, slug).all();

  return jsonResponse({ recordings: rows.results ?? [] });
};

// ── POST — receive multipart form data (video + metadata) ────────────────────

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { language, slug } = context.params as { language: string; slug: string };

  const contentLength = parseInt(context.request.headers.get('content-length') ?? '0', 10);
  if (contentLength > MAX_BYTES) return jsonResponse({ error: 'Upload exceeds 50 MB limit' }, 413);

  let formData: FormData;
  try {
    formData = await context.request.formData();
  } catch {
    return jsonResponse({ error: 'Invalid multipart form data' }, 400);
  }

  const displayName = (formData.get('displayName') as string | null)?.trim() ?? '';
  const level       = (formData.get('level')       as string | null)?.trim() ?? '';
  const videoFile   = formData.get('video') as File | null;

  if (!VALID_LANGUAGES.has(language)) return jsonResponse({ error: 'Invalid language' }, 400);
  if (!VALID_LEVELS.has(level)) return jsonResponse({ error: 'Invalid level' }, 400);
  if (!slug || slug.length > 120) return jsonResponse({ error: 'Invalid slug' }, 400);
  if (!displayName || displayName.length > 50) return jsonResponse({ error: 'display_name must be 1–50 characters' }, 400);
  if (!videoFile) return jsonResponse({ error: 'Missing video field' }, 400);

  const contentType = videoFile.type || '';
  if (!['video/webm', 'video/mp4'].includes(contentType)) {
    return jsonResponse({ error: 'Video must be video/webm or video/mp4' }, 400);
  }
  if (videoFile.size > MAX_BYTES) return jsonResponse({ error: 'Upload exceeds 50 MB limit' }, 413);

  const id     = crypto.randomUUID();
  const ext    = contentType === 'video/mp4' ? 'mp4' : 'webm';
  const r2Key  = `learn/${language}/${level}/${slug}/${id}.${ext}`;

  const videoBuffer = await videoFile.arrayBuffer();

  try {
    await context.env.TUTORIAL_MEDIA.put(r2Key, videoBuffer, {
      httpMetadata: { contentType },
    });
  } catch (err) {
    console.error('R2 put failed', err);
    return jsonResponse({ error: 'Storage error — please try again' }, 502);
  }

  const baseUrl   = (context.env.TUTORIAL_MEDIA_BASE_URL ?? '').replace(/\/$/, '');
  const publicUrl = `${baseUrl}/${r2Key}`;

  const durationMs = parseInt((formData.get('durationMs') as string | null) ?? '0', 10) || null;

  try {
    await context.env.ENGAGE_DB.prepare(`
      INSERT INTO tutorial_recordings (id, language, level, slug, display_name, r2_key, public_url, duration_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, language, level, slug, displayName, r2Key, publicUrl, durationMs).run();
  } catch (err) {
    console.error('D1 insert failed', err);
    await context.env.TUTORIAL_MEDIA.delete(r2Key).catch(() => {});
    return jsonResponse({ error: 'Database error — please try again' }, 502);
  }

  return jsonResponse({
    success: true,
    recording: { id, public_url: publicUrl, display_name: displayName },
  }, 201);
};
