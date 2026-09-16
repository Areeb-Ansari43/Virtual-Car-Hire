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
assert(portalJsContent.includes('https://hhpkffratbbnwedjlebx.supabase.co'), 'assets/portal.js must hardcode https://hhpkffratbbnwedjlebx.supabase.co');
assert(portalJsContent.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'), 'assets/portal.js must hardcode valid Supabase anon key');
console.log('✅ PASS: assets/portal.js contains hardcoded project URL and real anon key.');

// 3. Test runtime evaluation of assets/portal.js logic in Node context
global.window = {};

// Mock Supabase client factory
global.window.supabase = {
  createClient: (url, key) => ({
    url,
    key
  })
};

// Execute portal.js
eval(portalJsContent);

assert.strictEqual(global.window.VCH_SUPABASE_CONFIG.url, 'https://hhpkffratbbnwedjlebx.supabase.co', 'URL should resolve to hardcoded project URL');
assert(global.window.VCH_SUPABASE_CONFIG.anonKey.startsWith('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'), 'anonKey should resolve to hardcoded JWT');

const client = global.window.initVchSupabase();
assert(client !== null, 'initVchSupabase should return client object');
assert.strictEqual(client.url, 'https://hhpkffratbbnwedjlebx.supabase.co', 'Client should be initialized with hardcoded project URL');
assert(client.key.startsWith('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'), 'Client should be initialized with hardcoded anon key');
console.log('✅ PASS: initVchSupabase initializes client with correct hardcoded URL and key at runtime.');

// 4. Test top navigation in index.html and our-fleet.html does not contain Luton PCO Hire nav item
const indexHtmlContent = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const ourFleetHtmlContent = fs.readFileSync(path.join(__dirname, '..', 'our-fleet.html'), 'utf8');

const navRegex = /<nav class="nav-links">([\s\S]*?)<\/nav>/;
const indexNavMatch = indexHtmlContent.match(navRegex);
const ourFleetNavMatch = ourFleetHtmlContent.match(navRegex);

assert(indexNavMatch && !indexNavMatch[1].includes('Luton PCO Hire'), 'index.html top nav must not contain Luton PCO Hire link');
assert(ourFleetNavMatch && !ourFleetNavMatch[1].includes('Luton PCO Hire'), 'our-fleet.html top nav must not contain Luton PCO Hire link');
console.log('✅ PASS: Top navigation in index.html and our-fleet.html does not contain Luton PCO Hire link.');

// 5. Test portal/dashboard.html features, vehicle resolution, UK plate, and RLS schema
const dashboardHtmlContent = fs.readFileSync(path.join(__dirname, '..', 'portal', 'dashboard.html'), 'utf8');

assert(dashboardHtmlContent.includes('uk-number-plate'), 'dashboard.html must contain UK number plate badge styling');
assert(dashboardHtmlContent.includes('driverGreeting'), 'dashboard.html must contain driverGreeting element for actual name greeting');
assert(dashboardHtmlContent.includes('resolveVehicleImage'), 'dashboard.html must include resolveVehicleImage helper');
assert(dashboardHtmlContent.includes('computeNextDueDate'), 'dashboard.html must include computeNextDueDate helper');
assert(dashboardHtmlContent.includes('mileageWarningBox'), 'dashboard.html must include mileage warning component');
assert(dashboardHtmlContent.includes('glanceNextMot'), 'dashboard.html must include upcoming dates panel');
assert(dashboardHtmlContent.includes('https://wa.me/442072946756'), 'dashboard.html must include WhatsApp support contact link');

// Test resolveVehicleImage logic
const fnMatch = dashboardHtmlContent.match(/function resolveVehicleImage\([\s\S]*?^    }/m);
assert(fnMatch, 'resolveVehicleImage function match must exist');
const resolveVehicleImage = new Function('makeModel', fnMatch[0] + '\nreturn resolveVehicleImage(makeModel);');
assert.strictEqual(resolveVehicleImage('Mercedes E300 AMG'), '/assets/cars/mercedes-e300-grey.png');
assert.strictEqual(resolveVehicleImage('Mercedes EQE 300'), '/assets/cars/mercedes-eqe-black.png');
assert.strictEqual(resolveVehicleImage('Mercedes Vito Tourer'), '/assets/cars/mercedes-vito-grey.webp');
assert.strictEqual(resolveVehicleImage('Hyundai Santa Fe'), '/assets/cars/hyundai-santa-fe.webp');
console.log('✅ PASS: dashboard.html UI components and resolveVehicleImage logic verified.');

// 6. Test RLS Migration file contains vehicles table policy
const rlsMigrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260330000000_driver_portal_schema_and_rls.sql');
const rlsMigrationContent = fs.readFileSync(rlsMigrationPath, 'utf8');
assert(rlsMigrationContent.includes('CREATE POLICY "Authenticated drivers can view vehicles"'), 'RLS migration must define SELECT policy on public.vehicles');
console.log('✅ PASS: RLS migration defines vehicles SELECT policy for authenticated drivers.');

console.log('\nAll configuration, CSP, and portal tests passed successfully!');
