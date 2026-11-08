// Vercel Serverless Function: /api/portal/verify-code

function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const { email, code } = req.body || {};
  const cleanedCode = typeof code === 'string' ? code.trim() : (code != null ? String(code).trim() : '');

  if (!email || !isValidEmail(email) || !cleanedCode || !/^\d{6}$/.test(cleanedCode)) {
    return res.status(400).json({ success: false, error: 'Please provide a valid email and 6-digit verification code.' });
  }

  const crmApiUrl = process.env.CRM_API_URL ? process.env.CRM_API_URL.replace(/\/+$/, '') : '';
  const portalSharedSecret = process.env.PORTAL_SHARED_SECRET;

  if (!crmApiUrl || !portalSharedSecret) {
    console.error('Server configuration error: CRM_API_URL or PORTAL_SHARED_SECRET is not configured.');
    return res.status(500).json({ success: false, error: 'Sign-in is temporarily unavailable. Please try again in a few minutes.' });
  }

  const clientIp = req.headers['x-forwarded-for']
    ? req.headers['x-forwarded-for'].split(',')[0].trim()
    : req.headers['x-real-ip'] || req.socket.remoteAddress || '';

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
      return res.status(429).json({ success: false, error: 'Please wait before requesting another code.' });
    }

    let upstreamData = {};
    try {
      upstreamData = await upstreamRes.json();
    } catch (e) {}

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
        mappedError = 'Sign-in is temporarily unavailable. Please try again in a few minutes.';
      } else if (upstreamData.error) {
        mappedError = upstreamData.error;
      }

      return res.status(upstreamRes.status).json({ success: false, error: mappedError });
    }

    const session = upstreamData.session || {
      access_token: upstreamData.access_token,
      refresh_token: upstreamData.refresh_token
    };

    if (!session || !session.access_token) {
      return res.status(502).json({ success: false, error: 'Invalid session returned by authentication server.' });
    }

    return res.status(200).json({
      success: true,
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token
      },
      user: upstreamData.user || null
    });
  } catch (err) {
    console.error('Portal verify-code upstream error:', err);
    return res.status(502).json({ success: false, error: 'Unable to reach authentication server. Please try again later.' });
  }
}
