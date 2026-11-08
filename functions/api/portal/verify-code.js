// Cloudflare Pages Function: /api/portal/verify-code
// Proxies 2FA verify-code calls to the backend CRM portal-auth service server-to-server.
// Drivers see friendly generic text; specific reasons go to logs and portal_auth_events.

import { USER_MESSAGES, getConfig, recordFailure, classifyUpstream, clientIpFrom } from '../../_lib/portal-proxy.js';

function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // 1. Method guard
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method Not Allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json', Allow: 'POST' } }
    );
  }

  // 2. Parse request payload
  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: 'Invalid JSON payload.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { email, code } = payload || {};
  const cleanedCode = typeof code === 'string' ? code.trim() : (code != null ? String(code).trim() : '');

  if (!email || !isValidEmail(email) || !cleanedCode || !/^\d{6}$/.test(cleanedCode)) {
    return new Response(
      JSON.stringify({ success: false, error: 'Please provide a valid email and 6-digit verification code.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 3. Environment configuration check
  const config = getConfig(env);
  const crmApiUrl = config.crmApiUrl;
  const portalSharedSecret = config.portalSharedSecret;
  const normalizedEmail = email.trim().toLowerCase();

  if (config.missing.length) {
    await recordFailure(config, {
      email: normalizedEmail,
      step: 'verify_code',
      resultCode: 'missing_config',
      reason: `Website env missing: ${config.missing.join(', ')}`,
    });
    return new Response(
      JSON.stringify({ success: false, error: USER_MESSAGES.unavailable }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 4. Resolve client IP
  const clientIp = clientIpFrom(request);

  // 5. Forward request to CRM endpoint
  const targetUrl = `${crmApiUrl}/api/public/portal-auth/verify-code`;

  try {
    const upstreamRes = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Portal-Secret': portalSharedSecret,
        ...(clientIp ? { 'X-Client-IP': clientIp } : {})
      },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        code: cleanedCode
      })
    });

    if (upstreamRes.status === 429) {
      return new Response(
        JSON.stringify({ success: false, error: 'Please wait before requesting another code.' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let upstreamData = {};
    try {
      upstreamData = await upstreamRes.json();
    } catch (e) {
      // Non-JSON response from upstream
    }

    if (!upstreamRes.ok) {
      let mappedError = 'Invalid verification code.';
      const rawError = (upstreamData.error || upstreamData.message || '').toLowerCase();

      if (upstreamRes.status === 423 || rawError.includes('locked') || rawError.includes('too many attempts')) {
        mappedError = upstreamData.error || 'Account temporarily locked due to too many failed attempts. Please try again later.';
      } else if (rawError.includes('expired')) {
        mappedError = upstreamData.error || 'Verification code has expired. Please request a new code.';
      } else if (rawError.includes('invalid') || rawError.includes('wrong') || rawError.includes('incorrect')) {
        mappedError = upstreamData.error || 'Incorrect verification code. Please check and try again.';
      } else if (upstreamRes.status === 400 && upstreamData.error) {
        mappedError = upstreamData.error;
      } else {
        // Infrastructure problem (secret mismatch, CRM 5xx, Cloudflare block): generic text, specific log.
        mappedError = USER_MESSAGES.unavailable;
        await recordFailure(config, {
          email: normalizedEmail,
          step: 'verify_code',
          resultCode: classifyUpstream(upstreamRes.status, upstreamData),
          reason: `CRM HTTP ${upstreamRes.status}${upstreamData.code ? ` code=${upstreamData.code}` : ''}`,
        });
      }

      return new Response(
        JSON.stringify({ success: false, error: mappedError }),
        { status: upstreamRes.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Upstream verified successfully. Return session tokens safely.
    const session = upstreamData.session || {
      access_token: upstreamData.access_token,
      refresh_token: upstreamData.refresh_token
    };

    if (!session || !session.access_token) {
      await recordFailure(config, {
        email: normalizedEmail,
        step: 'verify_code',
        resultCode: 'bad_upstream_response',
        reason: 'CRM verify-code returned 200 without a session',
      });
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid session returned by authentication server.' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        session: {
          access_token: session.access_token,
          refresh_token: session.refresh_token
        },
        user: upstreamData.user || null
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    await recordFailure(config, {
      email: normalizedEmail,
      step: 'verify_code',
      resultCode: 'crm_unreachable',
      reason: `${targetUrl}: ${(err && err.message) || err}`,
    });
    return new Response(
      JSON.stringify({ success: false, error: USER_MESSAGES.unavailable }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
