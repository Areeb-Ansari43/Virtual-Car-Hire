const assert = require('assert');
// /api/portal/me and /api/portal/mileage forward the driver's session to the CRM.
const me = require('../functions/api/portal/me.js');
const mileage = require('../functions/api/portal/mileage.js');

const ENV = { CRM_API_URL: 'https://crm.test/', PORTAL_SHARED_SECRET: 'shared' };
const req = (body, headers = {}) => {
  const map = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return { method: 'POST', headers: { get: (k) => map.get(k.toLowerCase()) || null }, text: async () => JSON.stringify(body) };
};

(async () => {
  try {
    const orig = global.fetch;
    const errs = console.error;
    console.error = () => {};
    let call;
    global.fetch = async (url, opts) => {
      call = { url, opts };
      return { ok: true, status: 200, json: async () => ({ ok: true, driver: { name: 'Sam' } }) };
    };

    // No session -> 401, CRM never called
    call = null;
    let res = await me.onRequestPost({ request: req({}), env: ENV });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(call, null);

    // Forwards secret + driver token to the CRM
    res = await me.onRequestPost({ request: req({ mark_read: true }, { Authorization: 'Bearer drv.tok.en' }), env: ENV });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(call.url, 'https://crm.test/api/public/portal/me');
    assert.strictEqual(call.opts.headers['X-Portal-Secret'], 'shared');
    assert.strictEqual(call.opts.headers['X-Driver-Token'], 'drv.tok.en');
    assert.deepStrictEqual(JSON.parse(call.opts.body), { mark_read: true });

    // Mileage goes to the CRM mileage endpoint
    res = await mileage.onRequestPost({ request: req({ reading: 41250, photo_base64: 'data:image/jpeg;base64,AAAA' }, { Authorization: 'Bearer drv.tok.en' }), env: ENV });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(call.url, 'https://crm.test/api/public/portal/mileage');

    // Secret mismatch is hidden from the driver behind friendly text
    global.fetch = async () => ({ ok: false, status: 401, json: async () => ({ ok: false, code: 'secret_mismatch' }) });
    res = await me.onRequestPost({ request: req({}, { Authorization: 'Bearer drv.tok.en' }), env: ENV });
    assert.strictEqual(res.status, 502);
    assert.match((await res.json()).error, /temporarily unavailable/);

    // Missing website config
    res = await me.onRequestPost({ request: req({}, { Authorization: 'Bearer x.y.z' }), env: {} });
    assert.strictEqual(res.status, 500);

    global.fetch = orig;
    console.error = errs;
    console.log('✅ PASS: portal /me and /mileage forward the driver session to the CRM.');
  } catch (err) {
    console.error('❌ FAIL:', err);
    process.exit(1);
  }
})();
