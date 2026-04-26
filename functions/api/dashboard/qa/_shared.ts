/**
 * Shared types and helpers for QA traceability endpoints.
 */
import { Env, jsonResponse, requirePermission, getSessionUser, hasPermission } from '../../_shared/auth';

export { Env, jsonResponse, requirePermission, getSessionUser, hasPermission };
export { corsHeaders, optionsHandler, logAudit } from '../../_shared/auth';

export const QA_CHECK_TYPES = [
  'in_tracker',
  'tracker_url_valid',
  'live_url_200',
  'watermarked',
  'youtube_uploaded',
  'youtube_thumbnail',
  'youtube_playlist',
  'spotify_live',
  'blogger_live',
  'linkedin_crosspost',
  'x_crosspost',
  'companion_repo',
] as const;
export type QaCheckType = typeof QA_CHECK_TYPES[number];

export const QA_CONTENT_KINDS = [
  'tale', 'podcast', 'video', 'blog', 'tutorial', 'linkedin_article',
] as const;
export type QaContentKind = typeof QA_CONTENT_KINDS[number];

export const QA_CHECK_STATUSES = ['pass', 'fail', 'na', 'unknown'] as const;
export type QaCheckStatus = typeof QA_CHECK_STATUSES[number];

export const QA_RUN_SOURCES = ['cron', 'manual', 'dispatch'] as const;
export type QaRunSource = typeof QA_RUN_SOURCES[number];

export interface QaRunRow {
  id: number;
  client_run_id: string | null;
  started_at: string;
  finished_at: string | null;
  source: QaRunSource;
  triggered_by: number | null;
  total_checks: number;
  total_pass: number;
  total_fail: number;
  total_na: number;
  notes: string | null;
}

export interface QaCheckResultRow {
  id: number;
  run_id: number;
  content_code: string;
  content_kind: QaContentKind;
  content_title: string | null;
  check_type: QaCheckType;
  status: QaCheckStatus;
  error_detail: string | null;
  checked_at: string;
}

export interface QaAcknowledgementRow {
  id: number;
  content_code: string;
  check_type: QaCheckType;
  acknowledged_by: number;
  acknowledged_at: string;
  reason: string;
  expires_at: string;
  cleared_at: string | null;
  cleared_reason: string | null;
}

export interface QaWeeklySignoffRow {
  id: number;
  week_start_date: string;
  signed_by: number;
  signed_at: string;
  based_on_run_id: number;
  count_regressions: number;
  count_persistent: number;
  count_new_green: number;
  count_steady_green: number;
  notes: string | null;
}

export interface QaCellInput {
  status: QaCheckStatus;
  error_detail?: string;
}

export interface QaIngestPayload {
  run: {
    started_at: string;
    finished_at: string;
    source: QaRunSource;
    notes?: string;
    client_run_id?: string;
  };
  results: Array<{
    content_code: string;
    content_kind: QaContentKind;
    content_title?: string;
    checks: Partial<Record<QaCheckType, QaCellInput>>;
  }>;
}

/**
 * Bearer-token auth for the GH Actions ingest endpoint.
 * Returns null if authorized, or a Response on rejection.
 */
export async function requireIngestToken(request: Request, env: Env): Promise<Response | null> {
  const auth = request.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(\S+)$/i);
  if (!match) {
    return jsonResponse({ error: 'missing bearer token' }, 401);
  }
  const expected = (env as any).QA_INGEST_TOKEN as string | undefined;
  if (!expected) {
    return jsonResponse({ error: 'server misconfigured: QA_INGEST_TOKEN unset' }, 500);
  }
  // Constant-time compare
  if (match[1].length !== expected.length) {
    return jsonResponse({ error: 'invalid token' }, 403);
  }
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= match[1].charCodeAt(i) ^ expected.charCodeAt(i);
  }
  if (diff !== 0) {
    return jsonResponse({ error: 'invalid token' }, 403);
  }
  return null;
}

/**
 * Validate an ingest payload. Returns array of error messages (empty = valid).
 */
export function validateIngestPayload(p: any): string[] {
  const errors: string[] = [];
  if (!p || typeof p !== 'object') { errors.push('payload not an object'); return errors; }
  if (!p.run || typeof p.run !== 'object') { errors.push('run object missing'); return errors; }
  if (!QA_RUN_SOURCES.includes(p.run.source)) errors.push(`invalid run.source: ${p.run.source}`);
  if (typeof p.run.started_at !== 'string') errors.push('run.started_at must be string');
  if (typeof p.run.finished_at !== 'string') errors.push('run.finished_at must be string');
  if (!Array.isArray(p.results)) { errors.push('results must be array'); return errors; }
  for (let i = 0; i < p.results.length; i++) {
    const r = p.results[i];
    if (typeof r.content_code !== 'string' || !r.content_code) errors.push(`results[${i}].content_code missing`);
    if (!QA_CONTENT_KINDS.includes(r.content_kind)) errors.push(`results[${i}].content_kind invalid: ${r.content_kind}`);
    if (!r.checks || typeof r.checks !== 'object') errors.push(`results[${i}].checks missing`);
    else {
      for (const [ct, cell] of Object.entries(r.checks)) {
        if (!QA_CHECK_TYPES.includes(ct as QaCheckType)) {
          errors.push(`results[${i}].checks.${ct}: invalid check_type`);
        }
        const c = cell as QaCellInput;
        if (!QA_CHECK_STATUSES.includes(c.status)) {
          errors.push(`results[${i}].checks.${ct}.status invalid: ${c.status}`);
        }
        if ((c.status === 'fail' || c.status === 'unknown') && !c.error_detail) {
          errors.push(`results[${i}].checks.${ct}: error_detail required when status=${c.status}`);
        }
      }
    }
  }
  return errors;
}
