(() => {
  const ROLE_LABELS = {
    admin: 'administrador',
    advertiser: 'gestor'
  };

  const DASHBOARD_ROUTES = {
    admin: 'dashboard-admin.html',
    advertiser: 'dashboard-anunciante.html'
  };

  function syncWorkspaceOffsets() {
    const root = document.documentElement;
    const topbar = document.querySelector('.navbar.sticky-top');
    const menuShell = document.querySelector('.workspace-menu-shell');

    if (topbar) {
      root.style.setProperty('--app-topbar-height', `${Math.ceil(topbar.offsetHeight)}px`);
    }

    root.style.setProperty(
      '--workspace-menu-height',
      menuShell ? `${Math.ceil(menuShell.offsetHeight + 16)}px` : '0px'
    );
  }

  function ensureClient() {
    if (!window.db) {
      throw new Error('Supabase nao configurado. Atualize assets/js/config.js.');
    }
  }

  function normalizeRole(role) {
    const normalized = String(role || '').trim().toLowerCase();
    if (normalized === 'produtor') return 'advertiser';
    if (normalized === 'admin' || normalized === 'advertiser') return normalized;
    return 'advertiser';
  }

  function normalizeAccountType(accountType) {
    const normalized = String(accountType || '').trim().toLowerCase();
    return normalized === 'advertiser' ? normalized : 'advertiser';
  }

  function getRoleLabel(role) {
    return ROLE_LABELS[normalizeRole(role)] || ROLE_LABELS.advertiser;
  }

  function getDashboardRoute(role) {
    return DASHBOARD_ROUTES[normalizeRole(role)] || DASHBOARD_ROUTES.advertiser;
  }

  function hasRole(profile, allowedRoles = []) {
    const normalizedRole = normalizeRole(profile?.role);
    return allowedRoles.map(normalizeRole).includes(normalizedRole);
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

  async function requestPasswordReset(email, options = {}) {
    ensureClient();
    const { data, error } = await window.db.auth.resetPasswordForEmail(email, options);
    return { data, error };
  }

  async function updatePassword(password) {
    ensureClient();
    const { data, error } = await window.db.auth.updateUser({ password });
    return { data, error };
  }

  async function register() {
    throw new Error('Cadastro direto pelo frontend foi desativado. Use os endpoints seguros do backend.');
  }

  function normalizeProfile(profile) {
    if (!profile) return null;
    return {
      ...profile,
      role: normalizeRole(profile.role),
      account_type: normalizeAccountType(profile.account_type),
      company_name: profile.company_name || null
    };
  }

  async function getProfile() {
    ensureClient();

    const session = await getSession();
    if (!session?.user?.id) return null;

    const userId = session.user.id;

    const { data, error } = await window.db
      .from('user_profiles')
      .select('user_id, user_email, role, account_type, company_name, first_name, last_name, phone, photo_url, store_name, slug, slug_changed_at, activation_status, activation_requested_at, activation_email_sent_at, activation_expires_at, activation_confirmed_at, headline, accent_color, text_color, page_background, button_text_color, button_style, card_style, cta_label, bio, banner_url, created_at, updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    if (data) return normalizeProfile(data);

    const { data: createdProfile, error: insertError } = await window.db
      .from('user_profiles')
      .insert({
        user_id: userId,
        user_email: session.user.email || null,
        role: 'advertiser',
        account_type: 'advertiser',
        activation_status: 'pending'
      })
      .select('user_id, user_email, role, account_type, company_name, first_name, last_name, phone, photo_url, store_name, slug, slug_changed_at, activation_status, activation_requested_at, activation_email_sent_at, activation_expires_at, activation_confirmed_at, headline, accent_color, text_color, page_background, button_text_color, button_style, card_style, cta_label, bio, banner_url, created_at, updated_at')
      .single();

    if (insertError) throw insertError;
    return normalizeProfile(createdProfile);
  }

  async function getRole() {
    const profile = await getProfile();
    return normalizeRole(profile?.role);
  }

  function getProfileDisplayName(profile) {
    return [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim()
      || profile?.company_name
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
    const normalizedRole = normalizeRole(profile?.role);

    document.querySelectorAll('[data-admin-only="true"]').forEach((element) => {
      element.classList.toggle('d-none', normalizedRole !== 'admin');
    });

    document.querySelectorAll('[data-advertiser-only="true"]').forEach((element) => {
      element.classList.toggle('d-none', !['advertiser', 'admin'].includes(normalizedRole));
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

    syncWorkspaceOffsets();
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

  function redirectToDashboard(profile) {
    window.location.href = getDashboardRoute(profile?.role);
  }

  async function ensureRoleAccess(profile, allowedRoles = [], fallbackUrl = '') {
    if (hasRole(profile, allowedRoles)) return true;
    window.location.href = fallbackUrl || getDashboardRoute(profile?.role);
    return false;
  }

  async function redirectIfAuthenticated(target = '') {
    const session = await getSession();
    if (session) {
      const profile = await getProfile();
      if (profile && !isAccountActive(profile)) {
        window.location.href = `ativacao.html?status=${encodeURIComponent(profile.activation_status || 'pending')}`;
        return true;
      }
      window.location.href = target || getDashboardRoute(profile?.role);
      return true;
    }
    return false;
  }

  window.Auth = {
    getSession,
    getProfile,
    getRole,
    normalizeRole,
    normalizeAccountType,
    getRoleLabel,
    getDashboardRoute,
    getProfileDisplayName,
    hasRole,
    redirectToDashboard,
    ensureRoleAccess,
    applyProfileAccess,
    isActivationExpired,
    isAccountActive,
    ensureActivatedSession,
    login,
    requestPasswordReset,
    register,
    updatePassword,
    logout,
    requireAuth,
    redirectIfAuthenticated
  };

  window.addEventListener('load', syncWorkspaceOffsets);
  window.addEventListener('resize', syncWorkspaceOffsets);
  syncWorkspaceOffsets();
})();
