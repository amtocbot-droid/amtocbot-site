/**
 * GET /api/dashboard/qa/todos
 *
 * Returns a risk-weighted priority todo list of failing QA checks.
 * Requires: qa.view permission.
 *
 * Algorithm: tiers 1-8 (see inline comments). Max 200 items.
 *
 * Response: { todos: Todo[], tier_labels: string[] }
 */
import {
  Env, jsonResponse, optionsHandler, getSessionUser, requirePermission,
  QaCheckType,
} from './_shared';

export const onRequestOptions = optionsHandler;

const TIER_LABELS = [
  '',                              // 0 (unused)
  'Regressions',                   // 1
  'Live URL 404s',                 // 2
  'Tracker URL violations',        // 3
  'Missing watermarks',            // 4
  'Missing primary platform',      // 5
  'Missing secondary cross-posts', // 6
  'Acknowledged-but-stale',        // 7
  'Never-been-green > 7d',         // 8
];

/** Returns true if this check_type is the primary platform check for the given content_kind */
function isPrimaryPlatform(contentKind: string, checkType: string): boolean {
  if (['tale', 'podcast', 'video'].includes(contentKind) &&
      ['youtube_uploaded', 'youtube_thumbnail', 'youtube_playlist'].includes(checkType)) {
    return true;
  }
  if (contentKind === 'blog' && checkType === 'blogger_live') return true;
  if (contentKind === 'podcast' && checkType === 'spotify_live') return true;
  return false;
}

interface Todo {
  priority_tier: number;
  priority_label: string;
  content_code: string;
  content_kind: string;
  content_title: string | null;
  check_type: string;
  last_error: string | null;
  last_known_good_at: string | null;
  suggested_action: string;
  existing_ack_id: number | null;
  existing_issue_id: number | null;
}

