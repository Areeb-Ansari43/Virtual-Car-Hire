const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- Testing Portal Configuration and CSP ---');

// 1. Test _headers CSP Content-Security-Policy connect-src
const headersPath = path.join(__dirname, '..', '_headers');
const headersContent = fs.readFileSync(headersPath, 'utf8');

assert(headersContent.includes('connect-src'), '_headers must contain connect-src directive');
assert(headersContent.includes('https://hhpkffratbbnwedjlebx.supabase.co'), '_headers connect-src must include https://hhpkffratbbnwedjlebx.supabase.co');
assert(headersContent.includes('wss://hhpkffratbbnwedjlebx.supabase.co'), '_headers connect-src must include wss://hhpkffratbbnwedjlebx.supabase.co');
console.log('✅ PASS: _headers CSP contains Supabase https and wss domains in connect-src.');

// 2. Test assets/portal.js content
const portalJsPath = path.join(__dirname, '..', 'assets', 'portal.js');
const portalJsContent = fs.readFileSync(portalJsPath, 'utf8');

assert(!portalJsContent.includes('placeholder-project.supabase.co'), 'assets/portal.js must not contain literal placeholder-project URL');
assert(portalJsContent.includes('https://hhpkffratbbnwedjlebx.supabase.co'), 'assets/portal.js must default to https://hhpkffratbbnwedjlebx.supabase.co');
console.log('✅ PASS: assets/portal.js eliminated placeholder-project URL and contains default project URL.');

// 3. Test runtime evaluation of assets/portal.js logic in Node context
global.window = {
  SUPABASE_KEY: 'test-anon-key-from-window-key'
};

// Mock Supabase client factory
global.window.supabase = {
  createClient: (url, key) => ({
    url,
    key
  })
};

// Execute portal.js
eval(portalJsContent);

assert.strictEqual(global.window.VCH_SUPABASE_CONFIG.url, 'https://hhpkffratbbnwedjlebx.supabase.co', 'Default URL should resolve to real project URL');
assert.strictEqual(global.window.VCH_SUPABASE_CONFIG.anonKey, 'test-anon-key-from-window-key', 'SUPABASE_KEY should be picked up as anonKey fallback');

const client = global.window.initVchSupabase();
assert(client !== null, 'initVchSupabase should return client object');
assert.strictEqual(client.url, 'https://hhpkffratbbnwedjlebx.supabase.co', 'Client should be initialized with real project URL');
assert.strictEqual(client.key, 'test-anon-key-from-window-key', 'Client should be initialized with resolved anonKey');
console.log('✅ PASS: initVchSupabase initializes client with correct default URL and resolved key at runtime.');

// 4. Test Loud Error Logging & Return Null on Missing/Placeholder Keys
let loggedErrors = [];
const originalConsoleError = console.error;
console.error = (...args) => {
  loggedErrors.push(args.join(' '));
};

global.window.vchSupabaseClient = null;
global.window.VCH_SUPABASE_CONFIG.anonKey = 'placeholder-anon-key';
const failedClientPlaceholder = global.window.initVchSupabase();

assert.strictEqual(failedClientPlaceholder, null, 'initVchSupabase should return null when key is placeholder-anon-key');
assert(loggedErrors.some(msg => msg.includes('SUPABASE_ANON_KEY')), 'Missing/placeholder anonKey should log an explicit console error');

loggedErrors = [];
global.window.vchSupabaseClient = null;
global.window.VCH_SUPABASE_CONFIG.anonKey = '';
const failedClientEmpty = global.window.initVchSupabase();

assert.strictEqual(failedClientEmpty, null, 'initVchSupabase should return null when key is empty');
assert(loggedErrors.some(msg => msg.includes('SUPABASE_ANON_KEY')), 'Empty anonKey should log an explicit console error');

console.error = originalConsoleError;
console.log('✅ PASS: Loud error logged and null returned when anonKey is missing or placeholder.');

// 5. Test top navigation in index.html and our-fleet.html does not contain Luton PCO Hire nav item
const indexHtmlContent = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const ourFleetHtmlContent = fs.readFileSync(path.join(__dirname, '..', 'our-fleet.html'), 'utf8');

const navRegex = /<nav class="nav-links">([\s\S]*?)<\/nav>/;
const indexNavMatch = indexHtmlContent.match(navRegex);
const ourFleetNavMatch = ourFleetHtmlContent.match(navRegex);

assert(indexNavMatch && !indexNavMatch[1].includes('Luton PCO Hire'), 'index.html top nav must not contain Luton PCO Hire link');
assert(ourFleetNavMatch && !ourFleetNavMatch[1].includes('Luton PCO Hire'), 'our-fleet.html top nav must not contain Luton PCO Hire link');
console.log('✅ PASS: Top navigation in index.html and our-fleet.html does not contain Luton PCO Hire link.');

console.log('\nAll configuration and CSP tests passed successfully!');
