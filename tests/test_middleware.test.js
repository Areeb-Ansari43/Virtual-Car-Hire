import { onRequest } from '../functions/_middleware.js';

async function testMiddleware() {
  console.log('--- Testing Cloudflare Pages Middleware ---');

  // Test 1: virtualcarhire.pages.dev request with path and query string
  let nextCalled = false;
  const mockContextPagesDev = {
    request: {
      url: 'https://virtualcarhire.pages.dev/our-fleet.html?cat=pco#top'
    },
    next: () => {
      nextCalled = true;
      return Promise.resolve(new Response('OK', { status: 200 }));
    }
  };

  const resPagesDev = await onRequest(mockContextPagesDev);
  if (resPagesDev.status !== 301) {
    throw new Error(`Expected status 301, got ${resPagesDev.status}`);
  }
  const locationHeader = resPagesDev.headers.get('Location');
  if (locationHeader !== 'https://virtual-carhire.co.uk/our-fleet.html?cat=pco#top') {
    throw new Error(`Expected redirect location 'https://virtual-carhire.co.uk/our-fleet.html?cat=pco#top', got '${locationHeader}'`);
  }
  if (nextCalled) {
    throw new Error('next() should not be called on redirected host');
  }
  console.log('✅ PASS: virtualcarhire.pages.dev returns 301 redirect preserving path and query string.');

  // Test 2: custom domain virtual-carhire.co.uk request
  nextCalled = false;
  const mockContextCustomDomain = {
    request: {
      url: 'https://virtual-carhire.co.uk/our-fleet.html'
    },
    next: () => {
      nextCalled = true;
      return Promise.resolve(new Response('OK', { status: 200 }));
    }
  };

  const resCustomDomain = await onRequest(mockContextCustomDomain);
  if (!nextCalled) {
    throw new Error('next() should be called for custom domain');
  }
  const customStatus = await resCustomDomain.status;
  if (customStatus !== 200) {
    throw new Error(`Expected status 200, got ${customStatus}`);
  }
  console.log('✅ PASS: virtual-carhire.co.uk passes through normally via next().');

  console.log('All middleware tests passed successfully!\n');
}

testMiddleware().catch(err => {
  console.error('❌ FAIL:', err);
  process.exit(1);
});
