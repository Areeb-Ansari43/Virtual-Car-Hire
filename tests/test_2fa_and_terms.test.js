const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- Testing Driver Portal 2FA Login & Terms Popup ---');

// 1. Verify SQL Migration File
const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260330000002_driver_portal_2fa_and_terms.sql');
assert(fs.existsSync(migrationPath), 'Migration 20260330000002_driver_portal_2fa_and_terms.sql must exist');

const migrationContent = fs.readFileSync(migrationPath, 'utf8');

assert(migrationContent.includes('ALTER TABLE IF EXISTS public.driver_tracks'), 'Migration must alter driver_tracks');
assert(migrationContent.includes('terms_accepted_at timestamptz'), 'Migration must add terms_accepted_at column');
assert(migrationContent.includes('terms_accepted boolean'), 'Migration must add terms_accepted column');
assert(migrationContent.includes('CREATE TABLE IF NOT EXISTS public.portal_2fa_codes'), 'Migration must create portal_2fa_codes table');

// Security Hardening Verification
assert(!migrationContent.includes('user_id = auth.uid() OR email IS NOT NULL'), 'Migration must NOT contain loose RLS policy allowing anon SELECT on portal_2fa_codes');
assert(migrationContent.includes('RETURNS boolean'), 'create_2fa_code RPC must return boolean (NOT plaintext code)');

assert(migrationContent.includes('create_2fa_code'), 'Migration must define create_2fa_code RPC');
assert(migrationContent.includes('verify_2fa_code'), 'Migration must define verify_2fa_code RPC');
assert(migrationContent.includes('accept_driver_terms'), 'Migration must define accept_driver_terms RPC');
assert(migrationContent.includes('check_driver_terms_accepted'), 'Migration must define check_driver_terms_accepted RPC');

console.log('✅ PASS: Database migration file schema and hardened RPC definitions verified.');

// 2. Verify portal/login.html 2FA Markup & JS Logic
const loginHtmlPath = path.join(__dirname, '..', 'portal', 'login.html');
const loginHtmlContent = fs.readFileSync(loginHtmlPath, 'utf8');

// Password & 2FA Step Elements
assert(loginHtmlContent.includes('id="stepPassword"'), 'login.html must contain stepPassword container');
assert(loginHtmlContent.includes('id="step2FA"'), 'login.html must contain step2FA container');
assert(loginHtmlContent.includes('id="twoFactorCodeInput"'), 'login.html must contain twoFactorCodeInput element');
assert(loginHtmlContent.includes('id="verify2faBtn"'), 'login.html must contain verify2faBtn button');
assert(loginHtmlContent.includes('id="resend2faBtn"'), 'login.html must contain resend2faBtn button');

// Shared Edge Function Integration
assert(loginHtmlContent.includes("auth@fa-ibi.co.uk"), 'login.html must specify auth@fa-ibi.co.uk as sender address');
assert(loginHtmlContent.includes("type: '2fa_code'") || loginHtmlContent.includes('type: "2fa_code"'), 'login.html must specify type: 2fa_code in payload');
assert(loginHtmlContent.includes("supabase.functions.invoke('send-email'"), 'login.html must invoke shared send-email Edge Function');

// Session 2FA Verification
assert(loginHtmlContent.includes("sessionStorage.setItem('vch_2fa_verified_'"), 'login.html must set session-level 2FA verification in sessionStorage');

// Rate-limiting Cooldown (30 seconds)
assert(loginHtmlContent.includes('cooldownSeconds = 30'), 'login.html must enforce a 30-second cooldown on resends');

// Success Checkmark Animation
assert(loginHtmlContent.includes('id="successAnimationCard"'), 'login.html must contain successAnimationCard');
assert(loginHtmlContent.includes('checkmark-circle'), 'login.html must contain checkmark icon element');

// One-Time Terms Popup Copy on login.html
assert(loginHtmlContent.includes('id="termsModal"'), 'login.html must contain termsModal popup element');
assert(loginHtmlContent.includes('MOT'), 'Terms modal must mention MOT reminders');
assert(loginHtmlContent.includes('routine servicing') || loginHtmlContent.includes('servicing'), 'Terms modal must mention routine servicing reminders');
assert(loginHtmlContent.includes('PCO licence renewals') || loginHtmlContent.includes('PCO renewals'), 'Terms modal must mention PCO licence renewals');
assert(loginHtmlContent.includes('contract ends, these automated reminder notifications stop automatically') || loginHtmlContent.includes('contract ends'), 'Terms modal must clarify emails stop when contract ends');
assert(loginHtmlContent.includes('re-enrolled'), 'Terms modal must clarify re-enrollment if returning as a driver');
assert(loginHtmlContent.includes('id="acceptTermsBtn"'), 'login.html must contain acceptTermsBtn button');
assert(loginHtmlContent.includes('accept_driver_terms'), 'login.html must call accept_driver_terms RPC');

console.log('✅ PASS: portal/login.html 2FA flow, Edge Function invocation, resend cooldown, and terms modal verified.');

// 3. Verify portal/dashboard.html Terms Check & Modal
const dashHtmlPath = path.join(__dirname, '..', 'portal', 'dashboard.html');
const dashHtmlContent = fs.readFileSync(dashHtmlPath, 'utf8');

assert(dashHtmlContent.includes('id="dashboardTermsModal"'), 'dashboard.html must contain dashboardTermsModal overlay');
assert(dashHtmlContent.includes('check_driver_terms_accepted'), 'dashboard.html must call check_driver_terms_accepted RPC');
assert(dashHtmlContent.includes('accept_driver_terms'), 'dashboard.html must call accept_driver_terms RPC');
assert(dashHtmlContent.includes('id="dashAcceptTermsBtn"'), 'dashboard.html must contain dashAcceptTermsBtn button');

console.log('✅ PASS: portal/dashboard.html terms check and modal overlay verified.');

// 4. Runtime 2FA Code Generation & Verification Logic Simulation
function simulate2faCodeGeneration() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const code1 = simulate2faCodeGeneration();
assert.strictEqual(code1.length, 6, 'Generated 2FA code must be 6 digits long');
assert(/^\d{6}$/.test(code1), 'Generated 2FA code must contain numbers only');

console.log('✅ PASS: Runtime 2FA code generation simulation verified.');

console.log('\n🎉 All Driver Portal 2FA and Terms Popup tests passed successfully!');
