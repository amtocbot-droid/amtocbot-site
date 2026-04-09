// functions/api/content/[id].ts
import { jsonResponse, optionsHandler, toBlogJson, toVideoJson } from '../_shared/auth';
import type { ContentRow } from '../_shared/auth';

interface Env {
  ENGAGE_DB: D1Database;
}

export const onRequestOptions = optionsHandler;

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const db = env.ENGAGE_DB;
  const id = params.id as string;

  const row = await db.prepare('SELECT * FROM content WHERE id = ?')
    .bind(id).first<ContentRow>();

  if (!row) {
    return jsonResponse({ error: `Content not found: ${id}` }, 404);
  }

  const item = row.type === 'blog' ? toBlogJson(row) : toVideoJson(row);

  const { results: history } = await db.prepare(
    'SELECT scraped_date as date, views, likes, comments FROM metrics_history WHERE content_id = ? ORDER BY scraped_date DESC LIMIT 90'
  ).bind(id).all();

  return jsonResponse({ item, history: history || [] });
};
