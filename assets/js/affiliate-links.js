(() => {
  const state = {
    session: null,
    profile: null,
    catalog: [],
    links: [],
    clickCountByLink: {}
  };

  const refs = {
    userRoleBadge: document.getElementById('userRoleBadge'),
    userEmail: document.getElementById('userEmail'),
    logoutBtn: document.getElementById('logoutBtn'),
    status: document.getElementById('statusMessage'),
    statCatalogItems: document.getElementById('statCatalogItems'),
    statGeneratedLinks: document.getElementById('statGeneratedLinks'),
    statTrackedClicks: document.getElementById('statTrackedClicks'),
    statLastGeneratedLink: document.getElementById('statLastGeneratedLink'),
    catalogGrid: document.getElementById('catalogGrid'),
    catalogEmptyState: document.getElementById('catalogEmptyState'),
    reloadCatalogBtn: document.getElementById('reloadCatalogBtn'),
    reloadLinksBtn: document.getElementById('reloadLinksBtn'),
    linksTableBody: document.getElementById('linksTableBody'),
    linksEmptyState: document.getElementById('linksEmptyState')
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

  function applyHeader() {
    refs.userEmail.textContent = state.session.user.email || 'Usuário autenticado';
    refs.userRoleBadge.textContent = window.Auth.getRoleLabel(state.profile?.role);
    refs.userRoleBadge.className = window.Auth.normalizeRole(state.profile?.role) === 'admin' ? 'badge text-bg-primary' : 'badge text-bg-secondary';
    window.Auth.applyProfileAccess(state.profile);
  }

  function getOfferLabel(item) {
    return `${item.product_title} · ${item.campaign_name}`;
  }

  function renderStats() {
    const totalClicks = Object.values(state.clickCountByLink).reduce((sum, value) => sum + value, 0);
    refs.statCatalogItems.textContent = String(state.catalog.length);
    refs.statGeneratedLinks.textContent = String(state.links.length);
    refs.statTrackedClicks.textContent = String(totalClicks);
    refs.statLastGeneratedLink.textContent = formatDate(state.links[0]?.created_at);
  }

  function renderCatalog() {
    refs.catalogGrid.innerHTML = '';

    if (!state.catalog.length) {
      refs.catalogEmptyState.classList.remove('d-none');
      return;
    }

    refs.catalogEmptyState.classList.add('d-none');

    state.catalog.forEach((item) => {
      const column = document.createElement('div');
      column.className = 'col-12 col-lg-6';
      column.innerHTML = `
        <article class="card border-0 shadow-sm h-100">
          <div class="card-body p-4">
            <p class="dashboard-link-label">${item.advertiser_name}</p>
            <h2 class="h5">${item.product_title}</h2>
            <p class="text-secondary small mb-3">${item.campaign_name}${item.campaign_description ? ` · ${item.campaign_description}` : ''}</p>
            <div class="d-flex flex-wrap gap-2 mb-3">
              <span class="badge text-bg-light">${item.commission_type === 'fixed' ? 'Comissão fixa' : 'Comissão percentual'}</span>
              <span class="badge text-bg-secondary">${item.commission_type === 'fixed' ? formatCurrency(item.commission_value) : `${Number(item.commission_value || 0).toFixed(2)}%`}</span>
            </div>
            <p class="fw-semibold mb-4">${formatCurrency(item.product_price)}</p>
            <button type="button" class="btn btn-primary w-100" data-generate-link="true" data-campaign-id="${item.campaign_id}" data-product-id="${item.product_id}">
              Gerar link rastreável
            </button>
          </div>
        </article>
      `;
      refs.catalogGrid.appendChild(column);
    });
  }

  function renderLinks() {
    refs.linksTableBody.innerHTML = '';

    if (!state.links.length) {
      refs.linksEmptyState.classList.remove('d-none');
      return;
    }

    refs.linksEmptyState.classList.add('d-none');

    state.links.forEach((link) => {
      const matchingCatalog = state.catalog.find((item) => item.campaign_id === link.campaign_id && item.product_id === link.product_id);
      const trackingUrl = window.StoreUtils.getTrackingUrl(link.code);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><div class="fw-semibold">${matchingCatalog ? getOfferLabel(matchingCatalog) : 'Oferta vinculada'}</div><div class="small text-secondary">${formatDate(link.created_at)}</div></td>
        <td><a href="${trackingUrl}" target="_blank" rel="noopener noreferrer" class="small text-decoration-none">${trackingUrl}</a></td>
        <td>${state.clickCountByLink[link.id] || 0}</td>
        <td class="text-end"><button type="button" class="btn btn-sm btn-outline-primary" data-copy-link="${trackingUrl}">Copiar</button></td>
      `;
      refs.linksTableBody.appendChild(tr);
    });
  }

  async function loadCatalog() {
    const { data, error } = await window.db.rpc('get_affiliate_campaign_catalog');
    if (error) throw error;
    state.catalog = Array.isArray(data) ? data : [];
    renderCatalog();
  }

  async function loadLinks() {
    const [{ data: links, error: linksError }, { data: clicks, error: clicksError }] = await Promise.all([
      window.db.from('affiliate_links').select('id, code, campaign_id, product_id, created_at').eq('affiliate_id', state.session.user.id).order('created_at', { ascending: false }),
      window.db.from('clicks').select('affiliate_link_id').eq('affiliate_id', state.session.user.id)
    ]);

    if (linksError) throw linksError;
    if (clicksError) throw clicksError;

    state.links = links || [];
    state.clickCountByLink = (clicks || []).reduce((acc, item) => {
      acc[item.affiliate_link_id] = (acc[item.affiliate_link_id] || 0) + 1;
      return acc;
    }, {});
    renderLinks();
    renderStats();
  }

  async function generateLink(campaignId, productId) {
    try {
      const { data, error } = await window.db.rpc('create_affiliate_link', {
        target_campaign_id: campaignId,
        target_product_id: productId
      });
      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      const trackingUrl = window.StoreUtils.getTrackingUrl(row?.code);
      if (row?.code && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(trackingUrl);
      }

      showStatus('Link rastreável gerado com sucesso.', 'success');
      await loadLinks();
    } catch (err) {
      showStatus(`Erro ao gerar link: ${err.message}`, 'danger');
    }
  }

  async function copyLink(value) {
    try {
      await navigator.clipboard.writeText(value);
      showStatus('Link rastreável copiado com sucesso.', 'success');
    } catch {
      showStatus('Não foi possível copiar o link automaticamente.', 'warning');
    }
  }

  function bindEvents() {
    refs.reloadCatalogBtn.addEventListener('click', async () => {
      await loadCatalog();
      await loadLinks();
    });
    refs.reloadLinksBtn.addEventListener('click', loadLinks);
    refs.catalogGrid.addEventListener('click', async (event) => {
      const button = event.target.closest('button[data-generate-link]');
      if (!button) return;
      await generateLink(button.dataset.campaignId, button.dataset.productId);
    });
    refs.linksTableBody.addEventListener('click', async (event) => {
      const button = event.target.closest('button[data-copy-link]');
      if (!button) return;
      await copyLink(button.dataset.copyLink);
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
      const allowed = await window.Auth.ensureRoleAccess(state.profile, ['affiliate', 'admin']);
      if (!allowed) return;

      applyHeader();
      bindEvents();
      await loadCatalog();
      await loadLinks();
    } catch (err) {
      showStatus(`Erro ao iniciar links rastreáveis: ${err.message}`, 'danger');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
