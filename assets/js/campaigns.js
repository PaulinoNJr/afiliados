(() => {
  const state = {
    session: null,
    profile: null,
    isAdmin: false,
    products: [],
    campaigns: [],
    editingCampaignId: null
  };

  const refs = {
    userRoleBadge: document.getElementById('userRoleBadge'),
    userEmail: document.getElementById('userEmail'),
    logoutBtn: document.getElementById('logoutBtn'),
    status: document.getElementById('statusMessage'),
    statTotalCampaigns: document.getElementById('statTotalCampaigns'),
    statActiveCampaigns: document.getElementById('statActiveCampaigns'),
    statLinkedProducts: document.getElementById('statLinkedProducts'),
    statLastCampaignUpdate: document.getElementById('statLastCampaignUpdate'),
    campaignForm: document.getElementById('campaignForm'),
    campaignFormTitle: document.getElementById('campaignFormTitle'),
    campaignName: document.getElementById('campaignName'),
    campaignDescription: document.getElementById('campaignDescription'),
    campaignStatus: document.getElementById('campaignStatus'),
    campaignCommissionType: document.getElementById('campaignCommissionType'),
    campaignCommissionValue: document.getElementById('campaignCommissionValue'),
    campaignStartsAt: document.getElementById('campaignStartsAt'),
    campaignEndsAt: document.getElementById('campaignEndsAt'),
    campaignProductsChecklist: document.getElementById('campaignProductsChecklist'),
    campaignProductsHint: document.getElementById('campaignProductsHint'),
    saveCampaignBtn: document.getElementById('saveCampaignBtn'),
    cancelCampaignEditBtn: document.getElementById('cancelCampaignEditBtn'),
    clearCampaignFormBtn: document.getElementById('clearCampaignFormBtn'),
    reloadCampaignsBtn: document.getElementById('reloadCampaignsBtn'),
    campaignsTableBody: document.getElementById('campaignsTableBody'),
    campaignsEmptyState: document.getElementById('campaignsEmptyState')
  };

  function showStatus(message, type = 'warning') {
    refs.status.className = `alert alert-${type}`;
    refs.status.textContent = message;
    refs.status.classList.remove('d-none');
  }

  function formatDate(value) {
    if (!value) return 'Sem registros';
    return new Date(value).toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short'
    });
  }

  function applyHeader() {
    refs.userEmail.textContent = state.session.user.email || 'Usuário autenticado';
    refs.userRoleBadge.textContent = window.Auth.getRoleLabel(state.profile?.role);
    refs.userRoleBadge.className = state.isAdmin ? 'badge text-bg-primary' : 'badge text-bg-secondary';
    window.Auth.applyProfileAccess(state.profile);
  }

  function updateFormState() {
    refs.campaignFormTitle.textContent = state.editingCampaignId ? 'Editar campanha' : 'Nova campanha';
    refs.cancelCampaignEditBtn.classList.toggle('d-none', !state.editingCampaignId);
    refs.saveCampaignBtn.textContent = state.editingCampaignId ? 'Atualizar campanha' : 'Salvar campanha';
  }

  function renderProductChecklist(selectedIds = []) {
    refs.campaignProductsChecklist.innerHTML = '';

    if (!state.products.length) {
      refs.campaignProductsHint.textContent = 'Cadastre produtos antes de criar campanhas.';
      return;
    }

    refs.campaignProductsHint.textContent = 'Selecione os produtos que farão parte da campanha.';

    state.products.forEach((product) => {
      const label = document.createElement('label');
      label.className = 'persona-choice-option';
      label.innerHTML = `
        <input type="checkbox" class="form-check-input mt-1" value="${product.id}" ${selectedIds.includes(product.id) ? 'checked' : ''} />
        <span>
          <strong>${product.titulo}</strong>
          <small>${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(product.preco || 0))}</small>
        </span>
      `;
      refs.campaignProductsChecklist.appendChild(label);
    });
  }

  function getSelectedProductIds() {
    return Array.from(refs.campaignProductsChecklist.querySelectorAll('input[type="checkbox"]:checked'))
      .map((input) => input.value)
      .filter(Boolean);
  }

  function resetForm() {
    state.editingCampaignId = null;
    refs.campaignForm.reset();
    refs.campaignCommissionValue.value = '10';
    refs.campaignStatus.value = 'draft';
    refs.campaignCommissionType.value = 'percent';
    renderProductChecklist();
    updateFormState();
  }

  function beginEdit(campaign) {
    state.editingCampaignId = campaign.id;
    refs.campaignName.value = campaign.name || '';
    refs.campaignDescription.value = campaign.description || '';
    refs.campaignStatus.value = campaign.status || 'draft';
    refs.campaignCommissionType.value = campaign.commission_type || 'percent';
    refs.campaignCommissionValue.value = String(campaign.commission_value || 0);
    refs.campaignStartsAt.value = campaign.starts_at ? String(campaign.starts_at).slice(0, 10) : '';
    refs.campaignEndsAt.value = campaign.ends_at ? String(campaign.ends_at).slice(0, 10) : '';
    renderProductChecklist(campaign.productIds || []);
    updateFormState();
  }

  function renderStats() {
    const activeCampaigns = state.campaigns.filter((campaign) => campaign.status === 'active').length;
    const linkedProducts = state.campaigns.reduce((sum, campaign) => sum + (campaign.productIds?.length || 0), 0);
    const latestCampaign = [...state.campaigns].sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))[0];

    refs.statTotalCampaigns.textContent = String(state.campaigns.length);
    refs.statActiveCampaigns.textContent = String(activeCampaigns);
    refs.statLinkedProducts.textContent = String(linkedProducts);
    refs.statLastCampaignUpdate.textContent = formatDate(latestCampaign?.updated_at || latestCampaign?.created_at);
  }

  function renderCampaignsTable() {
    refs.campaignsTableBody.innerHTML = '';

    if (!state.campaigns.length) {
      refs.campaignsEmptyState.classList.remove('d-none');
      return;
    }

    refs.campaignsEmptyState.classList.add('d-none');

    state.campaigns.forEach((campaign) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><div class="fw-semibold">${campaign.name}</div><div class="small text-secondary">${campaign.description || 'Sem descrição'}</div></td>
        <td><span class="badge text-bg-${campaign.status === 'active' ? 'success' : campaign.status === 'paused' ? 'warning' : campaign.status === 'closed' ? 'dark' : 'secondary'}">${campaign.status}</span></td>
        <td>${campaign.commission_type === 'fixed' ? 'R$' : '%'} ${Number(campaign.commission_value || 0).toFixed(2)}</td>
        <td>${campaign.productIds?.length || 0}</td>
        <td>${campaign.starts_at ? String(campaign.starts_at).slice(0, 10) : '-'} / ${campaign.ends_at ? String(campaign.ends_at).slice(0, 10) : '-'}</td>
        <td class="text-end">
          <button type="button" class="btn btn-sm btn-outline-primary me-2" data-action="edit" data-id="${campaign.id}">Editar</button>
          <button type="button" class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${campaign.id}">Excluir</button>
        </td>
      `;
      refs.campaignsTableBody.appendChild(tr);
    });
  }

  async function loadProducts() {
    const { data, error } = await window.db
      .from('produtos')
      .select('id, titulo, preco')
      .eq('profile_id', state.session.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    state.products = data || [];
    renderProductChecklist();
  }

  async function loadCampaigns() {
    const [{ data: campaigns, error: campaignsError }, { data: campaignProducts, error: campaignProductsError }] = await Promise.all([
      window.db
        .from('campaigns')
        .select('id, advertiser_id, name, description, status, commission_type, commission_value, starts_at, ends_at, created_at, updated_at')
        .eq('advertiser_id', state.session.user.id)
        .order('created_at', { ascending: false }),
      window.db.from('campaign_products').select('campaign_id, product_id')
    ]);

    if (campaignsError) throw campaignsError;
    if (campaignProductsError) throw campaignProductsError;

    state.campaigns = (campaigns || []).map((campaign) => ({
      ...campaign,
      productIds: (campaignProducts || [])
        .filter((item) => item.campaign_id === campaign.id)
        .map((item) => item.product_id)
    }));

    renderStats();
    renderCampaignsTable();
  }

  async function saveCampaign(event) {
    event.preventDefault();

    const name = refs.campaignName.value.trim();
    const description = refs.campaignDescription.value.trim();
    const selectedProducts = getSelectedProductIds();

    if (!name) {
      showStatus('Informe o nome da campanha.', 'warning');
      return;
    }

    if (!selectedProducts.length) {
      showStatus('Selecione pelo menos um produto para a campanha.', 'warning');
      return;
    }

    try {
      let campaignId = state.editingCampaignId;
      const payload = {
        advertiser_id: state.session.user.id,
        name,
        description: description || null,
        status: refs.campaignStatus.value,
        commission_type: refs.campaignCommissionType.value,
        commission_value: Number(refs.campaignCommissionValue.value || 0),
        starts_at: refs.campaignStartsAt.value || null,
        ends_at: refs.campaignEndsAt.value || null
      };

      if (campaignId) {
        const { error } = await window.db.from('campaigns').update(payload).eq('id', campaignId);
        if (error) throw error;
      } else {
        const { data, error } = await window.db.from('campaigns').insert(payload).select('id').single();
        if (error) throw error;
        campaignId = data.id;
      }

      const { error: deleteError } = await window.db.from('campaign_products').delete().eq('campaign_id', campaignId);
      if (deleteError) throw deleteError;

      const rows = selectedProducts.map((productId) => ({ campaign_id: campaignId, product_id: productId }));
      const { error: insertError } = await window.db.from('campaign_products').insert(rows);
      if (insertError) throw insertError;

      showStatus(`Campanha ${state.editingCampaignId ? 'atualizada' : 'criada'} com sucesso.`, 'success');
      resetForm();
      await loadCampaigns();
    } catch (err) {
      showStatus(`Erro ao salvar campanha: ${err.message}`, 'danger');
    }
  }

  async function deleteCampaign(campaignId) {
    if (!window.confirm('Deseja realmente excluir esta campanha?')) return;
    try {
      const { error } = await window.db.from('campaigns').delete().eq('id', campaignId);
      if (error) throw error;
      showStatus('Campanha excluída com sucesso.', 'success');
      if (state.editingCampaignId === campaignId) resetForm();
      await loadCampaigns();
    } catch (err) {
      showStatus(`Erro ao excluir campanha: ${err.message}`, 'danger');
    }
  }

  function bindEvents() {
    refs.campaignForm.addEventListener('submit', saveCampaign);
    refs.clearCampaignFormBtn.addEventListener('click', resetForm);
    refs.cancelCampaignEditBtn.addEventListener('click', resetForm);
    refs.reloadCampaignsBtn.addEventListener('click', async () => {
      await loadProducts();
      await loadCampaigns();
    });
    refs.campaignsTableBody.addEventListener('click', async (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const campaign = state.campaigns.find((item) => item.id === button.dataset.id);
      if (!campaign) return;
      if (button.dataset.action === 'edit') beginEdit(campaign);
      if (button.dataset.action === 'delete') await deleteCampaign(campaign.id);
    });
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
      const allowed = await window.Auth.ensureRoleAccess(state.profile, ['admin', 'advertiser']);
      if (!allowed) return;

      state.isAdmin = window.Auth.normalizeRole(state.profile?.role) === 'admin';
      applyHeader();
      updateFormState();
      bindEvents();
      await loadProducts();
      await loadCampaigns();
    } catch (err) {
      showStatus(`Erro ao iniciar campanhas: ${err.message}`, 'danger');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
