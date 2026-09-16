const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- Testing Driver Portal Features (A1, A2, A3) ---');

// 1. Test portal/dashboard.html
const dashboardPath = path.join(__dirname, '..', 'portal', 'dashboard.html');
const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');

// Test A1: Report a Problem
assert(dashboardContent.includes('floatingReportBtn'), 'dashboard.html must contain floating Report a Problem button');
assert(dashboardContent.includes('problemModal'), 'dashboard.html must contain Report a Problem modal');
assert(dashboardContent.includes('wa.me/442072946756?text='), 'dashboard.html must use correct WhatsApp wa.me deep link');
assert(dashboardContent.includes('Emergency breakdown'), 'dashboard.html must offer Emergency breakdown choice');
assert(dashboardContent.includes('Report accident'), 'dashboard.html must offer Report accident choice');
assert(dashboardContent.includes('Driver:'), 'dashboard.html WhatsApp message must include Driver name');
assert(dashboardContent.includes('Reg:'), 'dashboard.html WhatsApp message must include vehicle Reg');

console.log('✅ PASS: A1 Report a Problem feature tests passed.');

// Test A2: Documents Section
assert(dashboardContent.includes('Hire Documents'), 'dashboard.html must contain Hire Documents card heading');
assert(dashboardContent.includes('documentsList'), 'dashboard.html must contain documentsList container');
assert(dashboardContent.includes('driver_documents'), 'dashboard.html must query driver_documents table');
assert(dashboardContent.includes('driver-documents'), 'dashboard.html must use driver-documents storage bucket');

console.log('✅ PASS: A2 Documents section tests passed.');

// Test A3: Self-Service Mileage Submission
assert(dashboardContent.includes('mileageForm'), 'dashboard.html must contain mileageForm');
assert(dashboardContent.includes('odometerPhoto'), 'dashboard.html must contain odometerPhoto file input');
assert(dashboardContent.includes('capture="environment"'), 'dashboard.html photo input must use capture="environment"');
assert(dashboardContent.includes('mileage_submissions'), 'dashboard.html must query/insert into mileage_submissions table');
assert(dashboardContent.includes('mileage-photos'), 'dashboard.html must use mileage-photos storage bucket');
assert(dashboardContent.includes('mileageSubmissionsList'), 'dashboard.html must contain mileageSubmissionsList container');

console.log('✅ PASS: A3 Self-Service Mileage Submission tests passed.');

// 2. Test Supabase Migration SQL file
const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260330000001_driver_documents_and_mileage_submissions.sql');
const migrationContent = fs.readFileSync(migrationPath, 'utf8');

assert(migrationContent.includes('public.driver_documents'), 'Migration must create driver_documents table');
assert(migrationContent.includes('public.mileage_submissions'), 'Migration must create mileage_submissions table');
assert(migrationContent.includes('ENABLE ROW LEVEL SECURITY'), 'Migration must enable RLS');
assert(migrationContent.includes('Drivers can view own driver_documents'), 'Migration must include driver_documents RLS policy');
assert(migrationContent.includes('Drivers can view own mileage_submissions'), 'Migration must include mileage_submissions SELECT RLS policy');
assert(migrationContent.includes('Drivers can insert own mileage_submissions'), 'Migration must include mileage_submissions INSERT RLS policy');
assert(migrationContent.includes('driver-documents'), 'Migration must configure driver-documents bucket');
assert(migrationContent.includes('mileage-photos'), 'Migration must configure mileage-photos bucket');

console.log('✅ PASS: Migration SQL file tests passed.');

// 3. Test _headers CSP rules
const headersPath = path.join(__dirname, '..', '_headers');
const headersContent = fs.readFileSync(headersPath, 'utf8');

assert(headersContent.includes('img-src') && headersContent.includes('https://hhpkffratbbnwedjlebx.supabase.co'), '_headers img-src must include Supabase URL');
assert(headersContent.includes('camera='), '_headers Permissions-Policy must specify camera permissions');

console.log('✅ PASS: _headers CSP tests passed.');

console.log('\nAll Driver Portal feature tests passed successfully!');
