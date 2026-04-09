// functions/api/admin/calendar/generate.ts
import {
  Env, jsonResponse, optionsHandler, requireCalendarAuth, matchTopic,
  getNextMonday, getWeekDays, TrendItem, TopicPerformance, FormatPerformance,
  WEEKLY_TARGETS, LEVEL_TARGETS, CalendarProposalRow, CalendarItemRow,
} from './_shared';

export const onRequestOptions = optionsHandler;

// ── Trend Scraping ──────────────────────────────────────────

interface RedditChild {
  data: { title: string; score: number; num_comments: number; url: string };
}
interface RedditResponse {
  data: { children: RedditChild[] };
}

interface HNItem {
  id: number;
  title: string;
  score: number;
  descendants?: number;
  url?: string;
}

const SUBREDDITS = ['MachineLearning', 'programming', 'netsec', 'artificial', 'LocalLLaMA'];
const HEADERS = { 'User-Agent': 'AmtocSoft-Planner/1.0' };

async function fetchRedditTrends(): Promise<TrendItem[]> {
  const trends: TrendItem[] = [];
  for (const sub of SUBREDDITS) {
    try {
      const resp = await fetch(
        `https://www.reddit.com/r/${sub}/hot.json?limit=25`,
        { headers: HEADERS }
      );
      if (!resp.ok) continue;
      const data = await resp.json() as RedditResponse;
      for (const child of data.data.children) {
        const p = child.data;
        if (p.score < 50) continue;
        trends.push({
          source: 'reddit',
          sub,
          title: p.title,
          score: p.score,
          comments: p.num_comments,
          url: p.url,
          topic_match: matchTopic(p.title),
        });
      }
    } catch {
      // Skip failed subreddit, non-fatal
    }
  }
  return trends;
}

async function fetchHNTrends(): Promise<TrendItem[]> {
  const trends: TrendItem[] = [];
  try {
    const idsResp = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    if (!idsResp.ok) return trends;
    const ids = (await idsResp.json() as number[]).slice(0, 30);

    // Fetch in parallel batches of 10
    for (let i = 0; i < ids.length; i += 10) {
      const batch = ids.slice(i, i + 10);
      const items = await Promise.all(
        batch.map(async (id) => {
          try {
            const resp = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
            return resp.ok ? (await resp.json() as HNItem) : null;
          } catch {
            return null;
          }
        })
      );
      for (const item of items) {
        if (!item || item.score < 100) continue;
        trends.push({
          source: 'hn',
          title: item.title,
          score: item.score,
          comments: item.descendants ?? 0,
          url: item.url ?? `https://news.ycombinator.com/item?id=${item.id}`,
          topic_match: matchTopic(item.title),
        });
      }
    }
  } catch {
    // HN fetch failed, non-fatal
  }
  return trends;
}

// ── D1 Analysis ─────────────────────────────────────────────

interface AnalysisResult {
  topicPerf: TopicPerformance[];
  formatPerf: FormatPerformance[];
  levelDist: { level: string; count: number }[];
  recencyGaps: string[];
  growthLeaders: { content_id: string; growth: number }[];
}

async function analyzeContent(db: D1Database): Promise<AnalysisResult> {
  const [topicRes, formatRes, levelRes, gapRes, growthRes] = await Promise.all([
    db.prepare(
      `SELECT topic, AVG(views) as avg_views, COUNT(*) as count
       FROM content WHERE topic IS NOT NULL
       GROUP BY topic ORDER BY avg_views DESC`
    ).all<TopicPerformance>(),

    db.prepare(
      `SELECT type, AVG(views) as avg_views FROM content GROUP BY type`
    ).all<FormatPerformance>(),

    db.prepare(
      `SELECT level, COUNT(*) as count FROM content WHERE level IS NOT NULL GROUP BY level`
    ).all<{ level: string; count: number }>(),

    db.prepare(
      `SELECT DISTINCT topic FROM content
       WHERE topic IS NOT NULL AND date < date('now', '-14 days')
       AND topic NOT IN (SELECT DISTINCT topic FROM content WHERE date >= date('now', '-14 days') AND topic IS NOT NULL)`
    ).all<{ topic: string }>(),

    db.prepare(
      `SELECT content_id, MAX(views) - MIN(views) as growth
       FROM metrics_history WHERE scraped_date > date('now', '-14 days')
       GROUP BY content_id ORDER BY growth DESC LIMIT 10`
    ).all<{ content_id: string; growth: number }>(),
  ]);

  return {
    topicPerf: topicRes.results || [],
    formatPerf: formatRes.results || [],
    levelDist: levelRes.results || [],
    recencyGaps: (gapRes.results || []).map(r => r.topic),
    growthLeaders: growthRes.results || [],
  };
}

// ── Proposal Generation ─────────────────────────────────────

