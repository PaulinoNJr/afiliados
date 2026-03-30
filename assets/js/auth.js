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

  async function register(email, password, profileData = {}) {
    throw new Error('Cadastro direto pelo frontend foi desativado. Use os endpoints seguros do backend.');
  }

  async function getProfile() {
    ensureClient();

    const session = await getSession();
    if (!session?.user?.id) return null;

    const userId = session.user.id;

    const { data, error } = await window.db
      .from('user_profiles')
      .select('user_id, user_email, role, first_name, last_name, phone, photo_url, store_name, slug, slug_changed_at, activation_status, activation_requested_at, activation_email_sent_at, activation_expires_at, activation_confirmed_at, headline, accent_color, text_color, page_background, button_text_color, button_style, card_style, cta_label, bio, banner_url, created_at, updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    if (data) return data;

    const { data: createdProfile, error: insertError } = await window.db
      .from('user_profiles')
      .insert({
        user_id: userId,
        user_email: session.user.email || null,
        role: 'produtor',
        activation_status: 'pending'
      })
      .select('user_id, user_email, role, first_name, last_name, phone, photo_url, store_name, slug, slug_changed_at, activation_status, activation_requested_at, activation_email_sent_at, activation_expires_at, activation_confirmed_at, headline, accent_color, text_color, page_background, button_text_color, button_style, card_style, cta_label, bio, banner_url, created_at, updated_at')
      .single();

    if (insertError) throw insertError;
    return createdProfile;
  }

  async function getRole() {
    const profile = await getProfile();
    return profile?.role || 'produtor';
  }

  function getProfileDisplayName(profile) {
    return [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim()
      || profile?.store_name
      || 'Perfil';
  }

  function getProfileInitials(profile) {
    const base = getProfileDisplayName(profile)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('');
    return base || 'P';
  }

  function applyProfileAccess(profile) {
    const actions = document.querySelector('.app-nav-actions');
    document.querySelectorAll('[data-admin-only="true"]').forEach((element) => {
      element.classList.toggle('d-none', profile?.role !== 'admin');
    });

    if (!actions) return;

    let link = document.getElementById('profileAccessLink');
    if (!link) {
      link = document.createElement('a');
      link.id = 'profileAccessLink';
      link.href = 'perfil.html';
      link.className = 'profile-access-link';
      link.setAttribute('aria-label', 'Abrir dados pessoais');
      link.innerHTML = `
        <img id="profileAccessAvatar" class="profile-access-avatar d-none" alt="Acessar dados pessoais" />
        <span id="profileAccessFallback" class="profile-access-fallback">P</span>
      `;

      const logoutBtn = document.getElementById('logoutBtn');
      if (logoutBtn?.parentNode === actions) {
        actions.insertBefore(link, logoutBtn);
      } else {
        actions.appendChild(link);
      }
    }

    const avatar = document.getElementById('profileAccessAvatar');
    const fallback = document.getElementById('profileAccessFallback');
    const displayName = getProfileDisplayName(profile);

    link.href = 'perfil.html';
    link.title = `Dados pessoais de ${displayName}`;
    link.setAttribute('aria-label', `Abrir dados pessoais de ${displayName}`);

    if (profile?.photo_url) {
      avatar.src = profile.photo_url;
      avatar.classList.remove('d-none');
      fallback.classList.add('d-none');
      avatar.onerror = () => {
        avatar.classList.add('d-none');
        fallback.classList.remove('d-none');
        fallback.textContent = getProfileInitials(profile);
      };
    } else {
      avatar.classList.add('d-none');
      fallback.classList.remove('d-none');
      fallback.textContent = getProfileInitials(profile);
    }
  }

  function isActivationExpired(profile) {
    if (!profile?.activation_expires_at) return false;
    return new Date(profile.activation_expires_at).getTime() < Date.now();
  }

  function isAccountActive(profile) {
    return profile?.activation_status === 'active';
  }

  async function ensureActivatedSession(redirectTo = 'ativacao.html') {
    const session = await getSession();
    if (!session) return null;

    const profile = await getProfile();
    if (!profile) return null;

    if (!isAccountActive(profile)) {
      window.location.href = `${redirectTo}?status=${encodeURIComponent(profile.activation_status || 'pending')}`;
      return null;
    }

    return { session, profile };
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
      const profile = await getProfile();
      if (profile && !isAccountActive(profile)) {
        window.location.href = `ativacao.html?status=${encodeURIComponent(profile.activation_status || 'pending')}`;
        return true;
      }
      window.location.href = target;
      return true;
    }
    return false;
  }

  window.Auth = {
    getSession,
    getProfile,
    getRole,
    applyProfileAccess,
    isActivationExpired,
    isAccountActive,
    ensureActivatedSession,
    login,
    register,
    logout,
    requireAuth,
    redirectIfAuthenticated
  };
})();
