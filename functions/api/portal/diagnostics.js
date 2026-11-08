// Cloudflare Pages Function: /api/portal/diagnostics
//
// Protected health check for the driver-portal login path. Requires the header
//   X-Portal-Secret: <PORTAL_SHARED_SECRET>
// and reports (names and booleans only, never values):
//   - whether CRM_API_URL, PORTAL_SHARED_SECRET, SUPABASE_URL, SUPABASE_ANON_KEY are set here
//   - whether the CRM is reachable (GET <CRM_API_URL>/api/health)
//   - whether the shared-secret handshake with the CRM succeeds
//     (POST <CRM_API_URL>/api/public/portal-auth/handshake)
//
// Example:
//   curl -s https://virtual-carhire.co.uk/api/portal/diagnostics -H "X-Portal-Secret: $PORTAL_SHARED_SECRET"

import { jsonResponse, getConfig, timingSafeEqual } from '../../_lib/portal-proxy.js';

const TIMEOUT_MS = 8000;

async function timedFetch(url, init) {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout ? AbortSignal.timeout(TIMEOUT_MS) : undefined,
    });
    let body = null;
    try {
      body = await res.json();
    } catch (e) {
      body = null;
    }
    return { ok: res.ok, status: res.status, body, ms: Date.now() - started };
  } catch (err) {
    return { ok: false, status: 0, body: null, ms: Date.now() - started, error: String((err && err.message) || err).slice(0, 200) };
  }
}

async function handle(context) {
  const { request, env } = context;
  const config = getConfig(env);

  if (!config.portalSharedSecret) {
    // Nobody can authenticate to this endpoint until the secret exists, so say only that.
    return jsonResponse({ ok: false, code: 'missing_config', missing: ['PORTAL_SHARED_SECRET'] }, 503);
  }

  const supplied = request.headers.get('x-portal-secret') || '';
  if (!supplied || !timingSafeEqual(supplied, config.portalSharedSecret)) {
    return jsonResponse({ ok: false, code: 'unauthorized' }, 401);
  }

  const envReport = {
    CRM_API_URL: config.crmApiUrl ? 'set' : 'unset',
    PORTAL_SHARED_SECRET: 'set',
    SUPABASE_URL: env && env.SUPABASE_URL ? 'set' : 'unset',
    SUPABASE_ANON_KEY: env && env.SUPABASE_ANON_KEY ? 'set' : 'unset',
  };

  const result = {
    ok: false,
    env: envReport,
    // The browser login page uses the public Supabase URL/anon key built into assets/portal.js,
    // so SUPABASE_* here are informational; CRM_API_URL and PORTAL_SHARED_SECRET are required.
    crm_host: null,
    crm_reachable: { ok: false, status: 0, ms: 0 },
    handshake: { ok: false, code: 'not_attempted' },
  };

  if (!config.crmApiUrl) {
    result.handshake.code = 'missing_config';
    return jsonResponse(result, 200);
  }

  try {
    result.crm_host = new URL(config.crmApiUrl).host;
  } catch (e) {
    result.handshake.code = 'invalid_crm_api_url';
    return jsonResponse(result, 200);
  }

  const health = await timedFetch(`${config.crmApiUrl}/api/health`, { method: 'GET' });
  result.crm_reachable = {
    ok: health.ok,
    status: health.status,
    ms: health.ms,
    ...(health.error ? { error: health.error } : {}),
    ...(health.status === 403 ? { hint: 'Cloudflare in front of the CRM blocked this request' } : {}),
    ...(health.body && health.body.status ? { crm_status: health.body.status } : {}),
  };

  const hs = await timedFetch(`${config.crmApiUrl}/api/public/portal-auth/handshake`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Portal-Secret': config.portalSharedSecret },
    body: '{}',
  });
  let code;
  if (hs.status === 0) code = 'crm_unreachable';
  else if (hs.ok) code = 'ok';
  else if (hs.body && hs.body.code === 'missing_config') code = 'crm_missing_config';
  else if (hs.body && (hs.body.code === 'secret_mismatch' || hs.body.code === 'missing_header')) code = 'secret_mismatch';
  else if (hs.status === 404) code = 'crm_endpoint_missing';
  else if (hs.status === 403) code = 'crm_blocked';
  else if (hs.status >= 500) code = 'crm_5xx';
  else code = `http_${hs.status}`;

  result.handshake = {
    ok: hs.ok,
    code,
    status: hs.status,
    ms: hs.ms,
    ...(hs.ok && hs.body ? { crm_email_configured: !!hs.body.email_configured, crm_otp_pepper_configured: !!hs.body.otp_pepper_configured } : {}),
  };
  result.ok = result.crm_reachable.ok && hs.ok;
  return jsonResponse(result, 200);
}

export async function onRequestGet(context) {
  return handle(context);
}

export async function onRequestPost(context) {
  return handle(context);
}
