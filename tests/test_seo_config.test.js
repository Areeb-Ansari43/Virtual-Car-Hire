const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- Running SEO and Google Indexing Verification Tests ---');

const CANONICAL_DOMAIN = 'https://www.virtual-carhire.co.uk';
const TODAY_DATE = '2026-09-21';

// 1. Verify robots.txt
const robotsPath = path.join(__dirname, '..', 'robots.txt');
const robotsContent = fs.readFileSync(robotsPath, 'utf8');

assert(!robotsContent.includes('virtualcarhire.pages.dev'), 'robots.txt must not contain pages.dev domain');
assert(robotsContent.includes(`Sitemap: ${CANONICAL_DOMAIN}/sitemap.xml`), 'robots.txt must point to canonical sitemap.xml');
console.log('✅ PASS: robots.txt contains correct canonical sitemap directive.');

// 2. Verify sitemap.xml XML structure, URLs, and dates
const sitemapPath = path.join(__dirname, '..', 'sitemap.xml');
const sitemapContent = fs.readFileSync(sitemapPath, 'utf8');

assert(!sitemapContent.includes('virtualcarhire.pages.dev'), 'sitemap.xml must not contain pages.dev domain');
assert(!sitemapContent.includes('localhost'), 'sitemap.xml must not contain localhost domain');
assert(!sitemapContent.includes('https://virtualcarhire.co.uk'), 'sitemap.xml must not contain non-www domain');
assert(!sitemapContent.includes('</lastmod><lastmod>'), 'sitemap.xml must not contain malformed closing tags');

// Regex XML validation for url elements
const urlBlocks = sitemapContent.match(/<url>[\s\S]*?<\/url>/g) || [];
assert(urlBlocks.length >= 20, 'sitemap.xml should contain at least 20 important page URLs');

const locMatches = [];
urlBlocks.forEach(block => {
  const locMatch = block.match(/<loc>(.*?)<\/loc>/);
  const lastmodMatch = block.match(/<lastmod>(.*?)<\/lastmod>/);

  assert(locMatch, `Every <url> in sitemap must have a valid <loc>: ${block}`);
  assert(lastmodMatch, `Every <url> in sitemap must have a valid <lastmod>: ${block}`);

  const url = locMatch[1];
  const lastmod = lastmodMatch[1];

  assert(url.startsWith(CANONICAL_DOMAIN), `Sitemap URL ${url} must start with ${CANONICAL_DOMAIN}`);
  assert(lastmod <= TODAY_DATE, `Sitemap lastmod date ${lastmod} must not be in the future (today: ${TODAY_DATE})`);

  locMatches.push(url);
});

// Check all vehicle pages are included in sitemap.xml
const carFiles = fs.readdirSync(path.join(__dirname, '..', 'cars')).filter(f => f.endsWith('.html'));
carFiles.forEach(car => {
  const slug = car.replace('.html', '');
  const carUrl = `${CANONICAL_DOMAIN}/cars/${slug}`;
  assert(locMatches.includes(carUrl), `sitemap.xml must contain vehicle page URL: ${carUrl}`);
});

console.log('✅ PASS: sitemap.xml is valid XML, contains valid canonical URLs, correct dates, and all vehicles.');

// 3. Verify HTML pages metadata, syntax, domain consistency, and structured data
const publicPages = [
  'index.html', 'our-fleet.html', 'how-it-works.html', 'support.html', 'about-us.html', 'contact-us.html',
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

  // Verify no non-www domain in canonical or SEO metadata
  assert(!content.includes('https://virtualcarhire.co.uk'), `${relPath} must use www.virtual-carhire.co.uk`);

  // Check Title uniqueness and counts
  const titleMatches = content.match(/<title>[\s\S]*?<\/title>/gi) || [];
  assert.strictEqual(titleMatches.length, 1, `${relPath} must have exactly one <title> tag`);
  const titleText = titleMatches[0].replace(/<\/?title>/gi, '').trim();
  assert(titleText.length > 0, `${relPath} title must not be empty`);
  assert(!titles.has(titleText), `Duplicate title found in ${relPath}: "${titleText}"`);
  titles.add(titleText);

  // Check Description uniqueness and counts
  const descMatches = content.match(/<meta\s+name="description"\s+content="(.*?)"/gi) || [];
  assert.strictEqual(descMatches.length, 1, `${relPath} must have exactly one meta description`);
  const descContentMatch = content.match(/<meta\s+name="description"\s+content="(.*?)"/i);
  const descText = descContentMatch[1].trim();
  assert(descText.length > 0, `${relPath} description must not be empty`);
  assert(!descriptions.has(descText), `Duplicate description found in ${relPath}: "${descText}"`);
  descriptions.add(descText);

  // Check Canonical tag counts and value
  const canonicalMatches = content.match(/<link\s+rel="canonical"\s+href="(.*?)"/gi) || [];
  assert.strictEqual(canonicalMatches.length, 1, `${relPath} must have exactly one canonical tag`);
  const canonicalValMatch = content.match(/<link\s+rel="canonical"\s+href="(.*?)"/i);
  assert(canonicalValMatch[1].startsWith(CANONICAL_DOMAIN), `${relPath} canonical tag must start with ${CANONICAL_DOMAIN}`);

  // Check OpenGraph URL
  const ogUrlMatch = content.match(/<meta\s+property="og:url"\s+content="(.*?)"/i);
  if (ogUrlMatch) {
    assert(ogUrlMatch[1].startsWith(CANONICAL_DOMAIN), `${relPath} og:url must start with ${CANONICAL_DOMAIN}`);
  }

  // Verify JSON-LD JSON validity and no old domains in schema
  const jsonLdMatches = content.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi) || [];
  jsonLdMatches.forEach((m, idx) => {
    const jsonStr = m.replace(/<script type="application\/ld\+json">/i, '').replace(/<\/script>/i, '').trim();
    assert(!jsonStr.includes('virtualcarhire.pages.dev'), `${relPath} JSON-LD block ${idx} must not contain pages.dev`);
    assert(!jsonStr.includes('https://virtualcarhire.co.uk'), `${relPath} JSON-LD block ${idx} must not contain non-www domain`);
    try {
      JSON.parse(jsonStr);
    } catch (e) {
      assert.fail(`Invalid JSON-LD in ${relPath} block ${idx}: ${e.message}`);
    }
  });
});

console.log('✅ PASS: All HTML pages have valid syntax, unique titles, unique meta descriptions, valid canonicals, and consistent www domain.');

console.log('\nAll SEO and Google Indexing verification tests passed successfully!');
