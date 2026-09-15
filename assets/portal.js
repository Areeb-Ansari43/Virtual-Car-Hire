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
