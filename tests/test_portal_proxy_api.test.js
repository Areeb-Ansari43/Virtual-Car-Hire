const assert = require('assert');

// Test Cloudflare Pages Proxy Functions for Driver Portal 2FA:
// /api/portal/request-code and /api/portal/verify-code

const requestCodeModule = require('../functions/api/portal/request-code.js');
const verifyCodeModule = require('../functions/api/portal/verify-code.js');

async function testRequestCodeProxy() {
  console.log('--- Testing /api/portal/request-code Proxy Function ---');

  // 1. Rejects non-POST methods
  const getReq = { method: 'GET' };
  const getRes = await requestCodeModule.onRequestPost({ request: getReq, env: {} });
  assert.strictEqual(getRes.status, 405, 'Should return 405 for non-POST');

  // 2. Returns 400 for invalid/missing body
  const badReq = {
    method: 'POST',
    json: async () => ({ email: 'bad-email', password: '' })
  };
  const badRes = await requestCodeModule.onRequestPost({ request: badReq, env: { CRM_API_URL: 'http://crm.local', PORTAL_SHARED_SECRET: 'sec' } });
  assert.strictEqual(badRes.status, 400, 'Should return 400 for bad email/password');

  // 3. Returns 500 when env vars missing
  const missingEnvReq = {
    method: 'POST',
    json: async () => ({ email: 'driver@example.com', password: 'password123' })
  };
  const missingEnvRes = await requestCodeModule.onRequestPost({ request: missingEnvReq, env: {} });
  assert.strictEqual(missingEnvRes.status, 500, 'Should return 500 when CRM_API_URL is missing');

  // 4. Forwards headers X-Portal-Secret and X-Client-IP and returns 200 on success
  let forwardedUrl = '';
  let forwardedHeaders = {};
  let forwardedBody = '';

  const origFetch = global.fetch;
  global.fetch = async (url, options) => {
    forwardedUrl = url;
    forwardedHeaders = options.headers;
    forwardedBody = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true, maskedEmail: 'd***r@example.com' })
    };
  };

  const headerMap = new Map([
    ['cf-connecting-ip', '203.0.113.195']
  ]);
  const validReq = {
    method: 'POST',
    headers: {
      get: (k) => headerMap.get(k.toLowerCase()) || null
    },
    json: async () => ({ email: 'driver@example.com', password: 'secretpassword' })
  };

  const validRes = await requestCodeModule.onRequestPost({
    request: validReq,
    env: {
      CRM_API_URL: 'https://backend-crm.internal',
      PORTAL_SHARED_SECRET: 'test-secret-123'
    }
  });

  assert.strictEqual(validRes.status, 200, 'Should return 200 on successful request-code');
  assert.strictEqual(forwardedUrl, 'https://backend-crm.internal/api/public/portal-auth/request-code');
  assert.strictEqual(forwardedHeaders['X-Portal-Secret'], 'test-secret-123');
  assert.strictEqual(forwardedHeaders['X-Client-IP'], '203.0.113.195');
  assert.strictEqual(forwardedBody.email, 'driver@example.com');
  assert.strictEqual(forwardedBody.password, 'secretpassword');

  const validData = await validRes.json();
  assert.strictEqual(validData.success, true);
  assert.strictEqual(validData.maskedEmail, 'd***r@example.com');

  // 5. Handles HTTP 429 rate limit correctly
  global.fetch = async () => ({
    ok: false,
    status: 429,
    json: async () => ({ error: 'Too many requests' })
  });

  const rateLimitRes = await requestCodeModule.onRequestPost({
    request: validReq,
    env: {
      CRM_API_URL: 'https://backend-crm.internal',
      PORTAL_SHARED_SECRET: 'test-secret-123'
    }
  });

  assert.strictEqual(rateLimitRes.status, 429, 'Should return 429 status');
  const rateLimitData = await rateLimitRes.json();
  assert.strictEqual(rateLimitData.error, 'Please wait before requesting another code.');

  // Restore fetch
  global.fetch = origFetch;
  console.log('✅ PASS: /api/portal/request-code proxy tests passed.');
}

