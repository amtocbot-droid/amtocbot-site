/**
 * POST /api/proxy/amtocsoft
 * Proxies admin calls to amtocsoft.com, injecting X-Admin-Key server-side.
 * Requires: authenticated admin session on amtocbot.com.
 *
 * Request body:
 *   { "endpoint": "/api/admin/referrals", "method": "GET", "params": { "limit": 20, "offset": 0 } }
 *   { "endpoint": "/api/admin/referral", "method": "POST", "body": { "code": "LAUNCH10", "discount_cents": 1000 } }
 *   { "endpoint": "/api/admin/audit", "method": "GET", "params": { "limit": 20, "offset": 0 } }
 */
import { getSessionUser, jsonResponse, corsHeaders, type Env } from '../_shared/auth';

const ALLOWED_ENDPOINTS = [
  '/api/admin/referrals',
  '/api/admin/referral',
  '/api/admin/audit',
  '/api/admin/review',
] as const;

type AllowedEndpoint = (typeof ALLOWED_ENDPOINTS)[number];

interface ProxyRequestBody {
  endpoint: AllowedEndpoint;
  method?: string;
  params?: Record<string, string | number>;
  body?: Record<string, unknown>;
}

interface EnvWithSecret extends Env {
  AMTOCSOFT_ADMIN_KEY: string;
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: corsHeaders });
};

export const onRequestPost: PagesFunction<EnvWithSecret> = async ({ request, env }) => {
  const db = env.ENGAGE_DB;

  // 1. Require authenticated admin
  const user = await getSessionUser(request, db);
  if (!user) return jsonResponse({ error: 'Authentication required' }, 401);
  if (user.role !== 'admin' && user.role !== 'superadmin') return jsonResponse({ error: 'Admin access required' }, 403);

  // 2. Parse and validate body
  let body: ProxyRequestBody;
  try {
    body = await request.json() as ProxyRequestBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { endpoint, method = 'GET', params, body: forwardBody } = body;

  if (!ALLOWED_ENDPOINTS.includes(endpoint as AllowedEndpoint)) {
    return jsonResponse({ error: `Endpoint not allowed: ${endpoint}` }, 400);
  }

  // 3. Build target URL with query params
  const baseUrl = 'https://amtocsoft.com';
  const targetUrl = new URL(baseUrl + endpoint);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      targetUrl.searchParams.set(k, String(v));
    }
  }

  // 4. Forward request with admin key injected
  const adminKey = env.AMTOCSOFT_ADMIN_KEY;
  if (!adminKey) return jsonResponse({ error: 'Proxy not configured' }, 500);

  const fetchOptions: RequestInit = {
    method,
    headers: {
      'X-Admin-Key': adminKey,
      'Content-Type': 'application/json',
    },
  };
  if (forwardBody && method !== 'GET') {
    fetchOptions.body = JSON.stringify(forwardBody);
  }

  const upstream = await fetch(targetUrl.toString(), fetchOptions);
  const data = await upstream.json();

  return jsonResponse(data, upstream.status);
};
