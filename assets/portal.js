// Shared Supabase Client Config & Initialization for Driver Portal
// Expects SUPABASE_URL and SUPABASE_ANON_KEY from window or Cloudflare Pages environment.

(function() {
  const DEFAULT_SUPABASE_URL = 'https://hhpkffratbbnwedjlebx.supabase.co';

  if (console.group) {
    console.group('[VCH Supabase Diagnostics] Initializing Supabase Environment Config');
  } else {
    console.log('[VCH Supabase Diagnostics] Initializing Supabase Environment Config');
  }

  const checkCandidateWithDiagnostics = (name) => {
    let windowFound = false;
    let windowEnvFound = false;
    let processEnvFound = false;
    let resolvedValue = null;

    if (typeof window !== 'undefined') {
      if (window[name]) {
        windowFound = true;
        if (!resolvedValue) resolvedValue = window[name];
      }
      if (window.ENV && window.ENV[name]) {
        windowEnvFound = true;
        if (!resolvedValue) resolvedValue = window.ENV[name];
      }
    }

    if (typeof process !== 'undefined' && process.env && process.env[name]) {
      processEnvFound = true;
      if (!resolvedValue) resolvedValue = process.env[name];
    }

    console.log(`[VCH Supabase Diagnostics] Checked Candidate '${name}':`, {
      checkedVariable: name,
      foundViaWindow: windowFound,
      foundViaWindowENV: windowEnvFound,
      foundViaProcessEnv: processEnvFound,
      hasValue: !!resolvedValue
    });

    return resolvedValue;
  };

  const getEnvVar = (candidateNames) => {
    for (const name of candidateNames) {
      const val = checkCandidateWithDiagnostics(name);
      if (val) return val;
    }
    return null;
  };

  console.log('[VCH Supabase Diagnostics] Checking SUPABASE_URL candidate list in order...');
  const urlCandidateNames = [
    'SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'VITE_SUPABASE_URL',
    'PUBLIC_SUPABASE_URL'
  ];
  const resolvedUrlVar = getEnvVar(urlCandidateNames);
  const SUPABASE_URL = resolvedUrlVar || DEFAULT_SUPABASE_URL;
  console.log(`[VCH Supabase Diagnostics] SUPABASE_URL resolved: ${resolvedUrlVar ? 'from env' : 'fallback DEFAULT_SUPABASE_URL (' + DEFAULT_SUPABASE_URL + ')'}`);

  console.log('[VCH Supabase Diagnostics] Checking SUPABASE_ANON_KEY candidate list in order...');
  const keyCandidateNames = [
    'SUPABASE_ANON_KEY',
    'SUPABASE_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_KEY',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_SUPABASE_KEY',
    'PUBLIC_SUPABASE_ANON_KEY',
    'PUBLIC_SUPABASE_KEY'
  ];
  const SUPABASE_ANON_KEY = getEnvVar(keyCandidateNames) || '';
  console.log(`[VCH Supabase Diagnostics] SUPABASE_ANON_KEY resolved: found=${!!SUPABASE_ANON_KEY} (length=${SUPABASE_ANON_KEY.length})`);

  if (console.groupEnd) console.groupEnd();

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

    if (!url || url.includes('placeholder-project')) {
      console.error('[VCH Supabase Error] Invalid or missing SUPABASE_URL:', url);
      return null;
    }

    if (!key || key === 'placeholder-anon-key') {
      console.error('[VCH Supabase Error] Missing or unconfigured SUPABASE_ANON_KEY.');
      return null;
    }

    try {
      window.vchSupabaseClient = window.supabase.createClient(url, key);
      return window.vchSupabaseClient;
    } catch (err) {
      console.error('[VCH Supabase Error] Failed to initialize Supabase client:', err);
      return null;
    }
  };
})();
