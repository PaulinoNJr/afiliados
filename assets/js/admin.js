(() => {
  const DRAFT_KEY = 'afiliados_admin_form_draft_v3';

  const state = {
    session: null,
    profile: null,
    products: [],
    visibleProducts: [],
    editingId: null,
    role: 'produtor',
    isAdmin: false,
    lastGeneratedSlug: '',
    slugCheckNonce: 0,
    lastAutoFillUrl: '',
    autoFillSourceLabel: null,
    autoFillDiagnostics: null,
    productMeta: createEmptyProductMeta()
  };

  const refs = {
    userRoleBadge: document.getElementById('userRoleBadge'),
    userEmail: document.getElementById('userEmail'),
    logoutBtn: document.getElementById('logoutBtn'),
    manageUsersLink: document.getElementById('manageUsersLink'),
    status: document.getElementById('statusMessage'),
    viewPublicStoreLink: document.getElementById('viewPublicStoreLink'),

    storeProfileForm: document.getElementById('storeProfileForm'),
    saveStoreBtn: document.getElementById('saveStoreBtn'),
    storeName: document.getElementById('storeName'),
    storeSlug: document.getElementById('storeSlug'),
    storeSlugFeedback: document.getElementById('storeSlugFeedback'),
    storeBio: document.getElementById('storeBio'),
    storeBannerUrl: document.getElementById('storeBannerUrl'),
    storeBannerPreview: document.getElementById('storeBannerPreview'),
    storePublicUrl: document.getElementById('storePublicUrl'),
    storePublicUrlLink: document.getElementById('storePublicUrlLink'),

    statTotalProducts: document.getElementById('statTotalProducts'),
    statAveragePrice: document.getElementById('statAveragePrice'),
    statWithDescription: document.getElementById('statWithDescription'),
    statLastUpdate: document.getElementById('statLastUpdate'),

    form: document.getElementById('productForm'),
    formTitle: document.getElementById('formTitle'),
    saveBtn: document.getElementById('saveBtn'),
    cancelEditBtn: document.getElementById('cancelEditBtn'),
    clearFormBtn: document.getElementById('clearFormBtn'),

    linkAfiliado: document.getElementById('linkAfiliado'),
    autoFillBtn: document.getElementById('autoFillBtn'),
    titulo: document.getElementById('titulo'),
    imagemUrl: document.getElementById('imagemUrl'),
    preco: document.getElementById('preco'),
    descricao: document.getElementById('descricao'),

    previewImage: document.getElementById('previewImage'),
    previewTitle: document.getElementById('previewTitle'),
    previewDescription: document.getElementById('previewDescription'),
    previewPrice: document.getElementById('previewPrice'),
    previewLink: document.getElementById('previewLink'),
    previewSourceTag: document.getElementById('previewSourceTag'),

    adminSearchInput: document.getElementById('adminSearchInput'),
    adminFilterSelect: document.getElementById('adminFilterSelect'),
    adminSortSelect: document.getElementById('adminSortSelect'),
    exportCsvBtn: document.getElementById('exportCsvBtn'),
    listSummary: document.getElementById('listSummary'),

    reloadBtn: document.getElementById('reloadBtn'),
    listLoading: document.getElementById('listLoading'),
    tableBody: document.getElementById('productsTableBody'),
    emptyAdminState: document.getElementById('emptyAdminState')
  };

  function createEmptyProductMeta() {
    return {
      source_url: null,
      ml_item_id: null,
      ml_currency: null,
      ml_permalink: null,
      ml_thumbnail: null,
      ml_pictures: []
    };
  }

  function normalizePictures(value) {
    if (!Array.isArray(value)) return [];

    return value
      .map((item) => String(item || '').trim())
      .filter((item) => /^https?:\/\//i.test(item));
  }

  function extractProductMeta(data = {}) {
    return {
      source_url: isFilled(data.source_url) ? String(data.source_url).trim() : null,
      ml_item_id: isFilled(data.ml_item_id) ? String(data.ml_item_id).trim() : null,
      ml_currency: isFilled(data.ml_currency) ? String(data.ml_currency).trim() : null,
      ml_permalink: isFilled(data.ml_permalink) ? String(data.ml_permalink).trim() : null,
      ml_thumbnail: isFilled(data.ml_thumbnail) ? String(data.ml_thumbnail).trim() : null,
      ml_pictures: normalizePictures(data.ml_pictures)
    };
  }

  function mergeProductMeta(data = {}, { overwrite = true } = {}) {
    const incoming = extractProductMeta(data);
    const keys = ['source_url', 'ml_item_id', 'ml_currency', 'ml_permalink', 'ml_thumbnail'];

    keys.forEach((key) => {
      const value = incoming[key];
      if (!value) return;

      if (overwrite || !isFilled(state.productMeta[key])) {
        state.productMeta[key] = value;
      }
    });

    if (incoming.ml_pictures.length && (overwrite || !state.productMeta.ml_pictures.length)) {
      state.productMeta.ml_pictures = incoming.ml_pictures;
    }
  }

  function defaultImage() {
    return 'https://via.placeholder.com/640x480?text=Produto';
  }

  function formatPrice(value) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(Number(value || 0));
  }

  function formatDate(value) {
    if (!value) return '-';
    return new Date(value).toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short'
    });
  }

  function normalizeForSearch(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function isFilled(value) {
    return Boolean(String(value || '').trim());
  }

  function isValidHttpUrl(raw) {
    try {
      const parsed = new URL(raw);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  function showStatus(message, type = 'warning') {
    refs.status.className = `alert alert-${type}`;
    refs.status.textContent = message;
    refs.status.classList.remove('d-none');
  }

  function hideStatus() {
    refs.status.classList.add('d-none');
  }

  function setSaveLoading(isLoading) {
    refs.saveBtn.disabled = isLoading;
    refs.saveBtn.textContent = isLoading
      ? (state.editingId ? 'Atualizando...' : 'Salvando...')
      : (state.editingId ? 'Atualizar produto' : 'Salvar produto');
  }

  function setStoreSaveLoading(isLoading) {
    refs.saveStoreBtn.disabled = isLoading;
    refs.saveStoreBtn.textContent = isLoading ? 'Salvando...' : 'Salvar loja';
  }

  function setAutoFillLoading(isLoading) {
    refs.autoFillBtn.disabled = isLoading;
    refs.autoFillBtn.textContent = isLoading ? 'Buscando...' : 'Preencher';
  }

  function setListLoading(isLoading) {
    refs.listLoading.classList.toggle('d-none', !isLoading);
  }

  function setSlugFeedback(message, tone = 'secondary') {
    refs.storeSlugFeedback.className = `d-block mt-2 text-${tone}`;
    refs.storeSlugFeedback.textContent = message;
  }

  function parsePrice(value) {
    const raw = String(value || '').trim().replace(/\s/g, '');
    if (!raw) return Number.NaN;

    const hasComma = raw.includes(',');
    const hasDot = raw.includes('.');
    let normalized = raw;

    if (hasComma && hasDot) {
      normalized = raw.replace(/\./g, '').replace(',', '.');
    } else if (hasComma) {
      normalized = raw.replace(',', '.');
    }

    normalized = normalized.replace(/[^\d.-]/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }

  function formatPriceInput(value) {
    const parsed = parsePrice(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return '';
    return parsed.toFixed(2).replace('.', ',');
  }

  function getQuality(item) {
    let score = 0;
    if (isFilled(item.titulo)) score += 30;
    if (Number(item.preco) > 0) score += 30;
    if (isFilled(item.imagem_url)) score += 20;
    if (isFilled(item.descricao)) score += 20;

    if (score >= 90) return { score, label: 'Excelente', badgeClass: 'text-bg-success' };
    if (score >= 70) return { score, label: 'Bom', badgeClass: 'text-bg-info' };
    if (score >= 50) return { score, label: 'Regular', badgeClass: 'text-bg-warning' };
    return { score, label: 'Baixo', badgeClass: 'text-bg-danger' };
  }

  function applyRoleUI() {
    refs.userRoleBadge.textContent = state.isAdmin ? 'admin' : 'produtor';
    refs.userRoleBadge.className = state.isAdmin ? 'badge text-bg-primary' : 'badge text-bg-secondary';
    refs.manageUsersLink.classList.toggle('d-none', !state.isAdmin);
  }

  function updateFormHeader() {
    refs.formTitle.textContent = state.editingId ? 'Editar produto' : 'Novo produto';
  }

  function inferCaptureSourceLabel(data = {}) {
    const explicitLabel = String(data.capture_source_label || '').trim();
    if (explicitLabel) return explicitLabel;

    const explicitSource = String(data.capture_source || '').trim().toLowerCase();
    if (explicitSource === 'openclaw') return 'Open.Claw';
    if (explicitSource === 'mercadolivre_api' || explicitSource === 'html') return 'Mercado Livre';
    if (explicitSource === 'openclaw+mercadolivre_api' || explicitSource === 'openclaw+html') {
      return 'Open.Claw + Mercado Livre';
    }

    const candidates = [
      String(data.description_source || '').toLowerCase(),
      String(data.price_source || '').toLowerCase()
    ].filter(Boolean);

    const hasOpenClaw = candidates.some((value) => value.startsWith('openclaw:'));
    const hasMercadoLivre = candidates.some((value) =>
      value.startsWith('api:items.') ||
      value.startsWith('html:') ||
      value.startsWith('jsonld:') ||
      value.startsWith('meta:') ||
      value.startsWith('fallback:social.')
    );

    if (hasOpenClaw && hasMercadoLivre) return 'Open.Claw + Mercado Livre';
    if (hasOpenClaw) return 'Open.Claw';
    if (hasMercadoLivre || data.ml_item_id) return 'Mercado Livre';
    return null;
  }

  function updatePreviewSourceTag() {
    const label = String(state.autoFillSourceLabel || '').trim();
    if (!label) {
      refs.previewSourceTag.textContent = '';
      refs.previewSourceTag.removeAttribute('title');
      refs.previewSourceTag.classList.add('d-none');
      return;
    }

    refs.previewSourceTag.textContent = `Fonte: ${label}`;
    const diagnosticsReason = String(state.autoFillDiagnostics?.reason || '').trim();
    if (diagnosticsReason && label !== 'Open.Claw') {
      refs.previewSourceTag.title = `Open.Claw: ${diagnosticsReason}`;
    } else {
      refs.previewSourceTag.removeAttribute('title');
    }

    refs.previewSourceTag.classList.remove('d-none');
  }

  function updatePreview() {
    const title = refs.titulo.value.trim() || 'Produto sem título';
    const description = refs.descricao.value.trim() || 'Adicione uma descrição para melhorar a conversão.';
    const image = refs.imagemUrl.value.trim();
    const price = parsePrice(refs.preco.value);
    const link = refs.linkAfiliado.value.trim();

    refs.previewTitle.textContent = title;
    refs.previewDescription.textContent = description;
    refs.previewPrice.textContent = Number.isFinite(price) && price > 0 ? formatPrice(price) : 'R$ 0,00';

    refs.previewImage.src = image || defaultImage();
    refs.previewImage.onerror = () => {
      refs.previewImage.src = defaultImage();
    };

    if (isValidHttpUrl(link)) {
      refs.previewLink.href = link;
      refs.previewLink.classList.remove('disabled', 'text-secondary');
      refs.previewLink.setAttribute('aria-disabled', 'false');
    } else {
      refs.previewLink.href = '#';
      refs.previewLink.classList.add('disabled', 'text-secondary');
      refs.previewLink.setAttribute('aria-disabled', 'true');
    }

    updatePreviewSourceTag();
  }

  function updateStorePreview() {
    const slug = window.StoreUtils.normalizeStoreSlug(refs.storeSlug.value);
    const bannerUrl = refs.storeBannerUrl.value.trim();
    const publicUrl = slug ? window.StoreUtils.getStoreUrl(slug) : null;

    if (publicUrl) {
      refs.storePublicUrl.textContent = publicUrl;
      refs.storePublicUrlLink.href = publicUrl;
      refs.storePublicUrlLink.classList.remove('disabled', 'text-secondary');
      refs.storePublicUrlLink.setAttribute('aria-disabled', 'false');
      refs.viewPublicStoreLink.href = publicUrl;
    } else {
      refs.storePublicUrl.textContent = 'Página pública indisponível.';
      refs.storePublicUrlLink.href = 'index.html';
      refs.storePublicUrlLink.classList.add('text-secondary');
      refs.storePublicUrlLink.setAttribute('aria-disabled', 'true');
      refs.viewPublicStoreLink.href = 'index.html';
    }

    if (isValidHttpUrl(bannerUrl)) {
      refs.storeBannerPreview.src = bannerUrl;
      refs.storeBannerPreview.classList.remove('d-none');
      refs.storeBannerPreview.onerror = () => {
        refs.storeBannerPreview.classList.add('d-none');
      };
    } else {
      refs.storeBannerPreview.removeAttribute('src');
      refs.storeBannerPreview.classList.add('d-none');
    }
  }

  function resetPreview() {
    refs.previewTitle.textContent = 'Produto sem título';
    refs.previewDescription.textContent = 'Adicione uma descrição para melhorar a conversão.';
    refs.previewPrice.textContent = 'R$ 0,00';
    refs.previewImage.src = defaultImage();
    refs.previewLink.href = '#';
    refs.previewLink.classList.add('disabled', 'text-secondary');
    refs.previewLink.setAttribute('aria-disabled', 'true');
    updatePreviewSourceTag();
  }

  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // Ignora falhas de storage.
    }
  }

  function saveDraft() {
    if (state.editingId) return;

    const draft = {
      link_afiliado: refs.linkAfiliado.value.trim(),
      titulo: refs.titulo.value.trim(),
      imagem_url: refs.imagemUrl.value.trim(),
      preco: refs.preco.value.trim(),
      descricao: refs.descricao.value.trim()
    };

    const hasData = Object.values(draft).some((value) => isFilled(value));

    try {
      if (!hasData) {
        localStorage.removeItem(DRAFT_KEY);
        return;
      }

      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // Ignora falhas de storage.
    }
  }

  function restoreDraft() {
    if (state.editingId) return;

    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;

      const draft = JSON.parse(raw);
      if (!draft || typeof draft !== 'object') return;

      if (!isFilled(refs.linkAfiliado.value)) refs.linkAfiliado.value = draft.link_afiliado || '';
      if (!isFilled(refs.titulo.value)) refs.titulo.value = draft.titulo || '';
      if (!isFilled(refs.imagemUrl.value)) refs.imagemUrl.value = draft.imagem_url || '';
      if (!isFilled(refs.preco.value)) refs.preco.value = formatPriceInput(draft.preco) || draft.preco || '';
      if (!isFilled(refs.descricao.value)) refs.descricao.value = draft.descricao || '';

      updatePreview();
      showStatus('Rascunho local restaurado automaticamente.', 'info');
    } catch {
      // Ignora rascunho inválido.
    }
  }

  function populateProfileForm(profile) {
    refs.storeName.value = profile?.store_name || '';
    refs.storeSlug.value = profile?.slug || '';
    refs.storeBio.value = profile?.bio || '';
    refs.storeBannerUrl.value = profile?.banner_url || '';
    state.lastGeneratedSlug = refs.storeSlug.value.trim();
    updateStorePreview();
  }

  function resetForm({ clearStoredDraft = true } = {}) {
    refs.form.reset();
    state.editingId = null;
    state.lastAutoFillUrl = '';
    state.autoFillSourceLabel = null;
    state.autoFillDiagnostics = null;
    state.productMeta = createEmptyProductMeta();
    refs.cancelEditBtn.classList.add('d-none');
    updateFormHeader();
    setSaveLoading(false);
    resetPreview();

    if (clearStoredDraft) {
      clearDraft();
    }
  }

  function beginEdit(item) {
    state.editingId = item.id;
    state.autoFillSourceLabel = null;
    state.autoFillDiagnostics = null;
    state.productMeta = extractProductMeta(item);

    refs.linkAfiliado.value = item.link_afiliado || '';
    refs.titulo.value = item.titulo || '';
    refs.imagemUrl.value = item.imagem_url || '';
    refs.preco.value = formatPriceInput(item.preco);
    refs.descricao.value = item.descricao || '';

    refs.cancelEditBtn.classList.remove('d-none');
    updateFormHeader();
    setSaveLoading(false);
    updatePreview();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderMetrics() {
    const total = state.products.length;
    const withDescription = state.products.filter((item) => isFilled(item.descricao)).length;
    const avgPrice = total
      ? state.products.reduce((acc, item) => acc + Number(item.preco || 0), 0) / total
      : 0;

    const lastItem = [...state.products].sort((a, b) => {
      return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
    })[0];

    refs.statTotalProducts.textContent = String(total);
    refs.statAveragePrice.textContent = formatPrice(avgPrice);
    refs.statWithDescription.textContent = total ? `${Math.round((withDescription / total) * 100)}%` : '0%';
    refs.statLastUpdate.textContent = lastItem ? formatDate(lastItem.updated_at || lastItem.created_at) : 'Sem registros';
  }

  function renderTable() {
    refs.tableBody.innerHTML = '';

    if (!state.visibleProducts.length) {
      refs.emptyAdminState.classList.remove('d-none');
      return;
    }

    refs.emptyAdminState.classList.add('d-none');

    state.visibleProducts.forEach((item) => {
      const quality = getQuality(item);
      const tr = document.createElement('tr');

      const tdProduct = document.createElement('td');
      const title = document.createElement('div');
      title.className = 'fw-semibold mb-1';
      title.textContent = item.titulo || 'Produto sem título';

      const description = document.createElement('div');
      description.className = 'small text-secondary mb-1';
      description.textContent = item.descricao
        ? item.descricao.slice(0, 88) + (item.descricao.length > 88 ? '...' : '')
        : 'Sem descrição.';

      const link = document.createElement('a');
      link.href = item.link_afiliado;
      link.target = '_blank';
      link.rel = 'noopener noreferrer nofollow';
      link.className = 'small text-decoration-none';
      link.textContent = 'Abrir link';

      tdProduct.append(title, description, link);

      const tdQuality = document.createElement('td');
      const qualityBadge = document.createElement('span');
      qualityBadge.className = `badge ${quality.badgeClass}`;
      qualityBadge.textContent = `${quality.label} (${quality.score})`;

      const qualityHints = document.createElement('div');
      qualityHints.className = 'small text-secondary mt-1';
      const pending = [];
      if (!isFilled(item.imagem_url)) pending.push('sem imagem');
      if (!isFilled(item.descricao)) pending.push('sem descrição');
      qualityHints.textContent = pending.length ? `Pendências: ${pending.join(' | ')}` : 'Cadastro completo';

      tdQuality.append(qualityBadge, qualityHints);

      const tdPrice = document.createElement('td');
      tdPrice.className = 'text-nowrap fw-semibold';
      tdPrice.textContent = formatPrice(item.preco);

      const tdCreatedAt = document.createElement('td');
      tdCreatedAt.className = 'small text-secondary';
      tdCreatedAt.textContent = formatDate(item.updated_at || item.created_at);

      const tdActions = document.createElement('td');
      tdActions.className = 'text-end';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn btn-sm btn-outline-primary me-2';
      editBtn.textContent = 'Editar';
      editBtn.addEventListener('click', () => beginEdit(item));

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn btn-sm btn-outline-danger';
      deleteBtn.textContent = 'Excluir';
      deleteBtn.addEventListener('click', () => deleteProduct(item.id));

      tdActions.append(editBtn, deleteBtn);
      tr.append(tdProduct, tdQuality, tdPrice, tdCreatedAt, tdActions);
      refs.tableBody.appendChild(tr);
    });
  }

  function applyFiltersAndSort() {
    const term = normalizeForSearch(refs.adminSearchInput.value);
    const filter = refs.adminFilterSelect.value;
    const sort = refs.adminSortSelect.value;

    let products = [...state.products];

    if (term) {
      products = products.filter((item) => {
        const content = [item.titulo, item.descricao, item.link_afiliado]
          .map(normalizeForSearch)
          .join(' ');

        return content.includes(term);
      });
    }

    if (filter === 'missing_image') {
      products = products.filter((item) => !isFilled(item.imagem_url));
    } else if (filter === 'missing_description') {
      products = products.filter((item) => !isFilled(item.descricao));
    } else if (filter === 'incomplete') {
      products = products.filter((item) => !isFilled(item.imagem_url) || !isFilled(item.descricao));
    } else if (filter === 'complete') {
      products = products.filter((item) => isFilled(item.imagem_url) && isFilled(item.descricao));
    }

    products.sort((a, b) => {
      if (sort === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
      if (sort === 'price_desc') return Number(b.preco || 0) - Number(a.preco || 0);
      if (sort === 'price_asc') return Number(a.preco || 0) - Number(b.preco || 0);
      if (sort === 'title_asc') return String(a.titulo || '').localeCompare(String(b.titulo || ''), 'pt-BR');
      return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
    });

    state.visibleProducts = products;
    refs.listSummary.textContent = `${products.length} de ${state.products.length} produtos exibidos.`;
    renderTable();
  }

  async function loadProducts() {
    setListLoading(true);

    try {
      let query = window.db
        .from('produtos')
        .select('id, titulo, preco, imagem_url, link_afiliado, descricao, source_url, created_at, updated_at, profile_id, ml_item_id, ml_currency, ml_permalink, ml_thumbnail, ml_pictures')
        .order('updated_at', { ascending: false });

      if (!state.isAdmin) {
        query = query.eq('profile_id', state.session.user.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      state.products = data || [];
      renderMetrics();
      applyFiltersAndSort();
    } catch (err) {
      showStatus(`Erro ao carregar produtos: ${err.message}`, 'danger');
    } finally {
      setListLoading(false);
    }
  }

  function applyAutoFillData(data, { overwrite = true } = {}) {
    state.autoFillSourceLabel = inferCaptureSourceLabel(data);
    state.autoFillDiagnostics = data.capture_diagnostics || null;
    mergeProductMeta(data, { overwrite });

    if (data.title && (overwrite || !isFilled(refs.titulo.value))) refs.titulo.value = data.title;
    if (data.image && (overwrite || !isFilled(refs.imagemUrl.value))) refs.imagemUrl.value = data.image;
    if (typeof data.price === 'number' && (overwrite || !isFilled(refs.preco.value))) refs.preco.value = formatPriceInput(data.price);
    if (data.description && (overwrite || !isFilled(refs.descricao.value))) refs.descricao.value = data.description;

    if (!isFilled(refs.imagemUrl.value) && state.productMeta.ml_thumbnail) {
      refs.imagemUrl.value = state.productMeta.ml_thumbnail;
    }
  }

  async function fillFromLink({ silent = false, overwrite = true, force = false } = {}) {
    const url = refs.linkAfiliado.value.trim();

    if (!url) {
      if (!silent) showStatus('Informe o link de afiliado para preencher automaticamente.', 'warning');
      return;
    }

    if (!isValidHttpUrl(url)) {
      if (!silent) showStatus('Informe uma URL válida começando com http:// ou https://.', 'warning');
      return;
    }

    if (!force && url === state.lastAutoFillUrl) {
      return;
    }

    setAutoFillLoading(true);

    try {
      const extracted = await window.StoreUtils.extractProductFromUrl(url);
      const data = extracted.metadata || extracted;

      applyAutoFillData(data, { overwrite });
      updatePreview();
      saveDraft();
      state.lastAutoFillUrl = url;

      const filled = [];
      if (data.title) filled.push('nome');
      if (data.image) filled.push('imagem');
      if (typeof data.price === 'number') filled.push('preço');
      if (data.description) filled.push('descrição');

      if (!filled.length) {
        if (!silent) showStatus('Não encontramos metadados suficientes. Complete manualmente.', 'warning');
        return;
      }

      if (!silent) {
        const diagnostics = data.capture_diagnostics || null;
        const openClawNote =
          diagnostics?.status === 'not_configured'
            ? ` Open.Claw não configurada: ${diagnostics.reason}.`
            : diagnostics?.status === 'error'
              ? ` Open.Claw falhou: ${diagnostics.reason}.`
              : '';

        showStatus(
          `Preenchimento automático concluído (${filled.join(', ')}). Fonte: ${inferCaptureSourceLabel(data) || 'desconhecida'}.${openClawNote} Revise antes de salvar.`,
          'success'
        );
      }
    } catch (err) {
      if (!silent) {
        showStatus(`Falha na captura automática: ${err.message}. Você pode preencher manualmente.`, 'warning');
      }
    } finally {
      setAutoFillLoading(false);
    }
  }

  function toCsvCell(value) {
    const text = String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
  }

  function exportVisibleProductsToCsv() {
    if (!state.visibleProducts.length) {
      showStatus('Não há produtos na lista atual para exportar.', 'warning');
      return;
    }

    const rows = [
      ['titulo', 'preco', 'link_afiliado', 'imagem_url', 'descricao', 'created_at'],
      ...state.visibleProducts.map((item) => [
        item.titulo || '',
        Number(item.preco || 0).toFixed(2),
        item.link_afiliado || '',
        item.imagem_url || '',
        item.descricao || '',
        item.created_at || ''
      ])
    ];

    const csv = rows.map((row) => row.map(toCsvCell).join(';')).join('\n');
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);

    anchor.href = url;
    anchor.download = `produtos-${stamp}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);

    showStatus('Exportação CSV concluída.', 'success');
  }

  async function validateSlugAvailability({ silent = false } = {}) {
    const validation = window.StoreUtils.validateStoreSlug(refs.storeSlug.value);
    refs.storeSlug.value = validation.slug;
    updateStorePreview();

    if (!validation.ok) {
      setSlugFeedback(validation.message, 'danger');
      return { ok: false, slug: validation.slug };
    }

    const nonce = ++state.slugCheckNonce;
    setSlugFeedback('Verificando disponibilidade...', 'secondary');

    try {
      const availability = await window.StoreUtils.checkSlugAvailability(validation.slug, state.session.user.id);
      if (nonce !== state.slugCheckNonce) {
        return { ok: false, stale: true, slug: validation.slug };
      }

      if (!availability.available) {
        setSlugFeedback(availability.reason, 'danger');
        if (!silent) showStatus(availability.reason, 'warning');
        return { ok: false, slug: availability.slug };
      }

      setSlugFeedback(availability.reason, 'success');
      return { ok: true, slug: availability.slug };
    } catch (err) {
      setSlugFeedback(`Não foi possível validar o slug: ${err.message}`, 'danger');
      if (!silent) showStatus(`Erro ao validar slug: ${err.message}`, 'danger');
      return { ok: false, slug: validation.slug };
    }
  }

  async function saveStoreProfile(event) {
    event.preventDefault();
    hideStatus();

    const storeName = refs.storeName.value.trim();
    const bio = refs.storeBio.value.trim();
    const bannerUrl = refs.storeBannerUrl.value.trim();

    if (!storeName) {
      showStatus('Informe o nome da loja.', 'warning');
      refs.storeName.focus();
      return;
    }

    if (bannerUrl && !isValidHttpUrl(bannerUrl)) {
      showStatus('Informe uma URL válida para o banner ou deixe o campo vazio.', 'warning');
      refs.storeBannerUrl.focus();
      return;
    }

    const slugResult = await validateSlugAvailability();
    if (!slugResult.ok) {
      refs.storeSlug.focus();
      return;
    }

    setStoreSaveLoading(true);

    try {
      const { data, error } = await window.db
        .from('user_profiles')
        .update({
          store_name: storeName,
          slug: slugResult.slug,
          bio: bio || null,
          banner_url: bannerUrl || null
        })
        .eq('user_id', state.session.user.id)
        .select('user_id, user_email, role, store_name, slug, bio, banner_url, created_at, updated_at')
        .single();

      if (error) throw error;

      state.profile = data;
      populateProfileForm(state.profile);
      showStatus('Dados da loja atualizados com sucesso.', 'success');
    } catch (err) {
      showStatus(`Erro ao salvar loja: ${err.message}`, 'danger');
    } finally {
      setStoreSaveLoading(false);
    }
  }

  async function saveProduct(event) {
    event.preventDefault();
    hideStatus();

    const linkAfiliado = refs.linkAfiliado.value.trim();
    const titulo = refs.titulo.value.trim();
    const imagemUrl = refs.imagemUrl.value.trim();
    const preco = parsePrice(refs.preco.value);
    const descricao = refs.descricao.value.trim();

    if (!isValidHttpUrl(linkAfiliado) || !titulo || Number.isNaN(preco) || preco <= 0) {
      showStatus('Preencha link válido, nome e preço maior que zero.', 'warning');
      return;
    }

    const payload = {
      link_afiliado: linkAfiliado,
      titulo,
      imagem_url: imagemUrl || null,
      preco,
      descricao: descricao || null,
      source_url: state.productMeta.source_url || linkAfiliado,
      ml_item_id: state.productMeta.ml_item_id || null,
      ml_currency: state.productMeta.ml_currency || null,
      ml_permalink: state.productMeta.ml_permalink || null,
      ml_thumbnail: state.productMeta.ml_thumbnail || null,
      ml_pictures: state.productMeta.ml_pictures.length ? state.productMeta.ml_pictures : []
    };

    setSaveLoading(true);

    try {
      if (state.editingId) {
        let query = window.db.from('produtos').update(payload).eq('id', state.editingId);

        if (!state.isAdmin) {
          query = query.eq('profile_id', state.session.user.id);
        }

        const { error } = await query;
        if (error) throw error;

        showStatus('Produto atualizado com sucesso.', 'success');
      } else {
        const { error } = await window.db.from('produtos').insert({
          ...payload,
          profile_id: state.session.user.id,
          created_by: state.session.user.id
        });

        if (error) throw error;
        showStatus('Produto cadastrado com sucesso.', 'success');
      }

      clearDraft();
      resetForm();
      await loadProducts();
    } catch (err) {
      showStatus(`Erro ao salvar produto: ${err.message}`, 'danger');
    } finally {
      setSaveLoading(false);
    }
  }

  async function deleteProduct(id) {
    const item = state.products.find((product) => product.id === id);
    const name = item?.titulo ? `"${item.titulo}"` : 'este produto';
    if (!window.confirm(`Deseja realmente excluir ${name}?`)) return;

    try {
      let query = window.db.from('produtos').delete().eq('id', id);

      if (!state.isAdmin) {
        query = query.eq('profile_id', state.session.user.id);
      }

      const { error } = await query;
      if (error) throw error;

      showStatus('Produto excluído com sucesso.', 'success');
      await loadProducts();
    } catch (err) {
      showStatus(`Erro ao excluir produto: ${err.message}`, 'danger');
    }
  }

  function bindProfileEvents() {
    refs.storeName.addEventListener('input', () => {
      const currentSlug = refs.storeSlug.value.trim();
      const generated = window.StoreUtils.normalizeStoreSlug(refs.storeName.value);

      if (!currentSlug) {
        refs.storeSlug.value = generated;
        state.lastGeneratedSlug = generated;
        setSlugFeedback('Slug sugerido automaticamente. Você pode editar se quiser.', 'secondary');
      }

      updateStorePreview();
    });

    refs.storeSlug.addEventListener('input', () => {
      const normalized = window.StoreUtils.normalizeStoreSlug(refs.storeSlug.value);
      refs.storeSlug.value = normalized;
      updateStorePreview();

      const validation = window.StoreUtils.validateStoreSlug(normalized);
      setSlugFeedback(validation.message, validation.ok ? 'secondary' : 'danger');
    });

    refs.storeSlug.addEventListener('blur', async () => {
      if (!isFilled(refs.storeSlug.value)) return;
      await validateSlugAvailability({ silent: true });
    });

    refs.storeBannerUrl.addEventListener('input', updateStorePreview);
    refs.storeProfileForm.addEventListener('submit', saveStoreProfile);
  }

  function bindFormEvents() {
    [refs.linkAfiliado, refs.titulo, refs.imagemUrl, refs.preco, refs.descricao].forEach((field) => {
      field.addEventListener('input', () => {
        updatePreview();
        saveDraft();
      });
    });

    refs.preco.addEventListener('input', () => {
      if (refs.preco.value.includes('.')) {
        refs.preco.value = refs.preco.value.replace(/\./g, ',');
      }
    });

    refs.preco.addEventListener('blur', () => {
      const formatted = formatPriceInput(refs.preco.value);
      if (formatted) refs.preco.value = formatted;
      updatePreview();
      saveDraft();
    });

    refs.linkAfiliado.addEventListener('blur', async () => {
      const shouldAutoFill =
        isFilled(refs.linkAfiliado.value) &&
        refs.linkAfiliado.value.trim() !== state.lastAutoFillUrl &&
        (!isFilled(refs.titulo.value) || !isFilled(refs.preco.value) || !isFilled(refs.descricao.value));

      if (shouldAutoFill) {
        await fillFromLink({ silent: true, overwrite: false });
      }
    });
  }

  function bindListEvents() {
    refs.adminSearchInput.addEventListener('input', applyFiltersAndSort);
    refs.adminFilterSelect.addEventListener('change', applyFiltersAndSort);
    refs.adminSortSelect.addEventListener('change', applyFiltersAndSort);
    refs.reloadBtn.addEventListener('click', loadProducts);
    refs.exportCsvBtn.addEventListener('click', exportVisibleProductsToCsv);
  }

  async function init() {
    if (window.AppConfig?.missingConfig) {
      showStatus('Configure SUPABASE_URL e SUPABASE_ANON_KEY em assets/js/config.js.', 'warning');
      return;
    }

    try {
      state.session = await window.Auth.requireAuth('login.html');
      if (!state.session) return;

      state.profile = await window.Auth.getProfile();
      state.role = state.profile?.role || 'produtor';
      state.isAdmin = state.role === 'admin';
      applyRoleUI();
      populateProfileForm(state.profile);

      refs.userEmail.textContent = state.session.user.email || 'Usuário autenticado';

      refs.logoutBtn.addEventListener('click', async () => {
        await window.Auth.logout();
        window.location.href = 'login.html';
      });

      refs.form.addEventListener('submit', saveProduct);
      refs.autoFillBtn.addEventListener('click', () => fillFromLink({ silent: false, overwrite: true, force: true }));
      refs.cancelEditBtn.addEventListener('click', () => resetForm({ clearStoredDraft: false }));
      refs.clearFormBtn.addEventListener('click', () => resetForm({ clearStoredDraft: true }));

      bindProfileEvents();
      bindFormEvents();
      bindListEvents();
      restoreDraft();
      updateFormHeader();
      updatePreview();
      await loadProducts();
    } catch (err) {
      showStatus(`Erro ao iniciar o painel: ${err.message}`, 'danger');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
