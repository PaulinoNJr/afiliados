(() => {
  const state = {
    session: null,
    profile: null,
    isAdmin: false,
    clicks: [],
    profilesById: {},
    campaignsById: {},
    productsById: {},
    conversions: [],
    commissionsByConversionId: {}
  };

  const refs = {
    userRoleBadge: document.getElementById('userRoleBadge'),
    userEmail: document.getElementById('userEmail'),
    logoutBtn: document.getElementById('logoutBtn'),
    status: document.getElementById('statusMessage'),
    menuDashboardLink: document.getElementById('menuDashboardLink'),
    backToDashboardBtn: document.getElementById('backToDashboardBtn'),
    statEligibleClicks: document.getElementById('statEligibleClicks'),
    statConversions: document.getElementById('statConversions'),
    statApprovedConversions: document.getElementById('statApprovedConversions'),
    statGrossVolume: document.getElementById('statGrossVolume'),
    conversionForm: document.getElementById('conversionForm'),
    conversionClickId: document.getElementById('conversionClickId'),
    conversionGrossAmount: document.getElementById('conversionGrossAmount'),
    conversionNetAmount: document.getElementById('conversionNetAmount'),
    conversionOrderId: document.getElementById('conversionOrderId'),
    conversionApproveImmediately: document.getElementById('conversionApproveImmediately'),
    clearConversionFormBtn: document.getElementById('clearConversionFormBtn'),
    saveConversionBtn: document.getElementById('saveConversionBtn'),
    reloadConversionsBtn: document.getElementById('reloadConversionsBtn'),
    clicksTableBody: document.getElementById('clicksTableBody'),
    clicksEmptyState: document.getElementById('clicksEmptyState'),
    conversionsTableBody: document.getElementById('conversionsTableBody'),
    conversionsEmptyState: document.getElementById('conversionsEmptyState')
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

  function getStatusBadge(status) {
    if (status === 'approved') return 'text-bg-success';
    if (status === 'pending') return 'text-bg-warning';
    if (status === 'rejected' || status === 'refunded') return 'text-bg-dark';
    return 'text-bg-secondary';
  }

  function getProfileLabel(userId) {
    const profile = state.profilesById[userId];
    if (!profile) return userId || 'Perfil';
    return window.Auth.getProfileDisplayName(profile) || profile.user_email || userId;
  }

  function applyHeader() {
    refs.userEmail.textContent = state.session.user.email || 'Usuario autenticado';
    refs.userRoleBadge.textContent = window.Auth.getRoleLabel(state.profile?.role);
    refs.userRoleBadge.className = state.isAdmin ? 'badge text-bg-primary' : 'badge text-bg-secondary';
    window.Auth.applyProfileAccess(state.profile);

    const dashboardRoute = state.isAdmin ? 'dashboard-admin.html' : 'dashboard-anunciante.html';
    refs.menuDashboardLink.href = dashboardRoute;
    refs.backToDashboardBtn.href = dashboardRoute;
  }

  function getOfferLabel(click) {
    const campaign = state.campaignsById[click.campaign_id];
    const product = state.productsById[click.product_id];
    return `${product?.titulo || 'Produto'} - ${campaign?.name || 'Campanha'}`;
  }

  function populateClickSelect() {
    refs.conversionClickId.innerHTML = '';

    if (!state.clicks.length) {
      refs.conversionClickId.innerHTML = '<option value="">Nenhum clique disponivel</option>';
      return;
    }

    refs.conversionClickId.innerHTML = '<option value="">Selecione um clique rastreado</option>';
    state.clicks.forEach((click) => {
      const option = document.createElement('option');
      option.value = click.id;
      option.textContent = `${getOfferLabel(click)} - ${formatDate(click.occurred_at)}`;
      refs.conversionClickId.appendChild(option);
    });
  }

  function renderStats() {
    const approvedConversions = state.conversions.filter((item) => item.status === 'approved').length;
    const grossVolume = state.conversions.reduce((sum, item) => sum + Number(item.gross_amount || 0), 0);

    refs.statEligibleClicks.textContent = String(state.clicks.length);
    refs.statConversions.textContent = String(state.conversions.length);
    refs.statApprovedConversions.textContent = String(approvedConversions);
    refs.statGrossVolume.textContent = formatCurrency(grossVolume);
  }

  function renderClicks() {
    refs.clicksTableBody.innerHTML = '';

    if (!state.clicks.length) {
      refs.clicksEmptyState.classList.remove('d-none');
      return;
    }

    refs.clicksEmptyState.classList.add('d-none');

    state.clicks.forEach((click) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><div class="fw-semibold">${getOfferLabel(click)}</div><div class="small text-secondary">${click.id}</div></td>
        <td><div class="fw-semibold">${getProfileLabel(click.affiliate_id)}</div><div class="small text-secondary">${click.affiliate_id}</div></td>
        <td><span class="small text-secondary">${formatDate(click.occurred_at)}</span></td>
        <td class="text-end"><button type="button" class="btn btn-sm btn-outline-primary" data-use-click="${click.id}">Usar clique</button></td>
      `;
      refs.clicksTableBody.appendChild(tr);
    });
  }

  function renderConversions() {
    refs.conversionsTableBody.innerHTML = '';

    if (!state.conversions.length) {
      refs.conversionsEmptyState.classList.remove('d-none');
      return;
    }

    refs.conversionsEmptyState.classList.add('d-none');

    state.conversions.forEach((conversion) => {
      const campaign = state.campaignsById[conversion.campaign_id];
      const commission = state.commissionsByConversionId[conversion.id];
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><div class="fw-semibold">${formatCurrency(conversion.gross_amount)}</div><div class="small text-secondary">${conversion.external_order_id || conversion.id}</div></td>
        <td><span class="badge ${getStatusBadge(conversion.status)}">${conversion.status}</span></td>
        <td><div class="fw-semibold">${campaign?.name || 'Campanha'}</div><div class="small text-secondary">${getProfileLabel(conversion.affiliate_id)} - ${formatDate(conversion.occurred_at)}</div></td>
        <td><div class="fw-semibold">${commission ? formatCurrency(commission.amount) : formatCurrency(0)}</div><div class="small text-secondary">${commission?.status || 'pendente'}</div></td>
        <td><span class="small text-secondary">${formatDate(conversion.approved_at || conversion.created_at)}</span></td>
      `;
      refs.conversionsTableBody.appendChild(tr);
    });
  }

  function clearForm() {
    refs.conversionForm.reset();
    refs.conversionApproveImmediately.checked = true;
  }

  function fillFormFromClick(clickId) {
    refs.conversionClickId.value = clickId;
    refs.conversionGrossAmount.focus();
  }

  async function loadData() {
    const userId = state.session.user.id;
    const campaignQuery = window.db
      .from('campaigns')
      .select('id, advertiser_id, name, status')
      .order('created_at', { ascending: false });

    const conversionsQuery = window.db
      .from('conversions')
      .select('id, click_id, affiliate_id, campaign_id, product_id, external_order_id, gross_amount, net_amount, status, occurred_at, approved_at, created_at')
      .order('created_at', { ascending: false });

    if (!state.isAdmin) {
      campaignQuery.eq('advertiser_id', userId);
    }

    const [{ data: campaigns, error: campaignsError }, { data: products, error: productsError }] = await Promise.all([
      campaignQuery,
      window.db.from('produtos').select('id, profile_id, titulo').order('created_at', { ascending: false })
    ]);

    if (campaignsError) throw campaignsError;
    if (productsError) throw productsError;

    const campaignIds = (campaigns || []).map((item) => item.id);

    state.campaignsById = Object.fromEntries((campaigns || []).map((item) => [item.id, item]));
    state.productsById = Object.fromEntries((products || []).map((item) => [item.id, item]));

    let clicks = [];
    let conversions = [];
    let commissions = [];
    let profiles = [];

    if (campaignIds.length) {
      const [{ data: clicksData, error: clicksError }, { data: conversionsData, error: conversionsError }] = await Promise.all([
        window.db
          .from('clicks')
          .select('id, affiliate_id, campaign_id, product_id, occurred_at')
          .in('campaign_id', campaignIds)
          .order('occurred_at', { ascending: false })
          .limit(50),
        state.isAdmin ? conversionsQuery : conversionsQuery.in('campaign_id', campaignIds)
      ]);

      if (clicksError) throw clicksError;
      if (conversionsError) throw conversionsError;

      clicks = clicksData || [];
      conversions = conversionsData || [];
    } else if (state.isAdmin) {
      const [{ data: clicksData, error: clicksError }, { data: conversionsData, error: conversionsError }] = await Promise.all([
        window.db.from('clicks').select('id, affiliate_id, campaign_id, product_id, occurred_at').order('occurred_at', { ascending: false }).limit(50),
        conversionsQuery
      ]);

      if (clicksError) throw clicksError;
      if (conversionsError) throw conversionsError;

      clicks = clicksData || [];
      conversions = conversionsData || [];
    }

    const affiliateIds = Array.from(new Set([
      ...clicks.map((item) => item.affiliate_id),
      ...conversions.map((item) => item.affiliate_id)
    ].filter(Boolean)));

    if (affiliateIds.length) {
      const { data: profilesData, error: profilesError } = await window.db
        .from('user_profiles')
        .select('user_id, user_email, first_name, last_name, company_name, store_name, role')
        .in('user_id', affiliateIds);

      if (profilesError) throw profilesError;
      profiles = profilesData || [];
    }

    if (conversions.length) {
      const { data: commissionsData, error: commissionsError } = await window.db
        .from('commissions')
        .select('id, conversion_id, amount, status')
        .in('conversion_id', conversions.map((item) => item.id));

      if (commissionsError) throw commissionsError;
      commissions = commissionsData || [];
    }

    state.clicks = clicks.filter((click) => !conversions.some((conversion) => conversion.click_id === click.id));
    state.conversions = conversions;
    state.profilesById = Object.fromEntries(profiles.map((item) => [item.user_id, item]));
    state.commissionsByConversionId = Object.fromEntries(commissions.map((item) => [item.conversion_id, item]));

    populateClickSelect();
    renderStats();
    renderClicks();
    renderConversions();
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const clickId = refs.conversionClickId.value;
    const grossAmount = Number(refs.conversionGrossAmount.value || 0);
    const netAmount = refs.conversionNetAmount.value ? Number(refs.conversionNetAmount.value) : null;
    const orderId = refs.conversionOrderId.value.trim();

    if (!clickId) {
      showStatus('Selecione um clique rastreado.', 'warning');
      return;
    }

    if (!grossAmount || grossAmount <= 0) {
      showStatus('Informe um valor bruto valido.', 'warning');
      return;
    }

    try {
      refs.saveConversionBtn.disabled = true;
      const { error } = await window.db.rpc('register_manual_conversion', {
        target_click_id: clickId,
        gross_amount_value: grossAmount,
        net_amount_value: netAmount,
        external_order_id_value: orderId || null,
        approve_immediately: refs.conversionApproveImmediately.checked
      });
      if (error) throw error;

      showStatus('Conversao registrada com sucesso. A comissao foi recalculada automaticamente.', 'success');
      clearForm();
      await loadData();
    } catch (err) {
      showStatus(`Erro ao registrar conversao: ${err.message}`, 'danger');
    } finally {
      refs.saveConversionBtn.disabled = false;
    }
  }

  function bindEvents() {
    refs.logoutBtn.addEventListener('click', async () => {
      await window.Auth.logout();
      window.location.href = 'login.html';
    });
    refs.reloadConversionsBtn.addEventListener('click', loadData);
    refs.clearConversionFormBtn.addEventListener('click', clearForm);
    refs.conversionForm.addEventListener('submit', handleSubmit);
    refs.clicksTableBody.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-use-click]');
      if (!button) return;
      fillFormFromClick(button.dataset.useClick);
    });
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
      const allowed = await window.Auth.ensureRoleAccess(state.profile, ['admin', 'advertiser']);
      if (!allowed) return;

      state.isAdmin = window.Auth.normalizeRole(state.profile?.role) === 'admin';
      applyHeader();
      bindEvents();
      clearForm();
      await loadData();
    } catch (err) {
      showStatus(`Erro ao iniciar conversoes: ${err.message}`, 'danger');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
