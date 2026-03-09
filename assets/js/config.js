(() => {
  // Defina seus valores aqui antes de publicar.
  // Como a anon key do Supabase é pública por design, este arquivo pode ficar no frontend.
  const SUPABASE_URL = window.SUPABASE_URL || 'https://rnxhejdrmhqqseruhbvi.supabase.co';
  const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJueGhlamRybWhxcXNlcnVoYnZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNjMyNjEsImV4cCI6MjA4ODYzOTI2MX0.3RhDHgDvQ8J2vwyp3vQWh5pu4eioWLNAoijeE9m_G14';

  const missingConfig =
    SUPABASE_URL.includes('https://rnxhejdrmhqqseruhbvi.supabase.co') ||
    SUPABASE_ANON_KEY.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJueGhlamRybWhxcXNlcnVoYnZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNjMyNjEsImV4cCI6MjA4ODYzOTI2MX0.3RhDHgDvQ8J2vwyp3vQWh5pu4eioWLNAoijeE9m_G14');

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
