const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Driver portal login: result codes, failure logging and the protected diagnostics endpoint.

const requestCode = require('../functions/api/portal/request-code.js');
const verifyCode = require('../functions/api/portal/verify-code.js');
const diagnostics = require('../functions/api/portal/diagnostics.js');

const ENV = { CRM_API_URL: 'https://crm.test', PORTAL_SHARED_SECRET: 'shared-secret' };

function req(body, headers = {}) {
  const map = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return { method: 'POST', headers: { get: (k) => map.get(k.toLowerCase()) || null }, json: async () => body };
}

function mockFetch(handler) {
  const calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    return handler(url, options);
  };
  return calls;
}

const upstream = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

async function silence(fn) {
  const orig = console.error;
  const lines = [];
  console.error = (...a) => lines.push(a.join(' '));
  try {
    return { result: await fn(), lines };
  } finally {
    console.error = orig;
  }
}

async function testNoLegacyGenericMessage() {
  for (const f of ['functions/api/portal/request-code.js', 'functions/api/portal/verify-code.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    assert(!src.includes('Authentication service temporarily unavailable'), `${f} must not use the old generic message`);
  }
  console.log('✅ PASS: old generic message removed from portal proxies.');
}

async function testRequestCodeFailureCodes() {
  const origFetch = global.fetch;
  const body = { email: 'driver@example.com', password: 'pw' };

  // CRM 500 with otp_store_failed -> friendly text, logged as crm_5xx and forwarded to CRM log-event
  let calls = mockFetch((url) =>
    url.endsWith('/log-event') ? upstream(200, { ok: true }) : upstream(500, { error: 'x', code: 'otp_store_failed' }),
  );
  let { result: res, lines } = await silence(() => requestCode.onRequestPost({ request: req(body), env: ENV }));
  assert.strictEqual(res.status, 500);
  let data = await res.json();
  assert.strictEqual(data.error, 'Sign-in is temporarily unavailable. Please try again in a few minutes.');
  assert(lines.some((l) => l.includes('"result_code":"crm_5xx"')), 'logs crm_5xx');
  const logCall = calls.find((c) => c.url === 'https://crm.test/api/public/portal-auth/log-event');
  assert(logCall, 'records a portal_auth_events row via CRM log-event');
  assert.strictEqual(logCall.options.headers['X-Portal-Secret'], 'shared-secret');
  const logged = JSON.parse(logCall.options.body);
  assert.strictEqual(logged.step, 'request_code');
  assert.strictEqual(logged.result_code, 'crm_5xx');
  assert(!JSON.stringify(logged).includes('"pw"'), 'never logs the password');

  // CRM 401 (secret mismatch) -> generic text, NOT "Invalid email or password"
  calls = mockFetch(() => upstream(401, { error: 'Unauthorized', code: 'secret_mismatch' }));
  ({ result: res, lines } = await silence(() => requestCode.onRequestPost({ request: req(body), env: ENV })));
  data = await res.json();
  assert.strictEqual(data.error, 'Sign-in is temporarily unavailable. Please try again in a few minutes.');
  assert(lines.some((l) => l.includes('"result_code":"secret_mismatch"')));
  assert(!calls.some((c) => c.url.endsWith('/log-event')), 'cannot log via CRM when the secret is wrong');

  // CRM 503 missing_config on the CRM side
  mockFetch(() => upstream(503, { error: 'Unauthorized', code: 'missing_config' }));
  ({ lines } = await silence(() => requestCode.onRequestPost({ request: req(body), env: ENV })));
  assert(lines.some((l) => l.includes('"result_code":"crm_missing_config"')));

  // CRM 502 email_send_failed -> specific friendly text
  mockFetch((url) => (url.endsWith('/log-event') ? upstream(200, {}) : upstream(502, { code: 'email_send_failed' })));
  ({ result: res, lines } = await silence(() => requestCode.onRequestPost({ request: req(body), env: ENV })));
  data = await res.json();
  assert.strictEqual(data.error, "We couldn't send your verification code. Please try again in a few minutes.");
  assert(lines.some((l) => l.includes('"result_code":"email_send_failed"')));

  // CRM unreachable
  mockFetch(() => {
    throw new Error('getaddrinfo ENOTFOUND crm.test');
  });
  ({ result: res, lines } = await silence(() => requestCode.onRequestPost({ request: req(body), env: ENV })));
  assert.strictEqual(res.status, 502);
  assert(lines.some((l) => l.includes('"result_code":"crm_unreachable"')));

  // Website missing config
  ({ result: res, lines } = await silence(() => requestCode.onRequestPost({ request: req(body), env: {} })));
  assert.strictEqual(res.status, 500);
  assert(lines.some((l) => l.includes('"result_code":"missing_config"') && l.includes('CRM_API_URL')));

  // Wrong password stays a normal 400 with the CRM's message
  mockFetch(() => upstream(400, { error: 'Invalid email or password', code: 'invalid_credentials' }));
  res = await requestCode.onRequestPost({ request: req(body), env: ENV });
  assert.strictEqual(res.status, 400);
  assert.strictEqual((await res.json()).error, 'Invalid email or password');

  global.fetch = origFetch;
  console.log('✅ PASS: request-code returns friendly text and logs distinct result codes.');
}

async function testVerifyCodeFailureCodes() {
  const origFetch = global.fetch;
  mockFetch((url) => (url.endsWith('/log-event') ? upstream(200, {}) : upstream(500, { error: 'Failed to establish login session.', code: 'session_failed' })));
  const { result: res, lines } = await silence(() =>
    verifyCode.onRequestPost({ request: req({ email: 'driver@example.com', code: '123456' }), env: ENV }),
  );
  assert.strictEqual(res.status, 500);
  assert.strictEqual((await res.json()).error, 'Sign-in is temporarily unavailable. Please try again in a few minutes.');
  assert(lines.some((l) => l.includes('"step":"verify_code"') && l.includes('"result_code":"crm_5xx"')));
  global.fetch = origFetch;
  console.log('✅ PASS: verify-code logs crm_5xx with friendly text.');
}

async function testDiagnostics() {
  const origFetch = global.fetch;

  let res = await diagnostics.onRequestGet({ request: req({}), env: {} });
  assert.strictEqual(res.status, 503, 'missing PORTAL_SHARED_SECRET');

  res = await diagnostics.onRequestGet({ request: req({}, { 'X-Portal-Secret': 'wrong' }), env: ENV });
  assert.strictEqual(res.status, 401, 'wrong secret rejected');
  const unauth = await res.json();
  assert(!('env' in unauth), 'no details without the secret');

  // Healthy
  let calls = mockFetch((url) =>
    url.endsWith('/api/health')
      ? upstream(200, { status: 'ok' })
      : upstream(200, { ok: true, code: 'ok', email_configured: true, otp_pepper_configured: true }),
  );
  res = await diagnostics.onRequestGet({ request: req({}, { 'X-Portal-Secret': 'shared-secret' }), env: ENV });
  let d = await res.json();
  assert.strictEqual(d.ok, true);
  assert.deepStrictEqual(d.env, { CRM_API_URL: 'set', PORTAL_SHARED_SECRET: 'set', SUPABASE_URL: 'unset', SUPABASE_ANON_KEY: 'unset' });
  assert.strictEqual(d.crm_host, 'crm.test');
  assert.strictEqual(d.crm_reachable.ok, true);
  assert.strictEqual(d.handshake.code, 'ok');
  assert.strictEqual(d.handshake.crm_email_configured, true);
  assert(!JSON.stringify(d).includes('shared-secret'), 'never echoes the secret');
  const hsCall = calls.find((c) => c.url.endsWith('/api/public/portal-auth/handshake'));
  assert.strictEqual(hsCall.options.headers['X-Portal-Secret'], 'shared-secret');

  // Secret mismatch at the CRM
  mockFetch((url) => (url.endsWith('/api/health') ? upstream(200, { status: 'ok' }) : upstream(401, { ok: false, code: 'secret_mismatch' })));
  res = await diagnostics.onRequestPost({ request: req({}, { 'X-Portal-Secret': 'shared-secret' }), env: ENV });
  d = await res.json();
  assert.strictEqual(d.ok, false);
  assert.strictEqual(d.handshake.code, 'secret_mismatch');

  // CRM unreachable
  mockFetch(() => {
    throw new Error('connect ETIMEDOUT');
  });
  res = await diagnostics.onRequestGet({ request: req({}, { 'X-Portal-Secret': 'shared-secret' }), env: { ...ENV, SUPABASE_URL: 'x', SUPABASE_ANON_KEY: 'y' } });
  d = await res.json();
  assert.strictEqual(d.crm_reachable.ok, false);
  assert.strictEqual(d.handshake.code, 'crm_unreachable');
  assert.strictEqual(d.env.SUPABASE_URL, 'set');

  global.fetch = origFetch;
  console.log('✅ PASS: /api/portal/diagnostics is secret-protected and reports env, reachability and handshake.');
}

(async () => {
  try {
    await testNoLegacyGenericMessage();
    await testRequestCodeFailureCodes();
    await testVerifyCodeFailureCodes();
    await testDiagnostics();
    console.log('All portal diagnostics tests passed.');
  } catch (err) {
    console.error('❌ FAIL:', err);
    process.exit(1);
  }
})();
