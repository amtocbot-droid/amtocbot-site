// functions/api/admin/calendar/proposals/[id]/regenerate.ts
import {
  Env, jsonResponse, getSessionUser, optionsHandler,
  CalendarProposalRow, CalendarItemRow, matchTopic, TrendItem,
  WEEKLY_TARGETS, LEVEL_TARGETS,
} from '../../_shared';

export const onRequestOptions = optionsHandler;

interface RedditChild {
  data: { title: string; score: number; num_comments: number; url: string };
}
interface RedditResponse {
  data: { children: RedditChild[] };
}
interface HNItem {
  id: number; title: string; score: number; descendants?: number; url?: string;
}

const SUBREDDITS = ['MachineLearning', 'programming', 'netsec', 'artificial', 'LocalLLaMA'];
const HEADERS = { 'User-Agent': 'AmtocSoft-Planner/1.0' };

async function fetchTrends(): Promise<TrendItem[]> {
  const trends: TrendItem[] = [];

  // Reddit
  for (const sub of SUBREDDITS) {
    try {
      const resp = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=25`, { headers: HEADERS });
      if (!resp.ok) continue;
      const data = await resp.json() as RedditResponse;
      for (const child of data.data.children) {
        const p = child.data;
        if (p.score < 50) continue;
        trends.push({ source: 'reddit', sub, title: p.title, score: p.score, comments: p.num_comments, url: p.url, topic_match: matchTopic(p.title) });
      }
    } catch { /* skip */ }
  }

  // HN
  try {
    const idsResp = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    if (idsResp.ok) {
      const ids = (await idsResp.json() as number[]).slice(0, 30);
      for (let i = 0; i < ids.length; i += 10) {
        const items = await Promise.all(
          ids.slice(i, i + 10).map(async (id) => {
            try {
              const resp = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
              return resp.ok ? (await resp.json() as HNItem) : null;
            } catch { return null; }
          })
        );
        for (const item of items) {
          if (!item || item.score < 100) continue;
          trends.push({ source: 'hn', title: item.title, score: item.score, comments: item.descendants ?? 0, url: item.url ?? `https://news.ycombinator.com/item?id=${item.id}`, topic_match: matchTopic(item.title) });
        }
      }
    }
  } catch { /* skip */ }

  return trends.sort((a, b) => b.score - a.score);
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const db = env.ENGAGE_DB;
  const id = params.id as string;

  const user = await getSessionUser(request, db);
  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    return jsonResponse({ error: 'Admin access required' }, 403);
  }

  const proposal = await db.prepare(
    'SELECT * FROM calendar_proposals WHERE id = ?'
  ).bind(id).first<CalendarProposalRow>();

  if (!proposal) {
    return jsonResponse({ error: 'Proposal not found' }, 404);
  }

  // Find rejected items
  const { results: rejected } = await db.prepare(
    `SELECT * FROM calendar_items WHERE proposal_id = ? AND status = 'rejected'`
  ).bind(id).all<CalendarItemRow>();

  if (!rejected || rejected.length === 0) {
    return jsonResponse({ ok: true, message: 'No rejected items to regenerate', replaced: 0 });
  }

  // Fetch fresh trends
  const trends = await fetchTrends();
  const trendingTopics = trends.filter(t => t.topic_match);

  // Delete rejected items and create replacements
  await db.prepare(
    `DELETE FROM calendar_items WHERE proposal_id = ? AND status = 'rejected'`
  ).bind(id).run();

  let topicIdx = 0;
  const levels = Object.keys(LEVEL_TARGETS);

  for (const old of rejected) {
    const trend = trendingTopics[topicIdx % Math.max(trendingTopics.length, 1)];
    const topic = trend?.topic_match ?? 'AI Agents';
    const reason = trend
      ? `Trending on ${trend.source === 'hn' ? 'HN' : `r/${trend.sub}`}: ${trend.score} pts`
      : 'Replacement item';
    const level = levels[topicIdx % levels.length];

    await db.prepare(
      `INSERT INTO calendar_items (proposal_id, day, slot, type, title, topic, level, reasoning, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'proposed')`
    ).bind(
      id, old.day, old.slot, old.type,
      `${topic}: ${old.type === 'blog' ? 'Deep Dive' : old.type === 'video' ? 'Explainer' : old.type === 'short' ? 'Quick Tip' : 'Discussion'} — ${level}`,
      topic, level, reason,
    ).run();

    topicIdx++;
  }

  // Read back all items
  const { results: items } = await db.prepare(
    'SELECT * FROM calendar_items WHERE proposal_id = ? ORDER BY day, slot'
  ).bind(id).all<CalendarItemRow>();

  return jsonResponse({ ok: true, replaced: rejected.length, items: items || [] });
};
