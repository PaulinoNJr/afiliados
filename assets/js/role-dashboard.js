(() => {
  const DASHBOARD_ROLE = document.body.dataset.dashboardRole || 'advertiser';

  const state = {
    session: null,
    profile: null
  };

  const refs = {
    userRoleBadge: document.getElementById('userRoleBadge'),
    userEmail: document.getElementById('userEmail'),
    logoutBtn: document.getElementById('logoutBtn'),
    status: document.getElementById('statusMessage'),
    dashboardDescription: document.getElementById('dashboardDescription'),
    dashboardAvatar: document.getElementById('dashboardAvatar'),
    dashboardName: document.getElementById('dashboardName'),
    dashboardSlug: document.getElementById('dashboardSlug'),
    metricOneValue: document.getElementById('metricOneValue'),
    metricTwoValue: document.getElementById('metricTwoValue'),
    metricThreeValue: document.getElementById('metricThreeValue'),
    metricFourValue: document.getElementById('metricFourValue'),
    performanceTableHead: document.getElementById('performanceTableHead'),
    performanceTableBody: document.getElementById('performanceTableBody'),
    emptyTableState: document.getElementById('emptyTableState'),
    activityList: document.getElementById('activityList')
  };

  function showStatus(message, type = 'warning') {
    refs.status.className = `alert alert-${type}`;
    refs.status.textContent = message;
    refs.status.classList.remove('d-none');
  }

  function formatCurrency(value) {
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

  function escapeHtml(value) {
    return window.StoreUtils.escapeHtml(value);
  }

  function renderTable(columns = [], rows = []) {
    refs.performanceTableHead.innerHTML = '';
    columns.forEach((column) => {
      const th = document.createElement('th');
      th.textContent = column;
      refs.performanceTableHead.appendChild(th);
    });

    refs.performanceTableBody.innerHTML = '';

    if (!rows.length) {
      refs.emptyTableState.classList.remove('d-none');
      return;
    }

    refs.emptyTableState.classList.add('d-none');

    rows.forEach((row) => {
      const tr = document.createElement('tr');
      row.forEach((cell) => {
        const td = document.createElement('td');
        td.innerHTML = cell;
        tr.appendChild(td);
      });
      refs.performanceTableBody.appendChild(tr);
    });
  }

  function renderActivities(items = []) {
    refs.activityList.innerHTML = '';
    items.forEach((item) => {
      const article = document.createElement('article');
      article.className = 'dashboard-activity-item';
      article.innerHTML = `
        <strong>${escapeHtml(item.title)}</strong>
        <p>${escapeHtml(item.description)}</p>
      `;
      refs.activityList.appendChild(article);
    });
  }

  function applyHeader(profile) {
    refs.userEmail.textContent = state.session.user.email || 'Usuário autenticado';
    refs.userRoleBadge.textContent = window.Auth.getRoleLabel(profile?.role);
    refs.userRoleBadge.className = profile?.role === 'admin' ? 'badge text-bg-primary' : 'badge text-bg-secondary';
    window.Auth.applyProfileAccess(profile);
  }

  function applyHero(profile) {
    refs.dashboardName.textContent = window.Auth.getProfileDisplayName(profile);
    refs.dashboardSlug.textContent = profile?.slug ? window.StoreUtils.getStoreUrl(profile.slug) : 'Workspace interno';

    if (profile?.photo_url) {
      refs.dashboardAvatar.src = profile.photo_url;
      refs.dashboardAvatar.classList.remove('d-none');
      refs.dashboardAvatar.onerror = () => refs.dashboardAvatar.classList.add('d-none');
    } else {
      refs.dashboardAvatar.classList.add('d-none');
    }
  }

  async function loadAdvertiserDashboard() {
    const [{ data: products, error: productsError }, { data: categories, error: categoriesError }] = await Promise.all([
      window.db
        .from('produtos')
        .select('id, titulo, preco, descricao, created_at, updated_at, category_id')
        .eq('profile_id', state.session.user.id)
        .order('updated_at', { ascending: false }),
      window.db
        .from('product_categories')
        .select('id, name, sort_order, created_at, updated_at')
        .eq('profile_id', state.session.user.id)
        .order('sort_order', { ascending: true })
    ]);

    if (productsError) throw productsError;
    if (categoriesError) throw categoriesError;

    const productList = products || [];
    const categoryList = categories || [];
    const withDescription = productList.filter((item) => String(item.descricao || '').trim()).length;
    const lastItem = [...productList, ...categoryList].sort((a, b) => {
      return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
    })[0];

    refs.dashboardDescription.textContent = 'Acompanhe o que já está pronto na loja, o que ainda falta completar e onde vale investir o próximo ajuste.';
    refs.metricOneValue.textContent = String(productList.length);
    refs.metricTwoValue.textContent = String(categoryList.length);
    refs.metricThreeValue.textContent = productList.length ? `${Math.round((withDescription / productList.length) * 100)}%` : '0%';
    refs.metricFourValue.textContent = formatDate(lastItem?.updated_at || lastItem?.created_at);

    renderTable(
      ['Produto', 'Categoria', 'Preço', 'Atualizado'],
      productList.slice(0, 5).map((item) => [
        `<div class="fw-semibold">${escapeHtml(item.titulo || 'Produto sem nome')}</div><div class="small text-secondary">${String(item.descricao || '').trim() ? 'Descrição preenchida' : 'Sem descrição'}</div>`,
        `<span class="badge text-bg-light">${escapeHtml(categoryList.find((category) => category.id === item.category_id)?.name || 'Sem categoria')}</span>`,
        `<span class="fw-semibold">${formatCurrency(item.preco)}</span>`,
        `<span class="small text-secondary">${formatDate(item.updated_at || item.created_at)}</span>`
      ])
    );

    renderActivities([
      {
        title: 'Catálogo publicado',
        description: productList.length ? `${productList.length} produto(s) já fazem parte da sua base.` : 'Cadastre seu primeiro produto para começar a montar a loja.'
      },
      {
        title: 'Navegação da loja',
        description: categoryList.length ? `${categoryList.length} categoria(s) ajudam a organizar a vitrine.` : 'Crie ao menos uma categoria para estruturar melhor a página pública.'
      },
      {
        title: 'Qualidade do conteúdo',
        description: productList.length
          ? `${withDescription} de ${productList.length} produto(s) já têm descrição preenchida.`
          : 'Preencha descrição, imagem e preço com consistência desde os primeiros cadastros.'
      }
    ]);
  }

  async function loadAdminDashboard() {
    const [profilesResult, productsResult, categoriesResult] = await Promise.all([
      window.db
        .from('user_profiles')
        .select('user_id, user_email, role, activation_status, store_name, slug, created_at')
        .order('created_at', { ascending: false }),
      window.db
        .from('produtos')
        .select('id'),
      window.db
        .from('product_categories')
        .select('id')
    ]);

    if (profilesResult.error) throw profilesResult.error;
    if (productsResult.error) throw productsResult.error;
    if (categoriesResult.error) throw categoriesResult.error;

    const profiles = (profilesResult.data || []).map((item) => ({
      ...item,
      role: window.Auth.normalizeRole(item.role)
    }));
    const stores = profiles.filter((item) => String(item.store_name || '').trim()).length;
    const pendingActivation = profiles.filter((item) => item.activation_status !== 'active').length;

    refs.dashboardDescription.textContent = 'O backoffice ficou concentrado em gestão de acesso, lojas e base de catálogo, sem os módulos extras que desviavam o foco do produto.';
    refs.metricOneValue.textContent = String(profiles.length);
    refs.metricTwoValue.textContent = String(stores);
    refs.metricThreeValue.textContent = String((productsResult.data || []).length);
    refs.metricFourValue.textContent = String((categoriesResult.data || []).length);

    renderTable(
      ['Conta', 'Perfil', 'Status', 'Criado em'],
      profiles.slice(0, 6).map((item) => [
        `<div class="fw-semibold">${escapeHtml(item.user_email || item.user_id)}</div><div class="small text-secondary">${escapeHtml(item.store_name || 'Loja ainda sem nome')}</div>`,
        `<span class="badge ${item.role === 'admin' ? 'text-bg-primary' : 'text-bg-secondary'}">${window.Auth.getRoleLabel(item.role)}</span>`,
        `<span class="badge ${item.activation_status === 'active' ? 'text-bg-success' : 'text-bg-warning'}">${escapeHtml(item.activation_status || 'pending')}</span>`,
        `<span class="small text-secondary">${formatDate(item.created_at)}</span>`
      ])
    );

    renderActivities([
      {
        title: 'Ativações pendentes',
        description: pendingActivation ? `${pendingActivation} conta(s) ainda aguardam confirmação por email.` : 'Nenhuma ativação pendente no momento.'
      },
      {
        title: 'Lojas configuradas',
        description: stores ? `${stores} conta(s) já têm loja ou marca definida.` : 'As contas ainda podem melhorar o preenchimento da loja.'
      },
      {
        title: 'Base atual',
        description: `${(productsResult.data || []).length} produto(s) e ${(categoriesResult.data || []).length} categoria(s) cadastrados na plataforma.`
      }
    ]);
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

      const allowedRoles = DASHBOARD_ROLE === 'admin'
        ? ['admin']
        : ['admin', 'advertiser'];
      const allowed = await window.Auth.ensureRoleAccess(state.profile, allowedRoles);
      if (!allowed) return;

      applyHeader(state.profile);
      applyHero(state.profile);

      refs.logoutBtn.addEventListener('click', async () => {
        await window.Auth.logout();
        window.location.href = 'login.html';
      });

      if (DASHBOARD_ROLE === 'admin') {
        await loadAdminDashboard();
        return;
      }

      await loadAdvertiserDashboard();
    } catch (err) {
      showStatus(`Erro ao iniciar o painel: ${err.message}`, 'danger');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
