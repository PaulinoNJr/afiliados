(() => {
  function ensureClient() {
    if (!window.db) {
      throw new Error('Supabase não configurado. Atualize assets/js/config.js.');
    }
  }

  async function getSession() {
    ensureClient();
    const { data, error } = await window.db.auth.getSession();
    if (error) throw error;
    return data.session;
  }

  async function login(email, password) {
    ensureClient();
    const { data, error } = await window.db.auth.signInWithPassword({ email, password });
    return { data, error };
  }

  async function register(email, password) {
    ensureClient();

    const isolatedClient = window.supabase.createClient(
      window.AppConfig.SUPABASE_URL,
      window.AppConfig.SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      }
    );

    const { data, error } = await isolatedClient.auth.signUp({ email, password });
    return { data, error };
  }

  async function logout() {
    ensureClient();
    return window.db.auth.signOut();
  }

  async function requireAuth(redirectTo = 'login.html') {
    const session = await getSession();
    if (!session) {
      window.location.href = redirectTo;
      return null;
    }
    return session;
  }

  async function redirectIfAuthenticated(target = 'admin.html') {
    const session = await getSession();
    if (session) {
      window.location.href = target;
      return true;
    }
    return false;
  }

  window.Auth = {
    getSession,
    login,
    register,
    logout,
    requireAuth,
    redirectIfAuthenticated
  };
})();
