// Cloudflare Pages Function: /api/portal/request-code
// Proxies 2FA request-code calls to the backend CRM portal-auth service server-to-server.
//
// Flow: browser -> this function -> CRM /api/public/portal-auth/request-code (X-Portal-Secret)
//       -> password check -> login_otps row -> code email from auth@fa-ibi.co.uk
//
// Drivers only ever see friendly generic text. The specific reason is written to the
// Cloudflare function log and (when the CRM is reachable) to portal_auth_events.

import {
  USER_MESSAGES,
  jsonResponse,
  getConfig,
  recordFailure,
  classifyUpstream,
  clientIpFrom,
} from '../../_lib/portal-proxy.js';

function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
}

function maskEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const parts = email.trim().split('@');
  if (parts.length !== 2) return email;
  const [name, domain] = parts;
  if (name.length <= 2) {
    return `${name.charAt(0)}***@${domain}`;
  }
  return `${name.charAt(0)}***${name.charAt(name.length - 1)}@${domain}`;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // 1. Method guard
  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method Not Allowed' }, 405, { Allow: 'POST' });
  }

  // 2. Parse request payload
  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return jsonResponse({ success: false, error: 'Invalid JSON payload.' }, 400);
  }

  const { email, password } = payload || {};
  if (!email || !password || !isValidEmail(email)) {
    return jsonResponse({ success: false, error: 'Please enter a valid email address and password.' }, 400);
  }
  const normalizedEmail = email.trim().toLowerCase();

  // 3. Environment configuration check
  const config = getConfig(env);
  if (config.missing.length) {
    await recordFailure(config, {
      email: normalizedEmail,
      step: 'request_code',
      resultCode: 'missing_config',
      reason: `Website env missing: ${config.missing.join(', ')}`,
    });
    return jsonResponse({ success: false, error: USER_MESSAGES.unavailable }, 500);
  }

  // 4. Resolve client IP
  const clientIp = clientIpFrom(request);

  // 5. Forward request to CRM endpoint
  const targetUrl = `${config.crmApiUrl}/api/public/portal-auth/request-code`;

  let upstreamRes;
  try {
    upstreamRes = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Portal-Secret': config.portalSharedSecret,
        ...(clientIp ? { 'X-Client-IP': clientIp } : {}),
      },
      body: JSON.stringify({ email: normalizedEmail, password }),
    });
  } catch (err) {
    await recordFailure(config, {
      email: normalizedEmail,
      step: 'request_code',
      resultCode: 'crm_unreachable',
      reason: `${targetUrl}: ${(err && err.message) || err}`,
    });
    return jsonResponse({ success: false, error: USER_MESSAGES.unavailable }, 502);
  }

  if (upstreamRes.status === 429) {
    return jsonResponse({ success: false, error: 'Please wait before requesting another code.' }, 429);
  }

  let upstreamData = {};
  try {
    upstreamData = await upstreamRes.json();
  } catch (e) {
    // Non-JSON response from upstream (e.g. a Cloudflare error page)
  }

  if (!upstreamRes.ok) {
    const status = upstreamRes.status;

    // Wrong email/password or disabled account: a normal outcome, already logged by the CRM.
    if (status === 400) {
      return jsonResponse({ success: false, error: upstreamData.error || 'Invalid email or password.' }, 400);
    }

    const resultCode = classifyUpstream(status, upstreamData);
    await recordFailure(config, {
      email: normalizedEmail,
      step: 'request_code',
      resultCode,
      reason: `CRM HTTP ${status}${upstreamData.code ? ` code=${upstreamData.code}` : ''}`,
    });
    const error = resultCode === 'email_send_failed' ? USER_MESSAGES.sendFailed : USER_MESSAGES.unavailable;
    return jsonResponse({ success: false, error }, status >= 500 ? status : 502);
  }

  const masked = upstreamData.maskedEmail || maskEmail(email);
  return jsonResponse({ success: true, message: 'Verification code sent.', maskedEmail: masked }, 200);
}
