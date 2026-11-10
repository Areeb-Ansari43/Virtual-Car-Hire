const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- Testing Driver Portal 6-Box Code Input & Authentication Flow ---');

const loginHtmlPath = path.join(__dirname, '..', 'portal', 'login.html');
assert(fs.existsSync(loginHtmlPath), 'portal/login.html must exist');
const loginHtml = fs.readFileSync(loginHtmlPath, 'utf8');

// 1. Check for 6 individual input boxes
const otpInputMatches = loginHtml.match(/class="otp-input"/g);
assert(otpInputMatches && otpInputMatches.length === 6, 'login.html must contain exactly six .otp-input elements');

// 2. Check input attributes: numeric keypad on mobile & autocomplete="one-time-code"
assert(loginHtml.includes('inputmode="numeric"'), 'otp inputs must have inputmode="numeric"');
assert(loginHtml.includes('pattern="[0-9]*"'), 'otp inputs must have numeric pattern');
assert(loginHtml.includes('autocomplete="one-time-code"'), 'otp inputs must have autocomplete="one-time-code"');
// Boxes accept a whole code so email/SMS autofill (which fills one box) is spread across all six.
assert((loginHtml.match(/class="otp-input"[^>]*maxlength="6"/g) || []).length === 6, 'otp inputs must accept a full autofilled code');
assert(loginHtml.includes('function fillDigits('), 'Script must spread an autofilled/pasted code across the boxes');
// Typing / complete / wrong / correct animations
for (const cls of ['otpPop', 'otpWave', 'otpShake', 'otpFlip']) assert(loginHtml.includes(`@keyframes ${cls}`), `missing ${cls} animation`);
// Keep me signed in + password reset step
assert(loginHtml.includes('id="rememberDevice"'), 'login must offer Keep me signed in');
assert(loginHtml.includes("localStorage.setItem('vch_2fa_verified_'"), 'verified device must be remembered across browser restarts');
assert(loginHtml.includes('id="resetForm"') && loginHtml.includes('auth.updateUser({ password'), 'reset link must let the driver set a new password');
assert(loginHtml.includes("'/portal/login?reset=1'"), 'reset email must link back to the new-password step');

// 3. Auto-advance and backspace handling
assert(loginHtml.includes('otpInputs[idx + 1].focus()'), 'Script must auto-advance to next input');
assert(loginHtml.includes('otpInputs[idx - 1].focus()'), 'Script must navigate to previous input on Backspace');

// 4. Paste handling
assert(loginHtml.includes("addEventListener('paste'"), 'Script must have paste event listener on OTP inputs');
assert(loginHtml.includes('clipboardData'), 'Script must extract pasted clipboard data');

// 5. Masked email display
assert(loginHtml.includes('id="sentEmailDisplay"'), 'login.html must display masked email container');
assert(loginHtml.includes('function maskEmail('), 'login.html must define email masking logic');

// 6. Resend link with 30-second countdown
assert(loginHtml.includes('id="resend2faBtn"'), 'login.html must contain resend button/link');
assert(loginHtml.includes('id="cooldownText"'), 'login.html must contain cooldownText element');
assert(loginHtml.includes('cooldownSeconds = 30'), 'login.html must enforce 30-second cooldown timer');

// 7. Clear messages for wrong, expired, and locked codes & 429
assert(loginHtml.includes('Please wait before requesting another code.'), 'Must handle HTTP 429 message');
assert(loginHtml.includes('Incorrect verification code'), 'Must handle wrong code message');

// 8. Session setup: calls supabase.auth.setSession({ access_token, refresh_token })
assert(loginHtml.includes('supabase.auth.setSession'), 'Must call supabase.auth.setSession on successful verification');
assert(loginHtml.includes('access_token: session.access_token'), 'Must pass access_token to setSession');
assert(loginHtml.includes('refresh_token: session.refresh_token'), 'Must pass refresh_token to setSession');

// 9. Security: Never store password or code in storage
assert(!loginHtml.includes("localStorage.setItem('password'"), 'Must not store password in localStorage');
assert(!loginHtml.includes("sessionStorage.setItem('password'"), 'Must not store password in sessionStorage');
assert(!loginHtml.includes("localStorage.setItem('code'"), 'Must not store code in localStorage');
assert(!loginHtml.includes("sessionStorage.setItem('code'"), 'Must not store code in sessionStorage');

// 10. Calls this site's own endpoints only
assert(loginHtml.includes("fetch('/api/portal/request-code'"), 'Must call /api/portal/request-code');
assert(loginHtml.includes("fetch('/api/portal/verify-code'"), 'Must call /api/portal/verify-code');
assert(!loginHtml.includes('supabase.auth.signInWithPassword'), 'Must not call supabase.auth.signInWithPassword directly');
assert(!loginHtml.includes("supabase.functions.invoke('send-email'"), 'Must not invoke send-email Edge Function directly');

console.log('✅ PASS: All 6-box code input and authentication flow requirements verified.');
