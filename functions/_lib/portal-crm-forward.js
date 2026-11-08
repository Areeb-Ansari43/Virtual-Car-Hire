// Forwards an authenticated driver-portal request to the CRM (not a route).
//
// Browser -> /api/portal/<name>  (Authorization: Bearer <driver Supabase access token>)
//         -> CRM /api/public/portal/<name>  (X-Portal-Secret + X-Driver-Token)
// The CRM reads the driver's data with its service role, so the portal does not depend on
// which row-level-security policies exist in Supabase.

import { jsonResponse, getConfig, logFailure, USER_MESSAGES } from './portal-proxy.js';

export async function forwardToCrm(context, crmPath, { maxBodyBytes = 10 * 1024 * 1024 } = {}) {
  const { request, env } = context;
  const config = getConfig(env);
  if (config.missing.length) {
    logFailure(crmPath, 'missing_config', `Website env missing: ${config.missing.join(', ')}`);
    return jsonResponse({ ok: false, error: USER_MESSAGES.unavailable }, 500);
  }

  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return jsonResponse({ ok: false, code: 'not_signed_in', error: 'Please sign in again.' }, 401);

  const body = await request.text();
  if (body.length > maxBodyBytes) {
    return jsonResponse({ ok: false, code: 'too_large', error: 'Upload is too large. Please try a smaller photo.' }, 413);
  }

  let res;
  try {
    res = await fetch(`${config.crmApiUrl}${crmPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Portal-Secret': config.portalSharedSecret,
        'X-Driver-Token': token,
      },
      body: body || '{}',
    });
  } catch (err) {
    logFailure(crmPath, 'crm_unreachable', (err && err.message) || err);
    return jsonResponse({ ok: false, error: USER_MESSAGES.unavailable }, 502);
  }

  let data = {};
  try {
    data = await res.json();
  } catch (e) {
    data = {};
  }
  if (!res.ok && res.status >= 500) logFailure(crmPath, 'crm_5xx', `CRM HTTP ${res.status} ${data.code || ''}`);
  if (res.status === 401 && (data.code === 'secret_mismatch' || data.code === 'missing_header')) {
    logFailure(crmPath, 'secret_mismatch', 'CRM rejected X-Portal-Secret');
    return jsonResponse({ ok: false, error: USER_MESSAGES.unavailable }, 502);
  }
  return jsonResponse(data, res.status);
}
