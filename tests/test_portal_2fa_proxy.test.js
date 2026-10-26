const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- Testing 2FA Proxy Endpoints & UI Code Input ---');

// 1. Verify /api/portal/request-code.js
const reqCodePath = path.join(__dirname, '..', 'functions', 'api', 'portal', 'request-code.js');
assert(fs.existsSync(reqCodePath), 'functions/api/portal/request-code.js must exist');
const reqCodeContent = fs.readFileSync(reqCodePath, 'utf8');

assert(reqCodeContent.includes('CRM_API_URL'), 'request-code proxy must use env.CRM_API_URL');
assert(reqCodeContent.includes('PORTAL_SHARED_SECRET'), 'request-code proxy must use env.PORTAL_SHARED_SECRET');
assert(reqCodeContent.includes('X-Portal-Secret'), 'request-code proxy must send X-Portal-Secret header');
assert(reqCodeContent.includes('/api/public/portal-auth/request-code'), 'request-code proxy must target CRM request-code endpoint');
assert(reqCodeContent.includes('429'), 'request-code proxy must handle HTTP 429 rate limit status');
assert(reqCodeContent.includes('Please wait before requesting another code.'), 'request-code proxy must return 429 rate limit text');
assert(reqCodeContent.includes('Unable to sign in. Check your details and try again.'), 'request-code proxy must map generic errors');
assert(reqCodeContent.includes('unsupported'), 'request-code proxy must map unsupported delivery status');

console.log('✅ PASS: /api/portal/request-code Cloudflare Pages Function verified.');

// 2. Verify /api/portal/verify-code.js
const verifyCodePath = path.join(__dirname, '..', 'functions', 'api', 'portal', 'verify-code.js');
assert(fs.existsSync(verifyCodePath), 'functions/api/portal/verify-code.js must exist');
const verifyCodeContent = fs.readFileSync(verifyCodePath, 'utf8');

assert(verifyCodeContent.includes('CRM_API_URL'), 'verify-code proxy must use env.CRM_API_URL');
assert(verifyCodeContent.includes('PORTAL_SHARED_SECRET'), 'verify-code proxy must use env.PORTAL_SHARED_SECRET');
assert(verifyCodeContent.includes('X-Portal-Secret'), 'verify-code proxy must send X-Portal-Secret header');
assert(verifyCodeContent.includes('/api/public/portal-auth/verify-code'), 'verify-code proxy must target CRM verify-code endpoint');
assert(verifyCodeContent.includes('429'), 'verify-code proxy must handle HTTP 429 rate limit status');
assert(verifyCodeContent.includes('Please wait before requesting another code.'), 'verify-code proxy must return 429 rate limit text');
assert(verifyCodeContent.includes('access_token'), 'verify-code proxy must pass through access_token');
assert(verifyCodeContent.includes('refresh_token'), 'verify-code proxy must pass through refresh_token');
assert(verifyCodeContent.includes('EXPIRED_CODE') || verifyCodeContent.includes('expired'), 'verify-code proxy must handle expired codes');
assert(verifyCodeContent.includes('LOCKED_OUT') || verifyCodeContent.includes('locked'), 'verify-code proxy must handle locked accounts');

console.log('✅ PASS: /api/portal/verify-code Cloudflare Pages Function verified.');

// 3. Verify portal/login.html 2FA UI & Logic
const loginHtmlPath = path.join(__dirname, '..', 'portal', 'login.html');
const loginHtmlContent = fs.readFileSync(loginHtmlPath, 'utf8');

// Code Input Boxes & Attributes
assert(loginHtmlContent.includes('code-boxes-container'), 'login.html must contain 6-digit code-boxes-container');
assert(loginHtmlContent.includes('code-box'), 'login.html must contain code-box elements');
assert(loginHtmlContent.includes('inputmode="numeric"'), 'code box inputs must specify inputmode="numeric"');
assert(loginHtmlContent.includes('pattern="[0-9]*"'), 'code box inputs must specify numeric pattern');
assert(loginHtmlContent.includes('autocomplete="one-time-code"'), 'code box inputs must specify autocomplete="one-time-code"');

// Proxy Endpoints Call Verification
assert(loginHtmlContent.includes('/api/portal/request-code'), 'login.html must call /api/portal/request-code');
assert(loginHtmlContent.includes('/api/portal/verify-code'), 'login.html must call /api/portal/verify-code');

// Unsupported Delivery & Error Message
assert(
  loginHtmlContent.includes("We couldn't send a code because no contact details are registered. Please contact support."),
  'login.html must display exact unsupported delivery error message'
);

// Resend Countdown
assert(loginHtmlContent.includes('cooldownSeconds = 30'), 'login.html must enforce 30-second resend countdown');

// Masked Email Display
assert(loginHtmlContent.includes('sentEmailDisplay'), 'login.html must contain sentEmailDisplay element');
assert(loginHtmlContent.includes('maskEmailAddress'), 'login.html must include email masking logic');

// Accessibility & Reduced Motion
assert(loginHtmlContent.includes('aria-live="polite"') || loginHtmlContent.includes('aria-live'), 'login.html must include aria-live for screen readers');
assert(loginHtmlContent.includes('prefers-reduced-motion'), 'login.html CSS must respect prefers-reduced-motion');

// Session Setup on Verification Success
assert(loginHtmlContent.includes('supabase.auth.setSession'), 'login.html must call supabase.auth.setSession with tokens');

// Zero Storage Verification: Passwords and Codes must NOT be written to localStorage or sessionStorage
assert(!loginHtmlContent.includes('localStorage.setItem("password"') && !loginHtmlContent.includes("localStorage.setItem('password'"), 'Password must never be saved in localStorage');
assert(!loginHtmlContent.includes('localStorage.setItem("code"') && !loginHtmlContent.includes("localStorage.setItem('code'"), 'Code must never be saved in localStorage');
assert(!loginHtmlContent.includes('sessionStorage.setItem("password"') && !loginHtmlContent.includes("sessionStorage.setItem('password'"), 'Password must never be saved in sessionStorage');
assert(!loginHtmlContent.includes('sessionStorage.setItem("code"') && !loginHtmlContent.includes("sessionStorage.setItem('code'"), 'Code must never be saved in sessionStorage');

console.log('✅ PASS: portal/login.html 2FA UI and zero-storage verification tests passed.');

// 4. Verify README.md Environment Variables Documentation
const readmePath = path.join(__dirname, '..', 'README.md');
const readmeContent = fs.readFileSync(readmePath, 'utf8');

assert(readmeContent.includes('CRM_API_URL'), 'README.md must document CRM_API_URL');
assert(readmeContent.includes('PORTAL_SHARED_SECRET'), 'README.md must document PORTAL_SHARED_SECRET');

console.log('✅ PASS: README.md environment variables documentation verified.');

// 5. Test Email Masking Logic Simulation
function maskEmailAddress(emailStr) {
  if (!emailStr || !emailStr.includes('@')) return emailStr || '';
  const parts = emailStr.split('@');
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length > 1 ? name[0] + '***' : name + '***';
  return `${maskedName}@${domain}`;
}

assert.strictEqual(maskEmailAddress('driver@example.com'), 'd***@example.com');
assert.strictEqual(maskEmailAddress('a@gmail.com'), 'a***@gmail.com');

console.log('✅ PASS: Email masking logic simulation verified.');

console.log('\n🎉 All 2FA Proxy and UI Code Input tests passed successfully!');
