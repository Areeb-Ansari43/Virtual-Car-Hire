// Vercel Serverless Function: /api/portal/request-code

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const { email, password } = req.body || {};
  if (!email || !password || !isValidEmail(email)) {
    return res.status(400).json({ success: false, error: 'Please enter a valid email address and password.' });
  }

  const crmApiUrl = process.env.CRM_API_URL ? process.env.CRM_API_URL.replace(/\/+$/, '') : '';
  const portalSharedSecret = process.env.PORTAL_SHARED_SECRET;

  if (!crmApiUrl || !portalSharedSecret) {
    console.error('Server configuration error: CRM_API_URL or PORTAL_SHARED_SECRET is not configured.');
    return res.status(500).json({ success: false, error: 'Authentication service temporarily unavailable. Please try again later.' });
  }

  const clientIp = req.headers['x-forwarded-for']
    ? req.headers['x-forwarded-for'].split(',')[0].trim()
    : req.headers['x-real-ip'] || req.socket.remoteAddress || '';

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
      return res.status(429).json({ success: false, error: 'Please wait before requesting another code.' });
    }

    let upstreamData = {};
    try {
      upstreamData = await upstreamRes.json();
    } catch (e) {}

    if (!upstreamRes.ok) {
      let mappedError = 'Invalid email or password.';
      if (upstreamRes.status === 401 || upstreamRes.status === 403) {
        mappedError = upstreamData.error || 'Invalid email or password.';
      } else if (upstreamRes.status >= 500) {
        mappedError = 'Authentication service temporarily unavailable. Please try again later.';
      } else if (upstreamData.error) {
        mappedError = upstreamData.error;
      }
      return res.status(upstreamRes.status).json({ success: false, error: mappedError });
    }

    const masked = upstreamData.maskedEmail || maskEmail(email);
    return res.status(200).json({
      success: true,
      message: 'Verification code sent.',
      maskedEmail: masked
    });
  } catch (err) {
    console.error('Portal request-code upstream error:', err);
    return res.status(502).json({ success: false, error: 'Unable to reach authentication server. Please try again later.' });
  }
}
