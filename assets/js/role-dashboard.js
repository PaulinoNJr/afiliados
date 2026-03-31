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

  function renderTable(columns = [], rows = []) {
    refs.performanceTableHead.innerHTML = columns.map((column) => `<th>${column}</th>`).join('');
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
        <strong>${item.title}</strong>
        <p>${item.description}</p>
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
    const [productsResult, categoriesResult] = await Promise.all([
      window.db
        .from('produtos')
        .select('id, titulo, preco, descricao, category_id, created_at, updated_at')
        .eq('profile_id', state.session.user.id)
        .order('updated_at', { ascending: false }),
      window.db
        .from('product_categories')
        .select('id, name, sort_order, created_at, updated_at')
        .eq('profile_id', state.session.user.id)
        .order('sort_order', { ascending: true })
    ]);

    if (productsResult.error) throw productsResult.error;
    if (categoriesResult.error) throw categoriesResult.error;

    const products = productsResult.data || [];
    const categories = categoriesResult.data || [];
    const withDescription = products.filter((item) => String(item.descricao || '').trim()).length;
    const latestItem = [...products, ...categories].sort((a, b) => {
      return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
    })[0];

    refs.dashboardDescription.textContent = 'Organize catálogo, identidade e base operacional enquanto a camada de campanhas, tracking e comissões entra na próxima etapa.';
    refs.metricOneValue.textContent = String(products.length);
    refs.metricTwoValue.textContent = String(categories.length);
    refs.metricThreeValue.textContent = products.length ? `${Math.round((withDescription / products.length) * 100)}%` : '0%';
    refs.metricFourValue.textContent = formatDate(latestItem?.updated_at || latestItem?.created_at);

    renderTable(
      ['Produto', 'Categoria', 'Preço', 'Atualizado'],
      products.slice(0, 5).map((item) => {
        const category = categories.find((categoryItem) => categoryItem.id === item.category_id);
        return [
          `<div class="fw-semibold">${item.titulo || 'Produto sem título'}</div>`,
          `<span class="badge text-bg-light">${category?.name || 'Sem categoria'}</span>`,
          `<span class="fw-semibold">${formatCurrency(item.preco)}</span>`,
          `<span class="small text-secondary">${formatDate(item.updated_at || item.created_at)}</span>`
        ];
      })
    );

    renderActivities([
      {
        title: 'Consolidar catálogo base',
        description: products.length ? 'Seu catálogo já tem base para evoluir para campanhas e tracking.' : 'Cadastre produtos antes de abrir a operação para afiliados.'
      },
      {
        title: 'Estruturar campanhas',
        description: 'O próximo módulo vai conectar comissão, vigência, materiais e regras por oferta.'
      },
      {
        title: 'Ativar links rastreáveis',
        description: 'A arquitetura agora já separa anunciante e afiliado para suportar atribuição e antifraude.'
      }
    ]);
  }

  async function loadAdminDashboard() {
    const [profilesResult, productsResult] = await Promise.all([
      window.db
        .from('user_profiles')
        .select('user_id, user_email, role, activation_status, store_name, created_at')
        .order('created_at', { ascending: false }),
      window.db
        .from('produtos')
        .select('id')
    ]);

    if (profilesResult.error) throw profilesResult.error;
    if (productsResult.error) throw productsResult.error;

    const profiles = (profilesResult.data || []).map((item) => ({
      ...item,
      role: window.Auth.normalizeRole(item.role)
    }));
    const products = productsResult.data || [];
    const advertisers = profiles.filter((item) => item.role === 'advertiser').length;
    const affiliates = profiles.filter((item) => item.role === 'affiliate').length;
    const pendingActivation = profiles.filter((item) => item.activation_status !== 'active').length;

    refs.dashboardDescription.textContent = 'Use o backoffice para governar papéis, acompanhar qualidade da base e reduzir atritos antes da camada de tracking e payouts.';
    refs.metricOneValue.textContent = String(profiles.length);
    refs.metricTwoValue.textContent = String(advertisers);
    refs.metricThreeValue.textContent = String(affiliates);
    refs.metricFourValue.textContent = String(products.length);

    renderTable(
      ['Conta', 'Perfil', 'Status', 'Criado em'],
      profiles.slice(0, 6).map((item) => [
        `<div class="fw-semibold">${item.user_email || item.user_id}</div><div class="small text-secondary">${item.store_name || 'Sem marca definida'}</div>`,
        `<span class="badge ${item.role === 'admin' ? 'text-bg-primary' : 'text-bg-secondary'}">${window.Auth.getRoleLabel(item.role)}</span>`,
        `<span class="badge ${item.activation_status === 'active' ? 'text-bg-success' : 'text-bg-warning'}">${item.activation_status || 'pending'}</span>`,
        `<span class="small text-secondary">${formatDate(item.created_at)}</span>`
      ])
    );

    renderActivities([
      {
        title: 'Ativações pendentes',
        description: pendingActivation ? `${pendingActivation} conta(s) ainda não concluíram ativação por email.` : 'Nenhuma ativação pendente no momento.'
      },
      {
        title: 'Separação de perfis concluída',
        description: 'A base já diferencia admin, anunciante e afiliado, o que simplifica RBAC e future white label.'
      },
      {
        title: 'Próxima camada',
        description: 'Entram agora campaigns, affiliate links, clicks, conversions, commissions e payout requests.'
      }
    ]);
  }

  async function loadAffiliateDashboard() {
    refs.dashboardDescription.textContent = 'Seu workspace já está preparado para receber campanhas aprovadas, links rastreáveis, materiais e acompanhamento de comissão.';
    refs.metricOneValue.textContent = '0';
    refs.metricTwoValue.textContent = '0';
    refs.metricThreeValue.textContent = '0';
    refs.metricFourValue.textContent = formatCurrency(0);

    renderTable(
      ['Módulo', 'Status', 'O que vai liberar', 'Prioridade'],
      [
        ['Biblioteca de campanhas', '<span class="badge text-bg-warning">em implantação</span>', 'Ofertas liberadas por anunciante', 'Alta'],
        ['Links rastreáveis', '<span class="badge text-bg-warning">em implantação</span>', 'UTM, cookies e histórico de cliques', 'Alta'],
        ['Comissões e saques', '<span class="badge text-bg-light">planejado</span>', 'Saldo pendente, disponível e payout', 'Média']
      ]
    );

    renderActivities([
      {
        title: 'Complete o perfil',
        description: 'Mantenha nome, telefone e foto atualizados para facilitar aprovação e operação.'
      },
      {
        title: 'Aguarde campanhas liberadas',
        description: 'A próxima entrega adiciona aprovação de afiliados e biblioteca com materiais.'
      },
      {
        title: 'Inicie links e tracking',
        description: 'Quando o módulo entrar, o painel já estará pronto para cliques, conversões e comissão.'
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

      const allowedRoles = DASHBOARD_ROLE === 'advertiser'
        ? ['admin', 'advertiser']
        : [DASHBOARD_ROLE];
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

      if (DASHBOARD_ROLE === 'affiliate') {
        await loadAffiliateDashboard();
        return;
      }

      await loadAdvertiserDashboard();
    } catch (err) {
      showStatus(`Erro ao iniciar o painel: ${err.message}`, 'danger');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
