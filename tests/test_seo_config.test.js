const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- Running SEO and Google Indexing Verification Tests ---');

const CANONICAL_DOMAIN = 'https://www.virtual-carhire.co.uk';

// 1. Verify robots.txt
const robotsPath = path.join(__dirname, '..', 'robots.txt');
const robotsContent = fs.readFileSync(robotsPath, 'utf8');

assert(!robotsContent.includes('virtualcarhire.pages.dev'), 'robots.txt must not contain pages.dev domain');
assert(robotsContent.includes(`Sitemap: ${CANONICAL_DOMAIN}/sitemap.xml`), 'robots.txt must point to canonical sitemap.xml');
console.log('✅ PASS: robots.txt contains correct canonical sitemap directive.');

// 2. Verify sitemap.xml
const sitemapPath = path.join(__dirname, '..', 'sitemap.xml');
const sitemapContent = fs.readFileSync(sitemapPath, 'utf8');

assert(!sitemapContent.includes('virtualcarhire.pages.dev'), 'sitemap.xml must not contain pages.dev domain');
assert(!sitemapContent.includes('localhost'), 'sitemap.xml must not contain localhost domain');

const locMatches = (sitemapContent.match(/<loc>(.*?)<\/loc>/g) || []).map(l => l.replace(/<\/?loc>/g, ''));
assert(locMatches.length >= 20, 'sitemap.xml should contain at least 20 important page URLs');

locMatches.forEach(url => {
  assert(url.startsWith(CANONICAL_DOMAIN), `Sitemap URL ${url} must start with ${CANONICAL_DOMAIN}`);
});

// Check all vehicle pages are included in sitemap.xml
const carFiles = fs.readdirSync(path.join(__dirname, '..', 'cars')).filter(f => f.endsWith('.html'));
carFiles.forEach(car => {
  const slug = car.replace('.html', '');
  const carUrl = `${CANONICAL_DOMAIN}/cars/${slug}`;
  assert(locMatches.includes(carUrl), `sitemap.xml must contain vehicle page URL: ${carUrl}`);
});

console.log('✅ PASS: sitemap.xml contains valid canonical URLs for all important pages and vehicles.');

// 3. Verify HTML pages metadata, syntax, and structured data
const publicPages = [
  'index.html', 'our-fleet.html', 'about-us.html', 'contact-us.html',
  'pco-car-hire-luton.html', 'whatsapp.html', 'emergency.html',
  'privacy-policy.html', 'cookie-policy.html', 'thank-you.html', '404.html',
  ...carFiles.map(c => `cars/${c}`)
];

const titles = new Set();
const descriptions = new Set();

publicPages.forEach(relPath => {
  const filePath = path.join(__dirname, '..', relPath);
  assert(fs.existsSync(filePath), `File must exist: ${relPath}`);

  const content = fs.readFileSync(filePath, 'utf8');

  // Verify no malformed tag closing syntax like >> or > />
  assert(!content.includes('>>'), `${relPath} contains malformed >> tag syntax`);
  assert(!/>\s*\/>/.test(content), `${relPath} contains malformed > /> tag syntax`);

  // Must not contain pages.dev SEO references (except allowed deployment config like _redirects)
  const headMatch = content.match(/<head>([\s\S]*?)<\/head>/i);
  assert(headMatch, `${relPath} must have a <head> section`);
  assert(!headMatch[1].includes('virtualcarhire.pages.dev'), `${relPath} head section must not contain pages.dev URLs`);

  // Check Title
  const titleMatch = content.match(/<title>(.*?)<\/title>/i);
  assert(titleMatch && titleMatch[1].trim().length > 0, `${relPath} must have a non-empty <title>`);
  assert(!titles.has(titleMatch[1]), `Duplicate title found in ${relPath}: "${titleMatch[1]}"`);
  titles.add(titleMatch[1]);

  // Check Description
  const descMatch = content.match(/<meta\s+name="description"\s+content="(.*?)"/i);
  assert(descMatch && descMatch[1].trim().length > 0, `${relPath} must have a non-empty meta description`);
  assert(!descriptions.has(descMatch[1]), `Duplicate description found in ${relPath}: "${descMatch[1]}"`);
  descriptions.add(descMatch[1]);

  // Check Canonical
  const canonicalMatch = content.match(/<link\s+rel="canonical"\s+href="(.*?)"/i);
  assert(canonicalMatch, `${relPath} must have a canonical tag`);
  assert(canonicalMatch[1].startsWith(CANONICAL_DOMAIN), `${relPath} canonical tag must start with ${CANONICAL_DOMAIN}`);

  // Check OpenGraph URL
  const ogUrlMatch = content.match(/<meta\s+property="og:url"\s+content="(.*?)"/i);
  if (ogUrlMatch) {
    assert(ogUrlMatch[1].startsWith(CANONICAL_DOMAIN), `${relPath} og:url must start with ${CANONICAL_DOMAIN}`);
  }

  // Verify JSON-LD JSON validity and no pages.dev URLs in schema
  const jsonLdMatches = content.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi) || [];
  jsonLdMatches.forEach((m, idx) => {
    const jsonStr = m.replace(/<script type="application\/ld\+json">/i, '').replace(/<\/script>/i, '').trim();
    assert(!jsonStr.includes('virtualcarhire.pages.dev'), `${relPath} JSON-LD block ${idx} must not contain pages.dev`);
    try {
      JSON.parse(jsonStr);
    } catch (e) {
      assert.fail(`Invalid JSON-LD in ${relPath} block ${idx}: ${e.message}`);
    }
  });
});

console.log('✅ PASS: All HTML pages have valid syntax, unique titles, unique meta descriptions, valid canonicals, and valid structured data.');

console.log('\nAll SEO and Google Indexing verification tests passed successfully!');
