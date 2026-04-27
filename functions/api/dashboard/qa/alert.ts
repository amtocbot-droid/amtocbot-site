/**
 * POST /api/dashboard/qa/alert
 *
 * Internal endpoint called by the GitHub Actions qa-monitor workflow when
 * /api/dashboard/qa/monitor returns a 503 (no recent QA run).
 *
 * Authentication: Bearer token via QA_INGEST_TOKEN (same secret as the
 * ingest endpoint — no extra secret needed in GH Actions).
 *
 * Body: { message: string }   (optional — defaults sensibly if omitted)
 *
 * Response:
 *   200 { ok: true, sent_to: string }   — Brevo email dispatched
 *   400 { error: string }               — bad request
 *   401 { error: string }               — missing/invalid token
 *   500 { error: string }               — BREVO_API_KEY unset or send failed
 */
import { Env, jsonResponse, optionsHandler } from '../../_shared/auth';
import { requireIngestToken } from './_shared';
import { sendBrevoEmail } from '../../_shared/auth';

export const onRequestOptions = optionsHandler;

const ALERT_RECIPIENT = { email: 'amtocbot@gmail.com', name: 'AmtocSoft QA' };

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // Authenticate with the same bearer token used by the ingest endpoint.
  const deny = await requireIngestToken(request, env);
  if (deny) return deny;

  if (!env.BREVO_API_KEY) {
    return jsonResponse({ error: 'BREVO_API_KEY not configured' }, 500);
  }

  // Parse optional body
  let message = 'No QA suite run has been recorded in the last 36 hours.';
  try {
    const body = await request.json<{ message?: string }>();
    if (body?.message) message = body.message;
  } catch {
    // body is optional — ignore parse errors
  }

  const subject = '⚠️ QA Suite Staleness Alert — AmtocSoft';
  const now = new Date().toISOString();
  const htmlBody = `
    <h2 style="color:#c62828;">QA Suite Staleness Alert</h2>
    <p>${message}</p>
    <p>This alert was triggered at <strong>${now}</strong> by the <code>qa-monitor</code>
       GitHub Actions workflow.</p>
    <hr/>
    <p>
      <strong>Dashboard:</strong>
      <a href="https://amtocbot.com/dashboard">amtocbot.com/dashboard</a>
      &nbsp;→ QA Traceability tab<br/>
      <strong>Monitor endpoint:</strong>
      <a href="https://amtocbot.com/api/dashboard/qa/monitor">
        /api/dashboard/qa/monitor
      </a><br/>
      <strong>Manual trigger:</strong> dispatch the
      <code>QA Suite</code> workflow in the
      <a href="https://github.com/amtocbot-droid/amtocsoft-content/actions">
        amtocsoft-content repo
      </a>.
    </p>
    <p style="color:#757575;font-size:12px;">
      AmtocSoft Engage · automated alert · do not reply
    </p>
  `;

  const res = await sendBrevoEmail(env.BREVO_API_KEY, ALERT_RECIPIENT, subject, htmlBody);

  if (!res.ok) {
    const errText = await res.text().catch(() => '(no body)');
    return jsonResponse(
      { error: `Brevo send failed: HTTP ${res.status}`, detail: errText },
      500,
    );
  }

  return jsonResponse({ ok: true, sent_to: ALERT_RECIPIENT.email }, 200);
};