async function testVerifyCodeProxy() {
  console.log('--- Testing /api/portal/verify-code Proxy Function ---');

  // 1. Rejects non-POST methods
  const getReq = { method: 'GET' };
  const getRes = await verifyCodeModule.onRequestPost({ request: getReq, env: {} });
  assert.strictEqual(getRes.status, 405, 'Should return 405 for non-POST');

  // 2. Returns 400 for invalid code format (not 6 digits)
  const badReq = {
    method: 'POST',
    json: async () => ({ email: 'driver@example.com', code: '123' })
  };
  const badRes = await verifyCodeModule.onRequestPost({ request: badReq, env: { CRM_API_URL: 'http://crm.local', PORTAL_SHARED_SECRET: 'sec' } });
  assert.strictEqual(badRes.status, 400, 'Should return 400 for code length != 6');

  // 3. Forwards headers and returns session on success
  const origFetch = global.fetch;
  let forwardedUrl = '';
  let forwardedHeaders = {};
  let forwardedBody = '';

  global.fetch = async (url, options) => {
    forwardedUrl = url;
    forwardedHeaders = options.headers;
    forwardedBody = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        session: {
          access_token: 'fake-access-jwt',
          refresh_token: 'fake-refresh-jwt'
        },
        user: { id: 'usr-123', email: 'driver@example.com' }
      })
    };
  };

  const validReq = {
    method: 'POST',
    headers: {
      get: (k) => (k.toLowerCase() === 'cf-connecting-ip' ? '198.51.100.44' : null)
    },
    json: async () => ({ email: 'driver@example.com', code: '654321' })
  };

  const validRes = await verifyCodeModule.onRequestPost({
    request: validReq,
    env: {
      CRM_API_URL: 'https://backend-crm.internal',
      PORTAL_SHARED_SECRET: 'test-secret-123'
    }
  });

  assert.strictEqual(validRes.status, 200);
  assert.strictEqual(forwardedUrl, 'https://backend-crm.internal/api/public/portal-auth/verify-code');
  assert.strictEqual(forwardedHeaders['X-Portal-Secret'], 'test-secret-123');
  assert.strictEqual(forwardedHeaders['X-Client-IP'], '198.51.100.44');
  assert.strictEqual(forwardedBody.email, 'driver@example.com');
  assert.strictEqual(forwardedBody.code, '654321');

  const validData = await validRes.json();
  assert.strictEqual(validData.success, true);
  assert.strictEqual(validData.session.access_token, 'fake-access-jwt');
  assert.strictEqual(validData.session.refresh_token, 'fake-refresh-jwt');

  // 4. Handles wrong / expired / locked error mapping
  global.fetch = async () => ({
    ok: false,
    status: 400,
    json: async () => ({ error: 'Verification code has expired' })
  });

  const expiredRes = await verifyCodeModule.onRequestPost({
    request: validReq,
    env: { CRM_API_URL: 'https://backend-crm.internal', PORTAL_SHARED_SECRET: 'sec' }
  });
  const expiredData = await expiredRes.json();
  assert(expiredData.error.toLowerCase().includes('expired'));

  // 429 Rate limiting
  global.fetch = async () => ({
    ok: false,
    status: 429,
    json: async () => ({ error: 'Too many requests' })
  });

  const rateLimitRes = await verifyCodeModule.onRequestPost({
    request: validReq,
    env: { CRM_API_URL: 'https://backend-crm.internal', PORTAL_SHARED_SECRET: 'sec' }
  });
  assert.strictEqual(rateLimitRes.status, 429);
  const rateLimitData = await rateLimitRes.json();
  assert.strictEqual(rateLimitData.error, 'Please wait before requesting another code.');

  // Restore fetch
  global.fetch = origFetch;
  console.log('✅ PASS: /api/portal/verify-code proxy tests passed.');
}

async function run() {
  await testRequestCodeProxy();
  await testVerifyCodeProxy();
  console.log('\n🎉 All Portal Proxy API tests passed successfully!');
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
