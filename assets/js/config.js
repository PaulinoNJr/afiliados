(() => {
  // Defina seus valores aqui antes de publicar.
  // Como a anon key do Supabase é pública por design, este arquivo pode ficar no frontend.
  const SUPABASE_URL = window.SUPABASE_URL || 'https://SEU-PROJETO.supabase.co';
  const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'SUA_SUPABASE_ANON_KEY';

  const missingConfig =
    SUPABASE_URL.includes('SEU-PROJETO') ||
    SUPABASE_ANON_KEY.includes('SUA_SUPABASE_ANON_KEY');

  const hasSdk = typeof window.supabase !== 'undefined';

  if (!hasSdk) {
    console.error('Supabase SDK não carregado. Verifique a tag <script> do CDN.');
  }

  if (missingConfig) {
    console.warn('Configure SUPABASE_URL e SUPABASE_ANON_KEY em assets/js/config.js');
  }

  const client = !missingConfig && hasSdk
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      })
    : null;

  window.AppConfig = {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    missingConfig
  };

  window.db = client;
})();