function suggestAction(tier: number, checkType: string): string {
  switch (tier) {
    case 1: return 'Regression — re-run check or fix the underlying issue';
    case 2: return 'Fetch live URL and verify 200 response';
    case 3: return 'Fix tracker URL format (must be a real post/episode URL, not a profile link)';
    case 4: return 'Stamp watermark: python3 scripts/watermark.py <file>';
    case 5: return `Publish to primary platform for check: ${checkType}`;
    case 6: return `Cross-post to ${checkType.replace('_crosspost', '')} and update tracker`;
    case 7: return 'Acknowledgement is stale (>14d) — renew or fix the underlying issue';
    case 8: return 'Has never passed — investigate or acknowledge if permanently N/A';
    default: return 'Investigate failing check';
  }
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getSessionUser(request, env.ENGAGE_DB);
  const deny = requirePermission(user, 'qa.view');
  if (deny) return deny;

  const db = env.ENGAGE_DB;

  // 1. Find latest completed run
  const latestRun = await db
    .prepare('SELECT id FROM qa_runs WHERE finished_at IS NOT NULL ORDER BY started_at DESC LIMIT 1')
    .first<{ id: number }>();

  if (!latestRun) {
    return jsonResponse({ todos: [], tier_labels: TIER_LABELS }, 200);
  }

  const runId = latestRun.id;

  // 2. Find last signoff
  const lastSignoff = await db
    .prepare('SELECT based_on_run_id, signed_at FROM qa_weekly_signoffs ORDER BY week_start_date DESC LIMIT 1')
    .first<{ based_on_run_id: number; signed_at: string }>();

  // 3. Pull all fails for latest run
  const { results: fails } = await db
    .prepare(
      `SELECT content_code, content_kind, content_title, check_type, error_detail, checked_at
       FROM qa_check_results
       WHERE run_id = ? AND status = 'fail'
       ORDER BY content_code, check_type`
    )
    .bind(runId)
    .all<{
      content_code: string;
      content_kind: string;
      content_title: string | null;
      check_type: QaCheckType;
      error_detail: string | null;
      checked_at: string;
    }>();

  if (fails.length === 0) {
    return jsonResponse({ todos: [], tier_labels: TIER_LABELS }, 200);
  }

  // 4. Build priorPassMap from last signoff's run (if any)
  const priorPassMap = new Set<string>();
  if (lastSignoff) {
    const { results: priorPasses } = await db
      .prepare(
        `SELECT content_code, check_type
         FROM qa_check_results
         WHERE run_id = ? AND status = 'pass'`
      )
      .bind(lastSignoff.based_on_run_id)
      .all<{ content_code: string; check_type: string }>();
    for (const r of priorPasses) {
      priorPassMap.add(`${r.content_code}|${r.check_type}`);
    }
  }

  // 5. Pull active acks
  interface AckRow {
    id: number;
    content_code: string;
    check_type: string;
    acknowledged_at: string;
  }
  const { results: activeAcks } = await db
    .prepare(
      `SELECT id, content_code, check_type, acknowledged_at
       FROM qa_acknowledgements
       WHERE cleared_at IS NULL AND expires_at > datetime('now')`
    )
    .all<AckRow>();
  const ackMap = new Map<string, AckRow>();
  for (const ack of activeAcks) {
    ackMap.set(`${ack.content_code}|${ack.check_type}`, ack);
  }

  // 6. Pull linked open issues (keyed by content_code|check_type)
  interface IssueRow { id: number; qa_content_code: string; qa_check_type: string }
  const { results: openIssues } = await db
    .prepare(
      `SELECT id, qa_content_code, qa_check_type
       FROM issues
       WHERE status IN ('open', 'in_progress')
         AND qa_content_code IS NOT NULL`
    )
    .all<IssueRow>();
  const issueMap = new Map<string, number>();
  for (const issue of openIssues) {
    issueMap.set(`${issue.qa_content_code}|${issue.qa_check_type}`, issue.id);
  }

  // 7. Build lastGoodMap: most recent pass within 90 days, per (content_code, check_type)
  interface LastGoodRow { content_code: string; check_type: string; last_pass: string }
  const { results: lastGoods } = await db
    .prepare(
      `SELECT content_code, check_type, MAX(checked_at) as last_pass
       FROM qa_check_results
       WHERE status = 'pass' AND checked_at > datetime('now', '-90 days')
       GROUP BY content_code, check_type`
    )
    .all<LastGoodRow>();
  const lastGoodMap = new Map<string, string>();
  for (const r of lastGoods) {
    lastGoodMap.set(`${r.content_code}|${r.check_type}`, r.last_pass);
  }

  const now = Date.now();
  const STALE_ACK_MS = 14 * 86_400_000;

  const todos: Todo[] = [];

  for (const fail of fails) {
    const key = `${fail.content_code}|${fail.check_type}`;
    let tier: number;

    if (lastSignoff && priorPassMap.has(key)) {
      // Tier 1: was passing at last signoff, now failing = regression
      tier = 1;
    } else if (fail.check_type === 'live_url_200') {
      tier = 2;
    } else if (fail.check_type === 'tracker_url_valid') {
      tier = 3;
    } else if (fail.check_type === 'watermarked') {
      tier = 4;
    } else if (isPrimaryPlatform(fail.content_kind, fail.check_type)) {
      tier = 5;
    } else if (['linkedin_crosspost', 'x_crosspost'].includes(fail.check_type)) {
      tier = 6;
    } else if (ackMap.has(key)) {
      const ack = ackMap.get(key)!;
      const ackAge = now - new Date(ack.acknowledged_at).getTime();
      if (ackAge > STALE_ACK_MS) {
        tier = 7; // stale ack
      } else {
        continue; // fresh ack — omit from todos
      }
    } else if (!lastGoodMap.has(key)) {
      // Never been green within 90 days
      // But only include if the fail is older than 7 days to avoid noise
      const failAge = now - new Date(fail.checked_at).getTime();
      if (failAge < 7 * 86_400_000) {
        continue;
      }
      tier = 8;
    } else {
      continue; // passes didn't regress, not special — skip
    }

    const ack = ackMap.get(key);
    todos.push({
      priority_tier: tier,
      priority_label: TIER_LABELS[tier],
      content_code: fail.content_code,
      content_kind: fail.content_kind,
      content_title: fail.content_title,
      check_type: fail.check_type,
      last_error: fail.error_detail,
      last_known_good_at: lastGoodMap.get(key) ?? null,
      suggested_action: suggestAction(tier, fail.check_type),
      existing_ack_id: ack ? ack.id : null,
      existing_issue_id: issueMap.get(key) ?? null,
    });
  }

  // Sort: tier asc, then content_code asc; cap at 200
  todos.sort((a, b) => a.priority_tier - b.priority_tier || a.content_code.localeCompare(b.content_code));
  const capped = todos.slice(0, 200);

  return jsonResponse({ todos: capped, tier_labels: TIER_LABELS }, 200);
};
