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
    refs.userEmail.textContent = state.session.user.email || 'Usuario autenticado';
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

  function getStatusBadge(status) {
    if (status === 'active') return 'text-bg-success';
    if (status === 'paused') return 'text-bg-warning';
    if (status === 'closed') return 'text-bg-dark';
    return 'text-bg-secondary';
  }

  async function loadAdvertiserDashboard() {
    const [
      productsResult,
      categoriesResult,
      campaignsResult,
      campaignProductsResult
    ] = await Promise.all([
      window.db
        .from('produtos')
        .select('id, titulo, preco, created_at, updated_at')
        .eq('profile_id', state.session.user.id)
        .order('updated_at', { ascending: false }),
      window.db
        .from('product_categories')
        .select('id, name, created_at, updated_at')
        .eq('profile_id', state.session.user.id)
        .order('sort_order', { ascending: true }),
      window.db
        .from('campaigns')
        .select('id, name, status, commission_type, commission_value, starts_at, ends_at, created_at, updated_at')
        .eq('advertiser_id', state.session.user.id)
        .order('updated_at', { ascending: false }),
      window.db
        .from('campaign_products')
        .select('campaign_id, product_id')
    ]);

    if (productsResult.error) throw productsResult.error;
    if (categoriesResult.error) throw categoriesResult.error;
    if (campaignsResult.error) throw campaignsResult.error;
    if (campaignProductsResult.error) throw campaignProductsResult.error;

    const products = productsResult.data || [];
    const categories = categoriesResult.data || [];
    const campaigns = campaignsResult.data || [];
    const campaignProducts = campaignProductsResult.data || [];
    const activeCampaigns = campaigns.filter((campaign) => campaign.status === 'active').length;
    const linkedProducts = new Set(campaignProducts.map((item) => item.product_id).filter(Boolean)).size;
    const latestItem = [...products, ...categories, ...campaigns].sort((a, b) => {
      return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
    })[0];

    refs.dashboardDescription.textContent = 'Seu workspace ja conecta catalogo e campanhas, deixando a base pronta para operacao de afiliados, tracking e comissoes.';
    refs.metricOneValue.textContent = String(products.length);
    refs.metricTwoValue.textContent = String(activeCampaigns);
    refs.metricThreeValue.textContent = String(linkedProducts);
    refs.metricFourValue.textContent = formatDate(latestItem?.updated_at || latestItem?.created_at);

    renderTable(
      ['Campanha', 'Status', 'Produtos', 'Atualizada'],
      campaigns.slice(0, 5).map((campaign) => {
        const productCount = campaignProducts.filter((item) => item.campaign_id === campaign.id).length;
        const commissionLabel = campaign.commission_type === 'fixed'
          ? formatCurrency(campaign.commission_value)
          : `${Number(campaign.commission_value || 0).toFixed(2)}%`;

        return [
          `<div class="fw-semibold">${campaign.name || 'Campanha sem nome'}</div><div class="small text-secondary">Comissao ${commissionLabel}</div>`,
          `<span class="badge ${getStatusBadge(campaign.status)}">${campaign.status || 'draft'}</span>`,
          `<span class="fw-semibold">${productCount}</span>`,
          `<span class="small text-secondary">${formatDate(campaign.updated_at || campaign.created_at)}</span>`
        ];
      })
    );

    renderActivities([
      {
        title: 'Campanhas em operacao',
        description: campaigns.length ? `${campaigns.length} campanha(s) estruturadas para distribuir aos afiliados.` : 'Crie a primeira campanha para transformar o catalogo em oferta distribuivel.'
      },
      {
        title: 'Base comercial pronta',
        description: products.length ? `${products.length} produto(s) cadastrados e ${categories.length} categoria(s) organizadas no workspace.` : 'Cadastre produtos e categorias antes de abrir a operacao para afiliados.'
      },
      {
        title: 'Tracking preparado',
        description: activeCampaigns ? 'Com campanhas ativas, o modulo de links rastreaveis ja consegue apoiar a distribuicao das ofertas.' : 'Ative pelo menos uma campanha para destravar o uso pelos afiliados.'
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

    refs.dashboardDescription.textContent = 'Use o backoffice para governar papeis, acompanhar qualidade da base e reduzir atritos antes da camada completa de conversoes e payouts.';
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
        title: 'Ativacoes pendentes',
        description: pendingActivation ? `${pendingActivation} conta(s) ainda nao concluiram ativacao por email.` : 'Nenhuma ativacao pendente no momento.'
      },
      {
        title: 'Separacao de perfis concluida',
        description: 'A base ja diferencia admin, anunciante e afiliado, o que simplifica RBAC e futura expansao white label.'
      },
      {
        title: 'Proxima camada',
        description: 'Entram agora conversions, commissions, payout requests, antifraude e observabilidade.'
      }
    ]);
  }

  async function loadAffiliateDashboard() {
    const [catalogResult, linksResult, clicksResult] = await Promise.all([
      window.db.rpc('get_affiliate_campaign_catalog'),
      window.db
        .from('affiliate_links')
        .select('id, code, campaign_id, product_id, created_at')
        .eq('affiliate_id', state.session.user.id)
        .order('created_at', { ascending: false }),
      window.db
        .from('clicks')
        .select('affiliate_link_id')
        .eq('affiliate_id', state.session.user.id)
    ]);

    if (catalogResult.error) throw catalogResult.error;
    if (linksResult.error) throw linksResult.error;
    if (clicksResult.error) throw clicksResult.error;

    const catalog = Array.isArray(catalogResult.data) ? catalogResult.data : [];
    const links = linksResult.data || [];
    const clicks = clicksResult.data || [];
    const uniqueCampaigns = new Set(catalog.map((item) => item.campaign_id).filter(Boolean)).size;
    const clickCountByLink = clicks.reduce((acc, item) => {
      acc[item.affiliate_link_id] = (acc[item.affiliate_link_id] || 0) + 1;
      return acc;
    }, {});
    const totalClicks = Object.values(clickCountByLink).reduce((sum, value) => sum + value, 0);

    refs.dashboardDescription.textContent = 'Seu workspace ja recebe campanhas liberadas, gera links rastreaveis e acompanha cliques reais por oferta.';
    refs.metricOneValue.textContent = String(uniqueCampaigns);
    refs.metricTwoValue.textContent = String(links.length);
    refs.metricThreeValue.textContent = String(totalClicks);
    refs.metricFourValue.textContent = formatCurrency(0);

    renderTable(
      ['Oferta', 'Link', 'Cliques', 'Criado em'],
      links.slice(0, 5).map((link) => {
        const offer = catalog.find((item) => item.campaign_id === link.campaign_id && item.product_id === link.product_id);
        const trackingUrl = window.StoreUtils.getTrackingUrl(link.code);
        return [
          `<div class="fw-semibold">${offer ? `${offer.product_title} · ${offer.campaign_name}` : 'Oferta vinculada'}</div>`,
          `<a href="${trackingUrl}" target="_blank" rel="noopener noreferrer" class="small text-decoration-none">${trackingUrl}</a>`,
          `<span class="fw-semibold">${clickCountByLink[link.id] || 0}</span>`,
          `<span class="small text-secondary">${formatDate(link.created_at)}</span>`
        ];
      })
    );

    renderActivities([
      {
        title: 'Catalogo liberado',
        description: catalog.length ? `${catalog.length} oferta(s) prontas para gerar link e distribuir.` : 'Nenhuma oferta liberada ainda. Assim que o anunciante ativar campanhas, elas aparecerao aqui.'
      },
      {
        title: 'Links em operacao',
        description: links.length ? `${links.length} link(s) rastreaveis ja foram gerados na sua conta.` : 'Gere seu primeiro link rastreavel para iniciar historico de cliques.'
      },
      {
        title: 'Comissao e saque',
        description: 'A proxima entrega conecta conversoes, aprovacao de comissao e solicitacao de payout no mesmo fluxo.'
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
