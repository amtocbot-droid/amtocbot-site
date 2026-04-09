// functions/api/content/index.ts
import { jsonResponse, optionsHandler, getContentFromD1 } from '../_shared/auth';

interface Env {
  ENGAGE_DB: D1Database;
}

export const onRequestOptions = optionsHandler;

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;
  const db = env.ENGAGE_DB;

  try {
    const data = await getContentFromD1(db);
    return jsonResponse(data);
  } catch (e) {
    return jsonResponse({ error: 'Failed to load content', detail: String(e) }, 500);
  }
};
