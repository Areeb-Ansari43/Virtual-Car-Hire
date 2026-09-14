// Shared Supabase Client Config & Initialization for Driver Portal
// Expects SUPABASE_URL and SUPABASE_ANON_KEY from window or Cloudflare Pages environment.

(function() {
  const DEFAULT_SUPABASE_URL = 'https://hhpkffratbbnwedjlebx.supabase.co';

  const getEnvVar = (name) => {
    if (typeof window !== 'undefined') {
      if (window[name]) return window[name];
      if (window.ENV && window.ENV[name]) return window.ENV[name];
    }
    if (typeof process !== 'undefined' && process.env && process.env[name]) return process.env[name];
    return null;
  };

  const SUPABASE_URL =
    getEnvVar('SUPABASE_URL') ||
    getEnvVar('NEXT_PUBLIC_SUPABASE_URL') ||
    getEnvVar('VITE_SUPABASE_URL') ||
    getEnvVar('PUBLIC_SUPABASE_URL') ||
    DEFAULT_SUPABASE_URL;

  const SUPABASE_ANON_KEY =
    getEnvVar('SUPABASE_ANON_KEY') ||
    getEnvVar('SUPABASE_KEY') ||
    getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY') ||
    getEnvVar('NEXT_PUBLIC_SUPABASE_KEY') ||
    getEnvVar('VITE_SUPABASE_ANON_KEY') ||
    getEnvVar('VITE_SUPABASE_KEY') ||
    getEnvVar('PUBLIC_SUPABASE_ANON_KEY') ||
    getEnvVar('PUBLIC_SUPABASE_KEY') ||
    '';

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
