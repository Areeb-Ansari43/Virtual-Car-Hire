// Cloudflare Pages Function: /api/portal/request-code
// Proxies 2FA request-code calls to the backend CRM portal-auth service server-to-server.

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

  const { email, password } = payload || {};
  if (!email || !password || !isValidEmail(email)) {
    return new Response(
      JSON.stringify({ success: false, error: 'Please enter a valid email address and password.' }),
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
  const targetUrl = `${crmApiUrl}/api/public/portal-auth/request-code`;

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
        password
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
      let mappedError = 'Invalid email or password.';
      if (upstreamRes.status === 401 || upstreamRes.status === 403) {
        mappedError = upstreamData.error || 'Invalid email or password.';
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

    const masked = upstreamData.maskedEmail || maskEmail(email);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Verification code sent.',
        maskedEmail: masked
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Portal request-code upstream error:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Unable to reach authentication server. Please try again later.' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
