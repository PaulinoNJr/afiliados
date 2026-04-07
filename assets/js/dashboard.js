(() => {
  const state = {
    session: null,
    profile: null,
    products: [],
    isAdmin: false
  };

  const refs = {
    userRoleBadge: document.getElementById('userRoleBadge'),
    userEmail: document.getElementById('userEmail'),
    logoutBtn: document.getElementById('logoutBtn'),
    status: document.getElementById('statusMessage'),
    manageUsersLink: document.getElementById('manageUsersLink'),
    dashboardAvatar: document.getElementById('dashboardAvatar'),
    dashboardName: document.getElementById('dashboardName'),
    dashboardSlug: document.getElementById('dashboardSlug'),
    dashboardTitle: document.getElementById('dashboardTitle'),
    dashboardDescription: document.getElementById('dashboardDescription'),
    dashboardStoreLink: document.getElementById('dashboardStoreLink'),
    statTotalProducts: document.getElementById('statTotalProducts'),
    statAveragePrice: document.getElementById('statAveragePrice'),
    statWithDescription: document.getElementById('statWithDescription'),
    statLastUpdate: document.getElementById('statLastUpdate')
  };

  function showStatus(message, type = 'warning') {
    refs.status.className = `alert alert-${type}`;
    refs.status.textContent = message;
    refs.status.classList.remove('d-none');
  }

  function formatPrice(value) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(Number(value || 0));
  }

  function formatDate(value) {
    if (!value) return 'Sem registros';
    return new Date(value).toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short'
    });
  }

  function getFullName(profile) {
    const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim();
    return fullName || profile?.store_name || 'Afiliado';
  }

  function applyHeader() {
    refs.userEmail.textContent = state.session.user.email || 'Usuário autenticado';
    refs.userRoleBadge.textContent = state.isAdmin ? 'admin' : 'produtor';
    refs.userRoleBadge.className = state.isAdmin ? 'badge text-bg-primary' : 'badge text-bg-secondary';
    refs.manageUsersLink.classList.toggle('d-none', !state.isAdmin);
    window.Auth.applyProfileAccess(state.profile);
  }

  function applyProfileSummary() {
    const profile = state.profile;
    const publicUrl = profile?.slug ? window.StoreUtils.getStoreUrl(profile.slug) : 'loja.html';

    refs.dashboardName.textContent = getFullName(profile);
    refs.dashboardSlug.textContent = profile?.slug ? publicUrl : 'Defina o slug da sua loja';
    refs.dashboardStoreLink.href = profile?.slug ? publicUrl : 'loja.html';

    if (profile?.photo_url) {
      refs.dashboardAvatar.src = profile.photo_url;
      refs.dashboardAvatar.classList.remove('d-none');
      refs.dashboardAvatar.onerror = () => {
        refs.dashboardAvatar.classList.add('d-none');
      };
    } else {
      refs.dashboardAvatar.classList.add('d-none');
    }

    refs.dashboardTitle.textContent = `Bem-vindo, ${getFullName(profile)}`;
    refs.dashboardDescription.textContent = profile?.store_name
      ? `Sua loja "${profile.store_name}" está pronta para receber produtos e visitantes.`
      : 'Configure sua loja e publique seus primeiros produtos.';
  }

  function renderMetrics() {
    const total = state.products.length;
    const withDescription = state.products.filter((item) => String(item.descricao || '').trim()).length;
    const avgPrice = total
      ? state.products.reduce((sum, item) => sum + Number(item.preco || 0), 0) / total
      : 0;
    const lastItem = [...state.products].sort((a, b) => {
      return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
    })[0];

    refs.statTotalProducts.textContent = String(total);
    refs.statAveragePrice.textContent = formatPrice(avgPrice);
    refs.statWithDescription.textContent = total ? `${Math.round((withDescription / total) * 100)}%` : '0%';
    refs.statLastUpdate.textContent = formatDate(lastItem?.updated_at || lastItem?.created_at);
  }

  async function loadProducts() {
    let query = window.db
      .from('produtos')
      .select('id, preco, descricao, created_at, updated_at, profile_id')
      .order('updated_at', { ascending: false });

    if (!state.isAdmin) {
      query = query.eq('profile_id', state.session.user.id);
    }

    const { data, error } = await query;
    if (error) throw error;

    state.products = data || [];
    renderMetrics();
  }

  async function init() {
    if (window.AppConfig?.missingConfig) {
      showStatus('Configure SUPABASE_URL e SUPABASE_ANON_KEY em assets/js/config.js.', 'warning');
      return;
    }

    try {
      const activation = await window.Auth.ensureActivatedSession('ativacao.html');
      if (!activation) return;

      state.session = activation.session;
      state.profile = activation.profile;
      state.isAdmin = state.profile?.role === 'admin';

      applyHeader();
      applyProfileSummary();

      refs.logoutBtn.addEventListener('click', async () => {
        await window.Auth.logout();
        window.location.href = 'index.html';
      });

      await loadProducts();
    } catch (err) {
      showStatus(`Erro ao iniciar o painel: ${err.message}`, 'danger');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
