// Shared Supabase Client Config & Initialization for Driver Portal
// Expects SUPABASE_URL and SUPABASE_ANON_KEY from window or Cloudflare Pages environment.

(function() {
  const getEnvVar = (name) => {
    if (typeof window !== 'undefined' && window[name]) return window[name];
    if (typeof process !== 'undefined' && process.env && process.env[name]) return process.env[name];
    return null;
  };

  const SUPABASE_URL = getEnvVar('SUPABASE_URL') || getEnvVar('NEXT_PUBLIC_SUPABASE_URL') || '';
  const SUPABASE_ANON_KEY = getEnvVar('SUPABASE_ANON_KEY') || getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY') || '';

  window.VCH_SUPABASE_CONFIG = {
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY
  };

  window.initVchSupabase = function() {
    if (window.vchSupabaseClient) return window.vchSupabaseClient;
    if (!window.supabase) {
      console.error('Supabase client library not loaded');
      return null;
    }
    const url = window.VCH_SUPABASE_CONFIG.url || 'https://placeholder-project.supabase.co';
    const key = window.VCH_SUPABASE_CONFIG.anonKey || 'placeholder-anon-key';

    window.vchSupabaseClient = window.supabase.createClient(url, key);
    return window.vchSupabaseClient;
  };
})();
