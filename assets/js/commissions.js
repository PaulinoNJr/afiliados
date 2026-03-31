(() => {
  const state = {
    session: null,
    profile: null,
    summary: null,
    commissions: [],
    payouts: []
  };

  const refs = {
    userRoleBadge: document.getElementById('userRoleBadge'),
    userEmail: document.getElementById('userEmail'),
    logoutBtn: document.getElementById('logoutBtn'),
    status: document.getElementById('statusMessage'),
    statPendingAmount: document.getElementById('statPendingAmount'),
    statAvailableAmount: document.getElementById('statAvailableAmount'),
    statAwaitingPayoutAmount: document.getElementById('statAwaitingPayoutAmount'),
    statPaidAmount: document.getElementById('statPaidAmount'),
    payoutHint: document.getElementById('payoutHint'),
    payoutRequestForm: document.getElementById('payoutRequestForm'),
    payoutAmount: document.getElementById('payoutAmount'),
    requestPayoutBtn: document.getElementById('requestPayoutBtn'),
    reloadFinanceBtn: document.getElementById('reloadFinanceBtn'),
    commissionsTableBody: document.getElementById('commissionsTableBody'),
    commissionsEmptyState: document.getElementById('commissionsEmptyState'),
    payoutsTableBody: document.getElementById('payoutsTableBody'),
    payoutsEmptyState: document.getElementById('payoutsEmptyState')
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
    if (status === 'available') return 'text-bg-success';
    if (status === 'paid') return 'text-bg-primary';
    if (status === 'pending') return 'text-bg-warning';
    if (status === 'requested' || status === 'approved' || status === 'processing') return 'text-bg-secondary';
    if (status === 'rejected' || status === 'reversed' || status === 'refunded') return 'text-bg-dark';
    return 'text-bg-light';
  }

  function applyHeader() {
    refs.userEmail.textContent = state.session.user.email || 'Usuario autenticado';
    refs.userRoleBadge.textContent = window.Auth.getRoleLabel(state.profile?.role);
    refs.userRoleBadge.className = window.Auth.normalizeRole(state.profile?.role) === 'admin' ? 'badge text-bg-primary' : 'badge text-bg-secondary';
    window.Auth.applyProfileAccess(state.profile);
  }

  function renderSummary() {
    const summary = state.summary || {};
    const availableAmount = Number(summary.available_amount || 0);
    const payoutMinimum = Number(summary.payout_minimum || 0);
    const canRequest = availableAmount > 0 && availableAmount >= payoutMinimum;

    refs.statPendingAmount.textContent = formatCurrency(summary.pending_amount);
    refs.statAvailableAmount.textContent = formatCurrency(availableAmount);
    refs.statAwaitingPayoutAmount.textContent = formatCurrency(summary.awaiting_payout_amount);
    refs.statPaidAmount.textContent = formatCurrency(summary.paid_amount);
    refs.payoutAmount.value = availableAmount ? availableAmount.toFixed(2) : '';
    refs.requestPayoutBtn.disabled = !canRequest;
    refs.payoutHint.textContent = canRequest
      ? `Saldo disponivel ${formatCurrency(availableAmount)}. Nesta etapa, o pedido usa o saldo integral. Saque minimo atual: ${formatCurrency(payoutMinimum)}.`
      : `Voce precisa ter ao menos ${formatCurrency(payoutMinimum)} disponivel para solicitar saque.`;
  }

  function renderCommissions() {
    refs.commissionsTableBody.innerHTML = '';

    if (!state.commissions.length) {
      refs.commissionsEmptyState.classList.remove('d-none');
      return;
    }

    refs.commissionsEmptyState.classList.add('d-none');
    state.commissions.forEach((commission) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><div class="fw-semibold">${formatCurrency(commission.amount)}</div><div class="small text-secondary">ID ${commission.id}</div></td>
        <td><span class="badge ${getStatusBadge(commission.status)}">${commission.status}</span></td>
        <td><span class="small text-secondary">${commission.conversion_id || 'Sem conversao'}</span></td>
        <td><span class="small text-secondary">${formatDate(commission.available_at || commission.created_at)}</span></td>
      `;
      refs.commissionsTableBody.appendChild(tr);
    });
  }

  function renderPayouts() {
    refs.payoutsTableBody.innerHTML = '';

    if (!state.payouts.length) {
      refs.payoutsEmptyState.classList.remove('d-none');
      return;
    }

    refs.payoutsEmptyState.classList.add('d-none');
    state.payouts.forEach((payout) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><div class="fw-semibold">${formatCurrency(payout.amount)}</div><div class="small text-secondary">${formatDate(payout.requested_at || payout.created_at)}</div></td>
        <td><span class="badge ${getStatusBadge(payout.status)}">${payout.status}</span></td>
        <td><span class="small text-secondary">${formatDate(payout.processed_at)}</span></td>
        <td><span class="small text-secondary">${payout.notes || 'Sem observacoes'}</span></td>
      `;
      refs.payoutsTableBody.appendChild(tr);
    });
  }

  async function loadFinance() {
    const userId = state.session.user.id;
    const [summaryResult, commissionsResult, payoutsResult] = await Promise.all([
      window.db.rpc('get_affiliate_financial_summary', {
        target_affiliate_id: userId
      }),
      window.db
        .from('commissions')
        .select('id, conversion_id, amount, status, available_at, created_at')
        .eq('affiliate_id', userId)
        .order('created_at', { ascending: false }),
      window.db
        .from('payout_requests')
        .select('id, amount, status, notes, requested_at, processed_at, created_at')
        .eq('affiliate_id', userId)
        .order('requested_at', { ascending: false })
    ]);

    if (summaryResult.error) throw summaryResult.error;
    if (commissionsResult.error) throw commissionsResult.error;
    if (payoutsResult.error) throw payoutsResult.error;

    state.summary = Array.isArray(summaryResult.data) ? (summaryResult.data[0] || {}) : (summaryResult.data || {});
    state.commissions = commissionsResult.data || [];
    state.payouts = payoutsResult.data || [];

    renderSummary();
    renderCommissions();
    renderPayouts();
  }

  async function handlePayoutRequest(event) {
    event.preventDefault();

    try {
      refs.requestPayoutBtn.disabled = true;
      const amount = Number(refs.payoutAmount.value || 0);
      const { error } = await window.db.rpc('request_payout', {
        request_amount: amount
      });
      if (error) throw error;

      showStatus('Solicitacao de saque registrada com sucesso.', 'success');
      await loadFinance();
    } catch (err) {
      showStatus(`Erro ao solicitar saque: ${err.message}`, 'danger');
    } finally {
      refs.requestPayoutBtn.disabled = false;
    }
  }

  function bindEvents() {
    refs.reloadFinanceBtn.addEventListener('click', loadFinance);
    refs.payoutRequestForm.addEventListener('submit', handlePayoutRequest);
    refs.logoutBtn.addEventListener('click', async () => {
      await window.Auth.logout();
      window.location.href = 'login.html';
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
      const allowed = await window.Auth.ensureRoleAccess(state.profile, ['affiliate', 'admin']);
      if (!allowed) return;

      applyHeader();
      bindEvents();
      await loadFinance();
    } catch (err) {
      showStatus(`Erro ao iniciar financeiro: ${err.message}`, 'danger');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
