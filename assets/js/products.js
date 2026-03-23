(() => {
  const DRAFT_KEY = 'afiliados_products_form_draft_v1';

  const state = {
    session: null,
    profile: null,
    role: 'produtor',
    isAdmin: false,
    products: [],
    visibleProducts: [],
    editingId: null,
    lastAutoFillUrl: '',
    autoFillSourceLabel: null,
    autoFillDiagnostics: null,
    productMeta: createEmptyProductMeta()
  };

  const refs = {
    userRoleBadge: document.getElementById('userRoleBadge'),
    userEmail: document.getElementById('userEmail'),
    logoutBtn: document.getElementById('logoutBtn'),
    status: document.getElementById('statusMessage'),
    viewPublicStoreLink: document.getElementById('viewPublicStoreLink'),
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

  function normalizeForSearch(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function normalizePictures(value) {
    if (!Array.isArray(value)) return [];
    return value.map((item) => String(item || '').trim()).filter((item) => /^https?:\/\//i.test(item));
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
    ['source_url', 'ml_item_id', 'ml_currency', 'ml_permalink', 'ml_thumbnail'].forEach((key) => {
      if (!incoming[key]) return;
      if (overwrite || !isFilled(state.productMeta[key])) state.productMeta[key] = incoming[key];
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

  function parsePrice(value) {
    const raw = String(value || '').trim().replace(/\s/g, '');
    if (!raw) return Number.NaN;

    let normalized = raw;
    if (raw.includes(',') && raw.includes('.')) {
      normalized = raw.replace(/\./g, '').replace(',', '.');
    } else if (raw.includes(',')) {
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

  function setAutoFillLoading(isLoading) {
    refs.autoFillBtn.disabled = isLoading;
    refs.autoFillBtn.textContent = isLoading ? 'Buscando...' : 'Preencher';
  }

  function setListLoading(isLoading) {
    refs.listLoading.classList.toggle('d-none', !isLoading);
  }

  function applyHeader() {
    refs.userEmail.textContent = state.session.user.email || 'Usuário autenticado';
    refs.userRoleBadge.textContent = state.isAdmin ? 'admin' : 'produtor';
    refs.userRoleBadge.className = state.isAdmin ? 'badge text-bg-primary' : 'badge text-bg-secondary';
    refs.viewPublicStoreLink.href = state.profile?.slug ? window.StoreUtils.getStoreUrl(state.profile.slug) : 'loja.html';
  }

  function updateFormHeader() {
    refs.formTitle.textContent = state.editingId ? 'Editar produto' : 'Novo produto';
  }

  function inferCaptureSourceLabel(data = {}) {
    const explicitLabel = String(data.capture_source_label || '').trim();
    if (explicitLabel) return explicitLabel;
    const source = String(data.capture_source || '').trim().toLowerCase();
    if (source === 'openclaw') return 'Open.Claw';
    if (source === 'mercadolivre_api' || source === 'html') return 'Mercado Livre';
    if (source === 'openclaw+mercadolivre_api' || source === 'openclaw+html') return 'Open.Claw + Mercado Livre';
    return null;
  }

  function updatePreviewSourceTag() {
    const label = String(state.autoFillSourceLabel || '').trim();
    if (!label) {
      refs.previewSourceTag.classList.add('d-none');
      refs.previewSourceTag.textContent = '';
      return;
    }

    refs.previewSourceTag.textContent = `Fonte: ${label}`;
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
    } else {
      refs.previewLink.href = '#';
      refs.previewLink.classList.add('disabled', 'text-secondary');
    }

    updatePreviewSourceTag();
  }

  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {}
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

    try {
      if (Object.values(draft).some((value) => isFilled(value))) {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } else {
        localStorage.removeItem(DRAFT_KEY);
      }
    } catch {}
  }

  function restoreDraft() {
    if (state.editingId) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      refs.linkAfiliado.value = draft.link_afiliado || '';
      refs.titulo.value = draft.titulo || '';
      refs.imagemUrl.value = draft.imagem_url || '';
      refs.preco.value = formatPriceInput(draft.preco) || draft.preco || '';
      refs.descricao.value = draft.descricao || '';
      updatePreview();
    } catch {}
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
    updatePreview();
    if (clearStoredDraft) clearDraft();
  }

  function beginEdit(item) {
    state.editingId = item.id;
    state.productMeta = extractProductMeta(item);
    refs.linkAfiliado.value = item.link_afiliado || '';
    refs.titulo.value = item.titulo || '';
    refs.imagemUrl.value = item.imagem_url || '';
    refs.preco.value = formatPriceInput(item.preco);
    refs.descricao.value = item.descricao || '';
    refs.cancelEditBtn.classList.remove('d-none');
    updateFormHeader();
    updatePreview();
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  function renderMetrics() {
    const total = state.products.length;
    const withDescription = state.products.filter((item) => isFilled(item.descricao)).length;
    const avgPrice = total ? state.products.reduce((sum, item) => sum + Number(item.preco || 0), 0) / total : 0;
    const lastItem = [...state.products].sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))[0];

    refs.statTotalProducts.textContent = String(total);
    refs.statAveragePrice.textContent = formatPrice(avgPrice);
    refs.statWithDescription.textContent = total ? `${Math.round((withDescription / total) * 100)}%` : '0%';
    refs.statLastUpdate.textContent = formatDate(lastItem?.updated_at || lastItem?.created_at);
  }

  function renderTable() {
    refs.tableBody.innerHTML = '';
    if (!state.visibleProducts.length) {
      refs.emptyAdminState.classList.remove('d-none');
      return;
    }

    refs.emptyAdminState.classList.add('d-none');

    state.visibleProducts.forEach((item) => {
      const tr = document.createElement('tr');
      const quality = getQuality(item);

      const tdProduct = document.createElement('td');
      tdProduct.innerHTML = `<div class="fw-semibold mb-1">${item.titulo || 'Produto sem título'}</div><div class="small text-secondary mb-1">${item.descricao ? `${item.descricao.slice(0, 88)}${item.descricao.length > 88 ? '...' : ''}` : 'Sem descrição.'}</div>`;
      const link = document.createElement('a');
      link.href = item.link_afiliado;
      link.target = '_blank';
      link.rel = 'noopener noreferrer nofollow';
      link.className = 'small text-decoration-none';
      link.textContent = 'Abrir link';
      tdProduct.appendChild(link);

      const tdQuality = document.createElement('td');
      tdQuality.innerHTML = `<span class="badge ${quality.badgeClass}">${quality.label} (${quality.score})</span>`;

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
      products = products.filter((item) => [item.titulo, item.descricao, item.link_afiliado].map(normalizeForSearch).join(' ').includes(term));
    }

    if (filter === 'missing_image') products = products.filter((item) => !isFilled(item.imagem_url));
    if (filter === 'missing_description') products = products.filter((item) => !isFilled(item.descricao));
    if (filter === 'incomplete') products = products.filter((item) => !isFilled(item.imagem_url) || !isFilled(item.descricao));
    if (filter === 'complete') products = products.filter((item) => isFilled(item.imagem_url) && isFilled(item.descricao));

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

      if (!state.isAdmin) query = query.eq('profile_id', state.session.user.id);

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
    if (!isFilled(refs.imagemUrl.value) && state.productMeta.ml_thumbnail) refs.imagemUrl.value = state.productMeta.ml_thumbnail;
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
    if (!force && url === state.lastAutoFillUrl) return;

    setAutoFillLoading(true);
    try {
      const extracted = await window.StoreUtils.extractProductFromUrl(url);
      const data = extracted.metadata || extracted;
      applyAutoFillData(data, { overwrite });
      updatePreview();
      saveDraft();
      state.lastAutoFillUrl = url;
      if (!silent) showStatus('Preenchimento automático concluído. Revise antes de salvar.', 'success');
    } catch (err) {
      if (!silent) showStatus(`Falha na captura automática: ${err.message}.`, 'warning');
    } finally {
      setAutoFillLoading(false);
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
        if (!state.isAdmin) query = query.eq('profile_id', state.session.user.id);
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
      if (!state.isAdmin) query = query.eq('profile_id', state.session.user.id);
      const { error } = await query;
      if (error) throw error;
      showStatus('Produto excluído com sucesso.', 'success');
      await loadProducts();
    } catch (err) {
      showStatus(`Erro ao excluir produto: ${err.message}`, 'danger');
    }
  }

  function exportVisibleProductsToCsv() {
    if (!state.visibleProducts.length) {
      showStatus('Não há produtos para exportar.', 'warning');
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

    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `produtos-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showStatus('Exportação CSV concluída.', 'success');
  }

  function bindEvents() {
    [refs.linkAfiliado, refs.titulo, refs.imagemUrl, refs.preco, refs.descricao].forEach((field) => {
      field.addEventListener('input', () => {
        updatePreview();
        saveDraft();
      });
    });

    refs.preco.addEventListener('blur', () => {
      const formatted = formatPriceInput(refs.preco.value);
      if (formatted) refs.preco.value = formatted;
      updatePreview();
    });

    refs.linkAfiliado.addEventListener('blur', async () => {
      const shouldAutoFill = isFilled(refs.linkAfiliado.value) &&
        refs.linkAfiliado.value.trim() !== state.lastAutoFillUrl &&
        (!isFilled(refs.titulo.value) || !isFilled(refs.preco.value) || !isFilled(refs.descricao.value));
      if (shouldAutoFill) await fillFromLink({ silent: true, overwrite: false });
    });

    refs.form.addEventListener('submit', saveProduct);
    refs.autoFillBtn.addEventListener('click', () => fillFromLink({ silent: false, overwrite: true, force: true }));
    refs.cancelEditBtn.addEventListener('click', () => resetForm({ clearStoredDraft: false }));
    refs.clearFormBtn.addEventListener('click', () => resetForm({ clearStoredDraft: true }));
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
      applyHeader();
      bindEvents();
      refs.logoutBtn.addEventListener('click', async () => {
        await window.Auth.logout();
        window.location.href = 'login.html';
      });

      restoreDraft();
      updateFormHeader();
      updatePreview();
      await loadProducts();
    } catch (err) {
      showStatus(`Erro ao iniciar a gestão de produtos: ${err.message}`, 'danger');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
