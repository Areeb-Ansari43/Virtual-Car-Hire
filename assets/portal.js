// Driver portal switched off for now. Set to true to turn the portal back on (and remove the
// "Driver portal switched off" block in assets/style.css, and PORTAL_ENABLED in assets/app.js).
window.VCH_PORTAL_ENABLED = false;


// Shared Supabase Client Config & Initialization for Driver Portal

(function() {
  const SUPABASE_URL = 'https://hhpkffratbbnwedjlebx.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhocGtmZnJhdGJibndlZGpsZWJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxNTY2NTQsImV4cCI6MjA5ODczMjY1NH0.oCCsfWkudAkUyIZ-f0hKGRuG2FBPOh02D6vGFY8wbxQ';

  window.VCH_SUPABASE_CONFIG = {
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY
  };

  window.initVchSupabase = function() {
    if (window.vchSupabaseClient) return window.vchSupabaseClient;

    if (!window.supabase) {
      console.error('[VCH Supabase Error] Supabase client library (@supabase/supabase-js) not loaded on window.');
      return null;
    }

    const url = window.VCH_SUPABASE_CONFIG.url;
    const key = window.VCH_SUPABASE_CONFIG.anonKey;

    try {
      window.vchSupabaseClient = window.supabase.createClient(url, key);
      return window.vchSupabaseClient;
    } catch (err) {
      console.error('[VCH Supabase Error] Failed to initialize Supabase client:', err);
      return null;
    }
  };
})();

if (!window.VCH_PORTAL_ENABLED && typeof document !== 'undefined') {
  // Runs before the page's own scripts (this file loads first), so their login / redirect code
  // never starts: show a short notice instead of the portal.
  window.initVchSupabase = function () { return null; };
  document.addEventListener('DOMContentLoaded', function (e) {
    e.stopImmediatePropagation();
    document.title = 'Driver portal | Virtual Car Hire';
    document.body.innerHTML =
      '<main style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#0b0d12;color:#eef2f8;font-family:Inter,-apple-system,Segoe UI,Roboto,sans-serif">' +
      '<div style="max-width:420px;text-align:center">' +
      '<img src="/assets/logo.png" alt="Virtual Car Hire" style="height:56px;margin:0 auto 18px;display:block">' +
      '<h1 style="font-size:22px;margin:0 0 8px">The driver portal is switched off at the moment</h1>' +
      '<p style="color:#9aa5b8;font-size:15px;line-height:1.6;margin:0 0 22px">For rent, documents, mileage or anything else, message us on WhatsApp or call <a href="tel:+442072946756" style="color:#ff8a3d">+44 20 7294 6756</a>.</p>' +
      '<a href="/whatsapp" style="display:inline-flex;align-items:center;gap:8px;background:#25d366;color:#fff;padding:12px 20px;border-radius:999px;font-weight:700;text-decoration:none">WhatsApp us</a>' +
      '<div style="margin-top:16px"><a href="/" style="color:#9aa5b8;font-size:14px">Back to the website</a></div>' +
      '</div></main>';
  }, true);
}
