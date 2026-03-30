(() => {
  // Aceita config via:
  // 1) window.SUPABASE_URL / window.SUPABASE_ANON_KEY
  // 2) window.SUPABASE_CONFIG = { url, anonKey }
  // 3) fallback para valores definidos abaixo
  const inlineConfig = window.SUPABASE_CONFIG || {};

  // Como a anon key do Supabase é pública por design, este arquivo pode ficar no frontend.
  const SUPABASE_URL = String(
    window.SUPABASE_URL ||
    inlineConfig.url ||
    'https://rnxhejdrmhqqseruhbvi.supabase.co'
  ).trim();

  const SUPABASE_ANON_KEY = String(
    window.SUPABASE_ANON_KEY ||
    inlineConfig.anonKey ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJueGhlamRybWhxcXNlcnVoYnZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNjMyNjEsImV4cCI6MjA4ODYzOTI2MX0.3RhDHgDvQ8J2vwyp3vQWh5pu4eioWLNAoijeE9m_G14'
  ).trim();

  const RECAPTCHA_SITE_KEY = String(
    window.RECAPTCHA_SITE_KEY ||
    inlineConfig.recaptchaSiteKey ||
    ''
  ).trim();

  const isValidSupabaseUrl = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(SUPABASE_URL);
  const isJwt = SUPABASE_ANON_KEY.split('.').length === 3;
  const hasPlaceholder = /(SEU|SUA|YOUR|PROJECT|ANON_KEY|CHAVE)/i.test(
    `${SUPABASE_URL} ${SUPABASE_ANON_KEY}`
  );

  const configIssues = [];
  if (!isValidSupabaseUrl) configIssues.push('SUPABASE_URL inválida');
  if (!isJwt) configIssues.push('SUPABASE_ANON_KEY inválida');
  if (hasPlaceholder) configIssues.push('valor de exemplo detectado');

  const missingConfig = configIssues.length > 0;
  const hasSdk = typeof window.supabase !== 'undefined';

  if (!hasSdk) {
    console.error('Supabase SDK não carregado. Verifique a tag <script> do CDN.');
  }

  if (missingConfig) {
    console.warn(`Configuração do Supabase inválida: ${configIssues.join(', ')}.`);
  }

  if (!RECAPTCHA_SITE_KEY) {
    console.warn('RECAPTCHA_SITE_KEY não configurada. O cadastro anti-bot ficará indisponível até a chave ser informada.');
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
    RECAPTCHA_SITE_KEY,
    missingConfig,
    recaptchaConfigured: Boolean(RECAPTCHA_SITE_KEY),
    hasSdk,
    configIssues
  };

  window.db = client;
})();