function generateItems(
  weekDays: string[],
  analysis: AnalysisResult,
  trends: TrendItem[],
): Omit<CalendarItemRow, 'id' | 'proposal_id' | 'content_id' | 'created_at' | 'updated_at'>[] {
  const items: Omit<CalendarItemRow, 'id' | 'proposal_id' | 'content_id' | 'created_at' | 'updated_at'>[] = [];

  // Build topic pool: trending (40%), top performing (30%), gaps (20%), remaining (10%)
  const trendingTopics = trends
    .filter(t => t.topic_match)
    .map(t => ({ topic: t.topic_match!, reason: `Trending on ${t.source === 'hn' ? 'HN' : `r/${t.sub}`}: ${t.score} pts` }));

  const perfTopics = analysis.topicPerf
    .slice(0, 5)
    .map(t => ({ topic: t.topic, reason: `Top performer: ${Math.round(t.avg_views)} avg views` }));

  const gapTopics = analysis.recencyGaps
    .map(t => ({ topic: t, reason: `Coverage gap: not covered in 14+ days` }));

  // Deduplicate topics, prioritize trending
  const seen = new Set<string>();
  const topicPool: { topic: string; reason: string }[] = [];
  for (const list of [trendingTopics, perfTopics, gapTopics]) {
    for (const t of list) {
      if (!seen.has(t.topic)) {
        seen.add(t.topic);
        topicPool.push(t);
      }
    }
  }

  // If topic pool is empty, use all known topics from analysis
  if (topicPool.length === 0) {
    for (const t of analysis.topicPerf) {
      topicPool.push({ topic: t.topic, reason: 'From content library' });
    }
  }

  // Build level pool based on targets
  const totalItems = Object.values(WEEKLY_TARGETS).reduce((a, b) => a + b, 0);
  const levelPool: string[] = [];
  for (const [level, pct] of Object.entries(LEVEL_TARGETS)) {
    const count = Math.round(pct * totalItems);
    for (let i = 0; i < count; i++) levelPool.push(level);
  }

  // Distribute content across the week
  let slot = 0;
  let topicIdx = 0;
  let levelIdx = 0;

  for (const [type, count] of Object.entries(WEEKLY_TARGETS)) {
    for (let i = 0; i < count; i++) {
      const dayIdx = items.length % 7;
      const topicEntry = topicPool[topicIdx % topicPool.length];
      const level = levelPool[levelIdx % levelPool.length];

      items.push({
        day: weekDays[dayIdx],
        slot: slot++,
        type,
        title: `${topicEntry.topic}: ${type === 'blog' ? 'Deep Dive' : type === 'video' ? 'Explainer' : type === 'short' ? 'Quick Tip' : 'Discussion'} — ${level}`,
        topic: topicEntry.topic,
        level,
        reasoning: topicEntry.reason,
        status: 'proposed',
      });

      topicIdx++;
      levelIdx++;
    }
  }

  // Sort by day then slot
  items.sort((a, b) => a.day.localeCompare(b.day) || a.slot - b.slot);

  // Re-number slots per day
  let currentDay = '';
  let daySlot = 0;
  for (const item of items) {
    if (item.day !== currentDay) {
      currentDay = item.day;
      daySlot = 0;
    }
    item.slot = daySlot++;
  }

  return items;
}

// ── Handler ─────────────────────────────────────────────────

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const db = env.ENGAGE_DB;

  const { authorized, error } = await requireCalendarAuth(request, db, env.SYNC_SECRET);
  if (!authorized) return error!;

  // Determine trigger type
  let triggerType = 'manual';
  try {
    const body = await request.json<{ trigger_type?: string }>();
    if (body.trigger_type) triggerType = body.trigger_type;
  } catch {
    // No body or not JSON — default to manual
  }

  const weekStart = getNextMonday();
  const weekDays = getWeekDays(weekStart);

  // Archive any existing draft for this week
  await db.prepare(
    `UPDATE calendar_proposals SET status = 'archived' WHERE week_start = ? AND status = 'draft'`
  ).bind(weekStart).run();

  // Run analysis and trend scraping in parallel
  const [analysis, redditTrends, hnTrends] = await Promise.all([
    analyzeContent(db),
    fetchRedditTrends(),
    fetchHNTrends(),
  ]);

  const allTrends = [...redditTrends, ...hnTrends];
  allTrends.sort((a, b) => b.score - a.score);

  // Generate proposal items
  const items = generateItems(weekDays, analysis, allTrends);

  // Build trend sources JSON (top 20 trends)
  const trendSources = JSON.stringify({
    reddit: redditTrends.slice(0, 10).map(t => ({
      sub: t.sub, title: t.title, score: t.score, topic_match: t.topic_match,
    })),
    hn: hnTrends.slice(0, 10).map(t => ({
      title: t.title, score: t.score, topic_match: t.topic_match,
    })),
    fetched_at: new Date().toISOString(),
  });

  // Build performance summary JSON
  const perfSummary = JSON.stringify({
    top_topics: analysis.topicPerf.slice(0, 5),
    format_perf: analysis.formatPerf,
    level_dist: analysis.levelDist,
    recency_gaps: analysis.recencyGaps,
    growth_leaders: analysis.growthLeaders.slice(0, 5),
  });

  // Insert proposal
  const proposalResult = await db.prepare(
    `INSERT INTO calendar_proposals (week_start, status, generated_at, trigger_type, trend_sources, performance_summary)
     VALUES (?, 'draft', datetime('now'), ?, ?, ?)`
  ).bind(weekStart, triggerType, trendSources, perfSummary).run();

  const proposalId = proposalResult.meta.last_row_id;

  // Insert items
  for (const item of items) {
    await db.prepare(
      `INSERT INTO calendar_items (proposal_id, day, slot, type, title, topic, level, reasoning, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'proposed')`
    ).bind(proposalId, item.day, item.slot, item.type, item.title, item.topic, item.level, item.reasoning).run();
  }

  // Read back the full proposal with items
  const proposal = await db.prepare(
    `SELECT * FROM calendar_proposals WHERE id = ?`
  ).bind(proposalId).first<CalendarProposalRow>();

  const { results: proposalItems } = await db.prepare(
    `SELECT * FROM calendar_items WHERE proposal_id = ? ORDER BY day, slot`
  ).bind(proposalId).all<CalendarItemRow>();

  return jsonResponse({
    ok: true,
    proposal,
    items: proposalItems || [],
    trends_count: allTrends.length,
  });
};
