// Cloudflare Pages Function: /api/portal/verify-code
// Proxies 2FA verify-code calls to the backend CRM portal-auth service server-to-server.

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
  const crmApiUrl = env.CRM_API_URL ? env.CRM_API_URL.replace(/\/+$/, '') : '';
  const portalSharedSecret = env.PORTAL_SHARED_SECRET;

  if (!crmApiUrl || !portalSharedSecret) {
    console.error('Server configuration error: CRM_API_URL or PORTAL_SHARED_SECRET is not configured.');
    return new Response(
      JSON.stringify({ success: false, error: 'Authentication service temporarily unavailable. Please try again later.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 4. Resolve client IP
  const clientIp = request.headers.get('cf-connecting-ip') ||
                   request.headers.get('x-client-ip') ||
                   (request.headers.get('x-forwarded-for') ? request.headers.get('x-forwarded-for').split(',')[0].trim() : '') ||
                   '';

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
      } else if (upstreamRes.status >= 500) {
        mappedError = 'Authentication service temporarily unavailable. Please try again later.';
      } else if (upstreamData.error) {
        mappedError = upstreamData.error;
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
    console.error('Portal verify-code upstream error:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Unable to reach authentication server. Please try again later.' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
