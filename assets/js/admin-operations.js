(() => {
  const state = {
    session: null,
    profile: null,
    payoutMinimum: 100,
    conversionFilter: 'pending',
    payoutFilter: 'open',
    conversions: [],
    payouts: [],
    auditLogs: [],
    profilesById: {},
    campaignsById: {},
    productsById: {},
    commissionsByConversionId: {}
  };

  const refs = {
    userRoleBadge: document.getElementById('userRoleBadge'),
    userEmail: document.getElementById('userEmail'),
    logoutBtn: document.getElementById('logoutBtn'),
    status: document.getElementById('statusMessage'),
    reloadOperationsBtn: document.getElementById('reloadOperationsBtn'),
    payoutMinimumHint: document.getElementById('payoutMinimumHint'),
    payoutMinimumForm: document.getElementById('payoutMinimumForm'),
    payoutMinimumAmount: document.getElementById('payoutMinimumAmount'),
    savePayoutMinimumBtn: document.getElementById('savePayoutMinimumBtn'),
    conversionFilterButtons: document.querySelectorAll('[data-conversions-filter]'),
    payoutFilterButtons: document.querySelectorAll('[data-payouts-filter]'),
    statPendingConversions: document.getElementById('statPendingConversions'),
    statOpenPayouts: document.getElementById('statOpenPayouts'),
    statQueuedAmount: document.getElementById('statQueuedAmount'),
    statPaidAmount: document.getElementById('statPaidAmount'),
    conversionsTableBody: document.getElementById('conversionsTableBody'),
    conversionsEmptyState: document.getElementById('conversionsEmptyState'),
    payoutsTableBody: document.getElementById('payoutsTableBody'),
    payoutsEmptyState: document.getElementById('payoutsEmptyState'),
    auditLogsTableBody: document.getElementById('auditLogsTableBody'),
    auditLogsEmptyState: document.getElementById('auditLogsEmptyState')
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

  function getStatusBadge(status) {
    if (status === 'approved' || status === 'available') return 'text-bg-success';
    if (status === 'pending') return 'text-bg-warning';
    if (status === 'processing') return 'text-bg-info';
    if (status === 'paid') return 'text-bg-primary';
    if (status === 'requested') return 'text-bg-secondary';
    if (status === 'rejected' || status === 'refunded' || status === 'reversed') return 'text-bg-dark';
    return 'text-bg-light';
  }

  function getActionLabel(status) {
    if (status === 'approved') return 'aprovar';
    if (status === 'rejected') return 'rejeitar';
    if (status === 'refunded') return 'estornar';
    if (status === 'processing') return 'marcar como em processamento';
    if (status === 'paid') return 'marcar como pago';
    return status || 'atualizar';
  }

  function applyHeader() {
    refs.userEmail.textContent = state.session.user.email || 'Usuario autenticado';
    refs.userRoleBadge.textContent = window.Auth.getRoleLabel(state.profile?.role);
    refs.userRoleBadge.className = 'badge text-bg-primary';
    window.Auth.applyProfileAccess(state.profile);
  }

  function getProfileLabel(userId) {
    const profile = state.profilesById[userId];
    if (!profile) return userId || 'Perfil';
    return window.Auth.getProfileDisplayName(profile) || profile.user_email || userId;
  }

  function getOfferLabel(conversion) {
    const campaign = state.campaignsById[conversion.campaign_id];
    const product = state.productsById[conversion.product_id];
    return `${product?.titulo || 'Produto'} - ${campaign?.name || 'Campanha'}`;
  }

  function formatAuditEvent(log) {
    const metadata = log.metadata || {};

    if (log.event_type === 'update_payout_minimum') {
      return {
        title: 'Atualizacao do minimo de saque',
        detail: `De ${formatCurrency(metadata.previous_amount || 0)} para ${formatCurrency(metadata.new_amount || 0)}.`
      };
    }

    if (log.event_type === 'review_conversion') {
      return {
        title: 'Revisao de conversao',
        detail: `${metadata.previous_status || 'desconhecido'} -> ${metadata.new_status || 'desconhecido'}.`
      };
    }

    if (log.event_type === 'review_payout_request') {
      return {
        title: 'Revisao de saque',
        detail: `${metadata.previous_status || 'desconhecido'} -> ${metadata.new_status || 'desconhecido'}.`
      };
    }

    return {
      title: log.event_type || 'Evento',
      detail: log.entity_type || 'Sem contexto'
    };
  }

  function renderStats() {
    const pendingConversions = state.conversions.filter((item) => item.status === 'pending').length;
    const openPayouts = state.payouts.filter((item) => ['requested', 'approved', 'processing'].includes(item.status)).length;
    const queuedAmount = state.payouts
      .filter((item) => ['requested', 'approved', 'processing'].includes(item.status))
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const paidAmount = state.payouts
      .filter((item) => item.status === 'paid')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    refs.statPendingConversions.textContent = String(pendingConversions);
    refs.statOpenPayouts.textContent = String(openPayouts);
    refs.statQueuedAmount.textContent = formatCurrency(queuedAmount);
    refs.statPaidAmount.textContent = formatCurrency(paidAmount);
  }

  function renderSettings() {
    refs.payoutMinimumAmount.value = Number(state.payoutMinimum || 0).toFixed(2);
    refs.payoutMinimumHint.textContent = `Regra atual exibida aos afiliados: saque minimo de ${formatCurrency(state.payoutMinimum)}.`;
  }

  function updateFilterButtons(buttons, activeValue) {
    buttons.forEach((button) => {
      const isActive = button.dataset.conversionsFilter === activeValue || button.dataset.payoutsFilter === activeValue;
      button.className = isActive ? 'btn btn-primary' : 'btn btn-outline-secondary';
    });
  }

  function getFilteredConversions() {
    if (state.conversionFilter === 'reviewed') {
      return state.conversions.filter((item) => item.status !== 'pending');
    }

    if (state.conversionFilter === 'all') {
      return state.conversions;
    }

    return state.conversions.filter((item) => item.status === 'pending');
  }

  function getFilteredPayouts() {
    if (state.payoutFilter === 'finalized') {
      return state.payouts.filter((item) => ['paid', 'rejected'].includes(item.status));
    }

    if (state.payoutFilter === 'all') {
      return state.payouts;
    }

    return state.payouts.filter((item) => ['requested', 'approved', 'processing'].includes(item.status));
  }

  function getConversionActions(conversion) {
    if (conversion.status === 'pending') {
      return `
        <div class="d-flex justify-content-end gap-2 flex-wrap">
          <button type="button" class="btn btn-sm btn-outline-success" data-conversion-action="approved" data-conversion-id="${conversion.id}">Aprovar</button>
          <button type="button" class="btn btn-sm btn-outline-dark" data-conversion-action="rejected" data-conversion-id="${conversion.id}">Rejeitar</button>
        </div>
      `;
    }

    if (conversion.status === 'approved') {
      return `
        <div class="d-flex justify-content-end gap-2 flex-wrap">
          <button type="button" class="btn btn-sm btn-outline-warning" data-conversion-action="refunded" data-conversion-id="${conversion.id}">Estornar</button>
        </div>
      `;
    }

    return '<span class="small text-secondary">Sem acao</span>';
  }

  function renderConversions() {
    const filteredConversions = getFilteredConversions();
    refs.conversionsTableBody.innerHTML = '';
    updateFilterButtons(refs.conversionFilterButtons, state.conversionFilter);

    if (!filteredConversions.length) {
      refs.conversionsEmptyState.classList.remove('d-none');
      refs.conversionsEmptyState.textContent = 'Nenhuma conversao encontrada para este filtro.';
      return;
    }

    refs.conversionsEmptyState.classList.add('d-none');

    filteredConversions.forEach((conversion) => {
      const commission = state.commissionsByConversionId[conversion.id];
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div class="fw-semibold">${formatCurrency(conversion.gross_amount)}</div>
          <div class="small text-secondary">${escapeHtml(conversion.external_order_id || conversion.id)}</div>
          <div class="small text-secondary">${formatDate(conversion.occurred_at || conversion.created_at)}</div>
        </td>
        <td>
          <div class="fw-semibold">${escapeHtml(getProfileLabel(conversion.affiliate_id))}</div>
          <div class="small text-secondary">${escapeHtml(conversion.affiliate_id)}</div>
        </td>
        <td>
          <div class="fw-semibold">${escapeHtml(getOfferLabel(conversion))}</div>
          <div class="small text-secondary">Liquido ${formatCurrency(conversion.net_amount || conversion.gross_amount)}</div>
        </td>
        <td>
          <div class="fw-semibold">${commission ? formatCurrency(commission.amount) : formatCurrency(0)}</div>
          <div class="small text-secondary">${escapeHtml(commission?.status || 'sem calculo')}</div>
        </td>
        <td><span class="badge ${getStatusBadge(conversion.status)}">${escapeHtml(conversion.status)}</span></td>
        <td class="text-end">${getConversionActions(conversion)}</td>
      `;
      refs.conversionsTableBody.appendChild(tr);
    });
  }

  function getPayoutActions(payout) {
    if (payout.status === 'requested') {
      return `
        <div class="d-flex justify-content-end gap-2 flex-wrap">
          <button type="button" class="btn btn-sm btn-outline-success" data-payout-action="approved" data-payout-id="${payout.id}">Aprovar</button>
          <button type="button" class="btn btn-sm btn-outline-dark" data-payout-action="rejected" data-payout-id="${payout.id}">Rejeitar</button>
        </div>
      `;
    }

    if (payout.status === 'approved') {
      return `
        <div class="d-flex justify-content-end gap-2 flex-wrap">
          <button type="button" class="btn btn-sm btn-outline-primary" data-payout-action="processing" data-payout-id="${payout.id}">Processar</button>
          <button type="button" class="btn btn-sm btn-outline-success" data-payout-action="paid" data-payout-id="${payout.id}">Marcar pago</button>
          <button type="button" class="btn btn-sm btn-outline-dark" data-payout-action="rejected" data-payout-id="${payout.id}">Rejeitar</button>
        </div>
      `;
    }

    if (payout.status === 'processing') {
      return `
        <div class="d-flex justify-content-end gap-2 flex-wrap">
          <button type="button" class="btn btn-sm btn-outline-success" data-payout-action="paid" data-payout-id="${payout.id}">Marcar pago</button>
          <button type="button" class="btn btn-sm btn-outline-dark" data-payout-action="rejected" data-payout-id="${payout.id}">Rejeitar</button>
        </div>
      `;
    }

    return '<span class="small text-secondary">Sem acao</span>';
  }

  function renderPayouts() {
    const filteredPayouts = getFilteredPayouts();
    refs.payoutsTableBody.innerHTML = '';
    updateFilterButtons(refs.payoutFilterButtons, state.payoutFilter);

    if (!filteredPayouts.length) {
      refs.payoutsEmptyState.classList.remove('d-none');
      refs.payoutsEmptyState.textContent = 'Nenhuma solicitacao de saque encontrada para este filtro.';
      return;
    }

    refs.payoutsEmptyState.classList.add('d-none');

    filteredPayouts.forEach((payout) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div class="fw-semibold">${formatCurrency(payout.amount)}</div>
          <div class="small text-secondary">${formatDate(payout.requested_at || payout.created_at)}</div>
        </td>
        <td>
          <div class="fw-semibold">${escapeHtml(getProfileLabel(payout.affiliate_id))}</div>
          <div class="small text-secondary">${escapeHtml(payout.affiliate_id)}</div>
        </td>
        <td>
          <span class="badge ${getStatusBadge(payout.status)}">${escapeHtml(payout.status)}</span>
          <div class="small text-secondary">${formatDate(payout.processed_at)}</div>
        </td>
        <td><span class="small text-secondary">${escapeHtml(payout.notes || 'Sem observacoes')}</span></td>
        <td class="text-end">${getPayoutActions(payout)}</td>
      `;
      refs.payoutsTableBody.appendChild(tr);
    });
  }

  function renderAuditLogs() {
    refs.auditLogsTableBody.innerHTML = '';

    if (!state.auditLogs.length) {
      refs.auditLogsEmptyState.classList.remove('d-none');
      return;
    }

    refs.auditLogsEmptyState.classList.add('d-none');

    state.auditLogs.forEach((log) => {
      const eventInfo = formatAuditEvent(log);
      const adminLabel = getProfileLabel(log.admin_user_id);
      const metadata = log.metadata || {};
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="small text-secondary">${formatDate(log.created_at)}</span></td>
        <td>
          <div class="fw-semibold">${escapeHtml(adminLabel)}</div>
          <div class="small text-secondary">${escapeHtml(log.admin_user_id)}</div>
        </td>
        <td>
          <div class="fw-semibold">${escapeHtml(eventInfo.title)}</div>
          <div class="small text-secondary">${escapeHtml(eventInfo.detail)}</div>
        </td>
        <td>
          <div class="small text-secondary">${escapeHtml(log.entity_type || 'sem entidade')} ${escapeHtml(log.entity_id || '')}</div>
          <div class="small text-secondary">${escapeHtml(metadata.note || metadata.setting_key || 'Sem observacoes adicionais')}</div>
        </td>
      `;
      refs.auditLogsTableBody.appendChild(tr);
    });
  }

  async function loadData() {
    const [profilesResult, campaignsResult, productsResult, conversionsResult, payoutsResult, settingsResult, auditLogsResult] = await Promise.all([
      window.db
        .from('user_profiles')
        .select('user_id, user_email, first_name, last_name, company_name, store_name, role')
        .order('created_at', { ascending: false }),
      window.db
        .from('campaigns')
        .select('id, name')
        .order('created_at', { ascending: false }),
      window.db
        .from('produtos')
        .select('id, titulo')
        .order('created_at', { ascending: false }),
      window.db
        .from('conversions')
        .select('id, affiliate_id, campaign_id, product_id, external_order_id, gross_amount, net_amount, status, occurred_at, approved_at, created_at')
        .order('created_at', { ascending: false })
        .limit(100),
      window.db
        .from('payout_requests')
        .select('id, affiliate_id, amount, status, notes, requested_at, processed_at, created_at')
        .order('requested_at', { ascending: false })
        .limit(100),
      window.db
        .from('settings')
        .select('key, value')
        .eq('key', 'payout.minimum_amount')
        .maybeSingle(),
      window.db
        .from('admin_audit_logs')
        .select('id, admin_user_id, event_type, entity_type, entity_id, metadata, created_at')
        .order('created_at', { ascending: false })
        .limit(20)
    ]);

    if (profilesResult.error) throw profilesResult.error;
    if (campaignsResult.error) throw campaignsResult.error;
    if (productsResult.error) throw productsResult.error;
    if (conversionsResult.error) throw conversionsResult.error;
    if (payoutsResult.error) throw payoutsResult.error;
    if (settingsResult.error) throw settingsResult.error;
    if (auditLogsResult.error) throw auditLogsResult.error;

    state.profilesById = Object.fromEntries((profilesResult.data || []).map((item) => [item.user_id, item]));
    state.campaignsById = Object.fromEntries((campaignsResult.data || []).map((item) => [item.id, item]));
    state.productsById = Object.fromEntries((productsResult.data || []).map((item) => [item.id, item]));
    state.conversions = conversionsResult.data || [];
    state.payouts = payoutsResult.data || [];
    state.payoutMinimum = Number(settingsResult.data?.value?.amount || 100);
    state.auditLogs = auditLogsResult.data || [];

    if (state.conversions.length) {
      const { data: commissionsData, error: commissionsError } = await window.db
        .from('commissions')
        .select('id, conversion_id, amount, status, payout_request_id')
        .in('conversion_id', state.conversions.map((item) => item.id));

      if (commissionsError) throw commissionsError;
      state.commissionsByConversionId = Object.fromEntries((commissionsData || []).map((item) => [item.conversion_id, item]));
    } else {
      state.commissionsByConversionId = {};
    }

    renderStats();
    renderSettings();
    renderConversions();
    renderPayouts();
    renderAuditLogs();
  }

  async function handlePayoutMinimumSubmit(event) {
    event.preventDefault();

    const amount = Number(refs.payoutMinimumAmount.value || 0);
    if (!amount || amount <= 0) {
      showStatus('Informe um valor minimo valido para saque.', 'warning');
      return;
    }

    try {
      refs.savePayoutMinimumBtn.disabled = true;
      const { error } = await window.db.rpc('set_payout_minimum_amount', {
        minimum_amount: amount
      });

      if (error) throw error;

      state.payoutMinimum = amount;
      await loadData();
      showStatus('Minimo de saque atualizado com sucesso.', 'success');
    } catch (err) {
      showStatus(`Erro ao salvar regra de saque: ${err.message}`, 'danger');
    } finally {
      refs.savePayoutMinimumBtn.disabled = false;
    }
  }

  async function handleConversionAction(conversionId, status) {
    const confirmed = window.confirm(`Deseja ${getActionLabel(status)} esta conversao?`);
    if (!confirmed) return;
    const actionNote = window.prompt(`Observacao opcional para ${getActionLabel(status)} esta conversao:`, '');
    if (actionNote === null) return;

    try {
      const { error } = await window.db.rpc('review_conversion', {
        target_conversion_id: conversionId,
        target_status: status,
        action_note: actionNote.trim() || null
      });
      if (error) throw error;

      showStatus(`Conversao atualizada para ${status}.`, 'success');
      await loadData();
    } catch (err) {
      showStatus(`Erro ao revisar conversao: ${err.message}`, 'danger');
    }
  }

  async function handlePayoutAction(payoutId, status) {
    const actionLabel = getActionLabel(status);
    const actionNote = window.prompt(`Observacao opcional para ${actionLabel} este saque:`, '');
    if (actionNote === null) return;

    try {
      const { error } = await window.db.rpc('review_payout_request', {
        target_payout_request_id: payoutId,
        target_status: status,
        action_note: actionNote.trim() || null
      });
      if (error) throw error;

      showStatus(`Solicitacao de saque atualizada para ${status}.`, 'success');
      await loadData();
    } catch (err) {
      showStatus(`Erro ao revisar saque: ${err.message}`, 'danger');
    }
  }

  function bindEvents() {
    refs.logoutBtn.addEventListener('click', async () => {
      await window.Auth.logout();
      window.location.href = 'login.html';
    });

    refs.reloadOperationsBtn.addEventListener('click', loadData);
    refs.payoutMinimumForm.addEventListener('submit', handlePayoutMinimumSubmit);
    refs.conversionFilterButtons.forEach((button) => {
      button.addEventListener('click', () => {
        state.conversionFilter = button.dataset.conversionsFilter || 'pending';
        renderConversions();
      });
    });
    refs.payoutFilterButtons.forEach((button) => {
      button.addEventListener('click', () => {
        state.payoutFilter = button.dataset.payoutsFilter || 'open';
        renderPayouts();
      });
    });

    refs.conversionsTableBody.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-conversion-action]');
      if (!button) return;
      handleConversionAction(button.dataset.conversionId, button.dataset.conversionAction);
    });

    refs.payoutsTableBody.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-payout-action]');
      if (!button) return;
      handlePayoutAction(button.dataset.payoutId, button.dataset.payoutAction);
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

      const allowed = await window.Auth.ensureRoleAccess(state.profile, ['admin']);
      if (!allowed) return;

      applyHeader();
      bindEvents();
      await loadData();
    } catch (err) {
      showStatus(`Erro ao iniciar operacoes: ${err.message}`, 'danger');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
