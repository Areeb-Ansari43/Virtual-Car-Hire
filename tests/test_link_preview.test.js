const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- Running Link Preview & Technical SEO Verification ---');

// 1. Verify link-preview.js file exists and contains all required keys
const previewJs = fs.readFileSync('assets/link-preview.js', 'utf8');
const expectedKeys = [
  '/', '/our-fleet', '/how-it-works', '/support', '/areas-we-cover', '/about-us', '/contact-us', '/pco-car-hire-luton',
  '/cars/tesla-model-3', '/cars/mercedes-eqe', '/cars/mercedes-eqs', '/cars/mercedes-e300', '/cars/mercedes-e220',
  '/cars/mercedes-v-class', '/cars/mercedes-vito', '/cars/toyota-corolla-estate', '/cars/toyota-auris-estate',
  '/cars/toyota-prius', '/cars/jaguar-i-pace', '/cars/hyundai-ioniq', '/cars/hyundai-santa-fe', '/cars/mg5-ev',
  '/cars/mg-s9-phev-suv', '/cars/ford-tourneo-custom'
];

expectedKeys.forEach(k => {
  assert(previewJs.includes(`'${k}':`) || previewJs.includes(`"${k}":`), `link-preview.js must contain metadata for key ${k}`);
});
console.log('✅ PASS: link-preview.js contains metadata for all core pages and vehicle models.');

// 2. Verify all public HTML pages include link-preview.js
const excludedHtml = ['google5d00861e8f9fe673.html', 'test.html'];
const htmlFiles = [
  ...fs.readdirSync('.').filter(f => f.endsWith('.html') && !excludedHtml.includes(f)),
  ...fs.readdirSync('cars').filter(f => f.endsWith('.html')).map(f => `cars/${f}`)
];

htmlFiles.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  assert(content.includes('link-preview.js'), `${f} must include link-preview.js script tag`);
});
console.log('✅ PASS: All HTML pages include assets/link-preview.js.');

// 3. Verify _redirects contains legacy vehicle redirects
const redirects = fs.readFileSync('_redirects', 'utf8');
assert(redirects.includes('/tesla-model-3 /cars/tesla-model-3 301'), '_redirects must contain /tesla-model-3 301 redirect');
assert(redirects.includes('/hyundai-ioing /cars/hyundai-ioniq 301'), '_redirects must contain /hyundai-ioing 301 redirect');
console.log('✅ PASS: _redirects contains legacy vehicle paths for Google Search Console crawlability.');

console.log('\nAll link preview and technical SEO verification tests passed successfully!');
