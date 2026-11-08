// Shared helpers for the driver-portal 2FA proxy functions (/api/portal/*).
// Not a route: this module exports no onRequest* handlers.
//
// Env vars (Cloudflare Pages > Settings > Variables and Secrets), names only:
//   CRM_API_URL           e.g. https://hq.virtual-carhire.co.uk
//   PORTAL_SHARED_SECRET  must equal PORTAL_SHARED_SECRET on the CRM

// Friendly, generic text shown to drivers. Internal detail goes to logs only.
export const USER_MESSAGES = {
  unavailable: 'Sign-in is temporarily unavailable. Please try again in a few minutes.',
  sendFailed: "We couldn't send your verification code. Please try again in a few minutes.",
};

// Internal result codes (logged, never shown to drivers):
//   missing_config   CRM_API_URL or PORTAL_SHARED_SECRET not set on the website
//   secret_mismatch  CRM rejected X-Portal-Secret (values differ between website and CRM)
//   crm_missing_config  CRM has no PORTAL_SHARED_SECRET
//   crm_unreachable  network error / DNS / timeout reaching the CRM
//   crm_blocked      403 from Cloudflare in front of the CRM
//   crm_5xx          CRM returned a 5xx
//   email_send_failed CRM could not send the code email
//   bad_upstream_response CRM response was not the expected JSON

export function jsonResponse(body, status, extraHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...(extraHeaders || {}) },
  });
}

export function getConfig(env) {
  const crmApiUrl = env && env.CRM_API_URL ? String(env.CRM_API_URL).trim().replace(/\/+$/, '') : '';
  const portalSharedSecret = env && env.PORTAL_SHARED_SECRET ? String(env.PORTAL_SHARED_SECRET) : '';
  const missing = [];
  if (!crmApiUrl) missing.push('CRM_API_URL');
  if (!portalSharedSecret) missing.push('PORTAL_SHARED_SECRET');
  return { crmApiUrl, portalSharedSecret, missing };
}

export function timingSafeEqual(a, b) {
  const enc = new TextEncoder();
  const ab = enc.encode(String(a || ''));
  const bb = enc.encode(String(b || ''));
  let diff = ab.length ^ bb.length;
  const len = Math.max(ab.length, bb.length);
  for (let i = 0; i < len; i++) diff |= (ab[i] || 0) ^ (bb[i] || 0);
  return diff === 0;
}

/** Structured server-side log line. Never includes secrets, passwords or codes. */
export function logFailure(step, resultCode, reason) {
  console.error(
    JSON.stringify({ source: 'Portal', area: 'portal-auth', step, result_code: resultCode, reason: String(reason || '').slice(0, 300) }),
  );
}

/**
 * Records a failure as a portal_auth_events row (source "Portal") via the CRM, when the CRM is
 * reachable with a valid secret. Best effort: never throws, never blocks the response for long.
 */
export async function recordFailure(config, { email, step, resultCode, reason }) {
  logFailure(step, resultCode, reason);
  if (!config.crmApiUrl || !config.portalSharedSecret) return;
  if (resultCode === 'crm_unreachable' || resultCode === 'secret_mismatch' || resultCode === 'crm_missing_config') return;
  try {
    await fetch(`${config.crmApiUrl}/api/public/portal-auth/log-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Portal-Secret': config.portalSharedSecret },
      body: JSON.stringify({ email, step, result_code: resultCode, reason }),
      signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined,
    });
  } catch (e) {
    // Logged above already; nothing else to do.
  }
}

/**
 * Maps a non-OK CRM response to an internal result code.
 * `data` is the parsed JSON body (or {}), `status` the HTTP status.
 */
export function classifyUpstream(status, data) {
  const crmCode = data && typeof data.code === 'string' ? data.code : '';
  if (crmCode === 'missing_config') return 'crm_missing_config';
  if (crmCode === 'secret_mismatch' || crmCode === 'missing_header') return 'secret_mismatch';
  if (crmCode === 'email_send_failed') return 'email_send_failed';
  if (status === 401) return 'secret_mismatch';
  if (status === 403) return 'crm_blocked';
  if (status === 503 && !crmCode) return 'crm_5xx';
  if (status >= 500) return 'crm_5xx';
  return crmCode || `http_${status}`;
}

export function clientIpFrom(request) {
  const h = request.headers;
  const fwd = h.get('x-forwarded-for');
  return h.get('cf-connecting-ip') || h.get('x-client-ip') || (fwd ? fwd.split(',')[0].trim() : '') || '';
}
