(() => {
  const DRAFT_KEY = 'vitrine_products_form_draft_v3';

  const state = {
    session: null,
    profile: null,
    role: 'advertiser',
    isAdmin: false,
    productUrlField: 'product_url',
    supportsFeatured: true,
    categories: [],
    products: [],
    visibleProducts: [],
    editingId: null,
    isSavingProduct: false,
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
    productUrl: document.getElementById('productUrl'),
    autoFillBtn: document.getElementById('autoFillBtn'),
    titulo: document.getElementById('titulo'),
    categoriaId: document.getElementById('categoriaId'),
    categoryRequirementHint: document.getElementById('categoryRequirementHint'),
    imagemUrl: document.getElementById('imagemUrl'),
    preco: document.getElementById('preco'),
    isFeatured: document.getElementById('isFeatured'),
    // Some older HTML revisions left the textarea id with broken encoding.
    descricao: document.getElementById('descricao') || document.querySelector('textarea[id*="descri"]'),
    previewFeaturedBadge: document.getElementById('previewFeaturedBadge'),
    previewImage: document.getElementById('previewImage'),
    previewTitle: document.getElementById('previewTitle'),
    previewDescription: document.getElementById('previewDescription'),
    previewPrice: document.getElementById('previewPrice'),
    previewLink: document.getElementById('previewLink'),
    previewSourceTag: document.getElementById('previewSourceTag'),
    adminSearchInput: document.getElementById('adminSearchInput'),
    adminFilterSelect: document.getElementById('adminFilterSelect'),
    adminSortSelect: document.getElementById('adminSortSelect'),
    categoryFilterSelect: document.getElementById('categoryFilterSelect'),
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

  function escapeHtml(value) {
    return window.StoreUtils.escapeHtml(value);
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

  function getCategoryById(categoryId) {
    return state.categories.find((item) => item.id === categoryId) || null;
  }

  function getCategoryName(categoryId) {
    return getCategoryById(categoryId)?.name || 'Sem categoria';
  }

  function getProductCountByCategory(categoryId) {
    return state.products.filter((item) => item.category_id === categoryId).length;
  }

  function getProductUrlValue(item = {}) {
    return String(item.product_url || item.link_afiliado || '').trim();
  }

  function normalizeProductRecord(item = {}) {
    return {
      ...item,
      product_url: getProductUrlValue(item),
      is_featured: Boolean(item.is_featured)
    };
  }

  function isMissingProductUrlColumnError(error) {
    const message = String(error?.message || '').toLowerCase();
    return message.includes('product_url') && message.includes('does not exist');
  }

  function isMissingFeaturedColumnError(error) {
    const message = String(error?.message || '').toLowerCase();
    return message.includes('is_featured') && message.includes('does not exist');
  }

  function prioritizeFeaturedProducts(items = []) {
    const featured = items.filter((item) => item.is_featured);
    const regular = items.filter((item) => !item.is_featured);
    return [...featured, ...regular];
  }

  function hydrateProducts(items = []) {
    return items.map((item) => {
      const normalizedItem = normalizeProductRecord(item);
      const category = getCategoryById(item.category_id);
      return {
        ...normalizedItem,
        category_name: category?.name || 'Sem categoria',
        category_slug: category?.slug || '',
        category_sort_order: Number(category?.sort_order || 0)
      };
    });
  }

  function applyHeader() {
    refs.userEmail.textContent = state.session.user.email || 'Usuário autenticado';
    refs.userRoleBadge.textContent = window.Auth.getRoleLabel(state.profile?.role);
    refs.userRoleBadge.className = state.isAdmin ? 'badge text-bg-primary' : 'badge text-bg-secondary';
    refs.viewPublicStoreLink.href = state.profile?.slug ? window.StoreUtils.getStoreUrl(state.profile.slug) : 'loja.html';
    window.Auth.applyProfileAccess(state.profile);
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
    const title = refs.titulo.value.trim() || 'Produto sem titulo';
    const description = refs.descricao.value.trim() || 'Adicione uma descrição para melhorar a conversão.';
    const image = refs.imagemUrl.value.trim();
    const price = parsePrice(refs.preco.value);
    const link = refs.productUrl.value.trim();
    const isFeatured = refs.isFeatured.checked;

    refs.previewTitle.textContent = title;
    refs.previewDescription.textContent = description;
    refs.previewPrice.textContent = Number.isFinite(price) && price > 0 ? formatPrice(price) : 'R$ 0,00';
    refs.previewFeaturedBadge.classList.toggle('d-none', !isFeatured);
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

  function resetPreviewCard() {
    refs.previewTitle.textContent = 'Produto sem titulo';
    refs.previewDescription.textContent = 'Adicione uma descrição para melhorar a conversão.';
    refs.previewPrice.textContent = 'R$ 0,00';
    refs.previewImage.onerror = null;
    refs.previewImage.src = defaultImage();
    refs.previewLink.href = '#';
    refs.previewLink.classList.add('disabled', 'text-secondary');
    refs.previewSourceTag.classList.add('d-none');
    refs.previewSourceTag.textContent = '';
    refs.previewFeaturedBadge.classList.add('d-none');
  }

  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {}
  }

  function saveDraft() {
    if (state.editingId) return;

    const draft = {
      product_url: refs.productUrl.value.trim(),
      titulo: refs.titulo.value.trim(),
      category_id: refs.categoriaId.value.trim(),
      imagem_url: refs.imagemUrl.value.trim(),
      preco: refs.preco.value.trim(),
      descricao: refs.descricao.value.trim(),
      is_featured: refs.isFeatured.checked
    };

    try {
      const hasDraftContent = draft.is_featured || Object.entries(draft)
        .some(([key, value]) => key !== 'is_featured' && isFilled(value));

      if (hasDraftContent) {
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
      refs.productUrl.value = draft.product_url || '';
      refs.titulo.value = draft.titulo || '';
      refs.imagemUrl.value = draft.imagem_url || '';
      refs.preco.value = formatPriceInput(draft.preco) || draft.preco || '';
      refs.descricao.value = draft.descricao || '';
      refs.isFeatured.checked = Boolean(draft.is_featured);
      if (draft.category_id && getCategoryById(draft.category_id)) {
        refs.categoriaId.value = draft.category_id;
      }
      updatePreview();
    } catch {}
  }

  function getDefaultCategoryId() {
    return state.categories[0]?.id || '';
  }

  function updateProductFormAvailability() {
    const hasCategories = state.categories.length > 0;
    refs.categoriaId.disabled = !hasCategories;
    refs.saveBtn.disabled = state.isSavingProduct || !hasCategories;
    refs.categoryRequirementHint.textContent = hasCategories
      ? 'Selecione a categoria principal deste produto.'
      : 'Você ainda não tem categorias. Abra a página de categorias para criar a primeira.';
  }

  function populateCategoryOptions(preferredId = null) {
    const currentProductCategoryId = preferredId || refs.categoriaId.value || getDefaultCategoryId();
    const currentFilterCategoryId = refs.categoryFilterSelect.value || 'all';

    refs.categoriaId.innerHTML = '';
    refs.categoryFilterSelect.innerHTML = '<option value="all">Todas as categorias</option>';

    if (!state.categories.length) {
      refs.categoriaId.innerHTML = '<option value="">Crie a primeira categoria na página de categorias</option>';
      refs.categoriaId.value = '';
      updateProductFormAvailability();
      return;
    }

    state.categories.forEach((category) => {
      const option = document.createElement('option');
      option.value = category.id;
      option.textContent = `${category.name} (ordem ${category.sort_order})`;
      refs.categoriaId.appendChild(option);

      const filterOption = document.createElement('option');
      filterOption.value = category.id;
      filterOption.textContent = category.name;
      refs.categoryFilterSelect.appendChild(filterOption);
    });

    refs.categoriaId.value = getCategoryById(currentProductCategoryId)?.id || getDefaultCategoryId();
    refs.categoryFilterSelect.value = currentFilterCategoryId === 'all' || getCategoryById(currentFilterCategoryId)
      ? currentFilterCategoryId
      : 'all';

    updateProductFormAvailability();
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
    updateProductFormAvailability();
    if (state.categories.length) refs.categoriaId.value = getDefaultCategoryId();
    refs.isFeatured.checked = false;
    setSaveLoading(false);
    resetPreviewCard();
    if (clearStoredDraft) clearDraft();
  }

  function beginEdit(item) {
    state.editingId = item.id;
    state.productMeta = extractProductMeta(item);
    refs.productUrl.value = getProductUrlValue(item);
    refs.titulo.value = item.titulo || '';
    refs.categoriaId.value = item.category_id || getDefaultCategoryId();
    refs.imagemUrl.value = item.imagem_url || '';
    refs.preco.value = formatPriceInput(item.preco);
    refs.descricao.value = item.descricao || '';
    refs.isFeatured.checked = Boolean(item.is_featured);
    refs.cancelEditBtn.classList.remove('d-none');
    updateFormHeader();
    updatePreview();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function getQuality(item) {
    let score = 0;
    if (isFilled(item.titulo)) score += 25;
    if (Number(item.preco) > 0) score += 25;
    if (isFilled(item.imagem_url)) score += 20;
    if (isFilled(item.descricao)) score += 15;
    if (isFilled(item.category_id)) score += 15;
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
      const descriptionPreview = item.descricao ? `${item.descricao.slice(0, 88)}${item.descricao.length > 88 ? '...' : ''}` : 'Sem descrição.';

      const tdProduct = document.createElement('td');
      tdProduct.innerHTML = `
        ${item.is_featured ? '<span class="product-highlight-badge mb-2">Destaque</span>' : ''}
        <div class="fw-semibold mb-1">${escapeHtml(item.titulo || 'Produto sem titulo')}</div>
        <div class="small text-secondary mb-1">${escapeHtml(descriptionPreview)}</div>
      `;
      const link = document.createElement('a');
      link.href = item.product_url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer nofollow';
      link.className = 'small text-decoration-none';
      link.textContent = 'Abrir link';
      tdProduct.appendChild(link);

      const tdCategory = document.createElement('td');
      tdCategory.innerHTML = `
        <span class="badge text-bg-light">${escapeHtml(item.category_name)}</span>
        <div class="small text-secondary mt-1">ordem ${item.category_sort_order}</div>
      `;

      const tdQuality = document.createElement('td');
      tdQuality.innerHTML = `<span class="badge ${quality.badgeClass}">${quality.label} (${quality.score})</span>`;

      const tdPrice = document.createElement('td');
      tdPrice.className = 'text-nowrap fw-semibold';
      tdPrice.textContent = formatPrice(item.preco);

      const tdCreatedAt = document.createElement('td');
      tdCreatedAt.className = 'small text-secondary';
      tdCreatedAt.textContent = formatDate(item.updated_at || item.created_at);

      const tdFeatured = document.createElement('td');
      tdFeatured.className = 'text-nowrap';
      if (state.supportsFeatured) {
        const featuredBtn = document.createElement('button');
        featuredBtn.type = 'button';
        featuredBtn.className = item.is_featured
          ? 'btn btn-sm btn-warning'
          : 'btn btn-sm btn-outline-warning';
        featuredBtn.textContent = item.is_featured ? 'Em destaque' : 'Destacar';
        featuredBtn.addEventListener('click', () => toggleFeaturedProduct(item));
        tdFeatured.appendChild(featuredBtn);
      } else {
        tdFeatured.innerHTML = '<span class="small text-secondary">Indisponível</span>';
      }

      const tdActions = document.createElement('td');
      tdActions.className = 'text-end';
      const actionsWrap = document.createElement('div');
      actionsWrap.className = 'product-row-actions';
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn btn-sm btn-outline-primary';
      editBtn.textContent = 'Editar';
      editBtn.addEventListener('click', () => beginEdit(item));
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn btn-sm btn-outline-danger';
      deleteBtn.textContent = 'Excluir';
      deleteBtn.addEventListener('click', () => deleteProduct(item.id));
      actionsWrap.append(editBtn, deleteBtn);
      tdActions.appendChild(actionsWrap);

      tr.append(tdProduct, tdCategory, tdQuality, tdPrice, tdCreatedAt, tdFeatured, tdActions);
      refs.tableBody.appendChild(tr);
    });
  }

  function compareByCategoryOrder(a, b) {
    const categoryOrder = Number(a.category_sort_order || 0) - Number(b.category_sort_order || 0);
    if (categoryOrder !== 0) return categoryOrder;

    const categoryName = String(a.category_name || '').localeCompare(String(b.category_name || ''), 'pt-BR');
    if (categoryName !== 0) return categoryName;

    return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
  }

  function applyFiltersAndSort() {
    const term = normalizeForSearch(refs.adminSearchInput.value);
    const filter = refs.adminFilterSelect.value;
    const sort = refs.adminSortSelect.value;
    const categoryFilter = refs.categoryFilterSelect.value;

    let products = [...state.products];

    if (term) {
      products = products.filter((item) => [
        item.titulo,
        item.descricao,
        getProductUrlValue(item),
        item.category_name
      ].map(normalizeForSearch).join(' ').includes(term));
    }

    if (categoryFilter !== 'all') {
      products = products.filter((item) => item.category_id === categoryFilter);
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
      if (sort === 'category_order') return compareByCategoryOrder(a, b);
      return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
    });

    state.visibleProducts = prioritizeFeaturedProducts(products);

    const selectedCategory = categoryFilter !== 'all' ? getCategoryName(categoryFilter) : 'todas as categorias';
    refs.listSummary.textContent = `${products.length} de ${state.products.length} produtos exibidos em ${selectedCategory}.`;
    renderTable();
  }

  async function loadCategories() {
    const { data, error } = await window.db
      .from('product_categories')
      .select('id, profile_id, name, slug, sort_order, created_at, updated_at')
      .eq('profile_id', state.session.user.id)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;

    state.categories = data || [];
    populateCategoryOptions();
  }

  async function queryProductsForWorkspace({ urlField, includeFeatured }) {
    const selectFields = [
      'id',
      'titulo',
      'preco',
      'imagem_url',
      urlField,
      'descricao',
      'source_url',
      'created_at',
      'updated_at',
      'profile_id',
      'category_id',
      'ml_item_id',
      'ml_currency',
      'ml_permalink',
      'ml_thumbnail',
      'ml_pictures'
    ];

    if (includeFeatured) {
      selectFields.push('is_featured');
    }

    return window.db
      .from('produtos')
      .select(selectFields.join(', '))
      .eq('profile_id', state.session.user.id)
      .order('updated_at', { ascending: false });
  }

  async function loadProducts() {
    setListLoading(true);
    try {
      let data = null;
      let error = null;
      const attempts = [
        { urlField: 'product_url', includeFeatured: true },
        { urlField: 'link_afiliado', includeFeatured: true },
        { urlField: 'product_url', includeFeatured: false },
        { urlField: 'link_afiliado', includeFeatured: false }
      ];

      for (const attempt of attempts) {
        const result = await queryProductsForWorkspace(attempt);
        data = result.data;
        error = result.error;

        if (!error) {
          state.productUrlField = attempt.urlField;
          state.supportsFeatured = attempt.includeFeatured;
          break;
        }

        const missingProductUrl = isMissingProductUrlColumnError(error);
        const missingFeatured = isMissingFeaturedColumnError(error);
        const usingLegacyUrl = attempt.urlField === 'link_afiliado';

        if (!missingProductUrl && !missingFeatured) {
          break;
        }

        if (missingProductUrl && usingLegacyUrl && !missingFeatured) {
          continue;
        }
      }

      if (error) throw error;
      state.products = hydrateProducts(data || []);
      renderMetrics();
      applyFiltersAndSort();
    } catch (err) {
      showStatus(`Erro ao carregar produtos: ${err.message}`, 'danger');
    } finally {
      setListLoading(false);
    }
  }

  function setSaveLoading(isLoading) {
    state.isSavingProduct = isLoading;
    refs.saveBtn.textContent = isLoading
      ? (state.editingId ? 'Atualizando...' : 'Salvando...')
      : (state.editingId ? 'Atualizar produto' : 'Salvar produto');
    updateProductFormAvailability();
  }

  function setAutoFillLoading(isLoading) {
    refs.autoFillBtn.disabled = isLoading;
    refs.autoFillBtn.textContent = isLoading ? 'Buscando...' : 'Preencher';
  }

  function setListLoading(isLoading) {
    refs.listLoading.classList.toggle('d-none', !isLoading);
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
    const url = refs.productUrl.value.trim();
    if (!url) {
      if (!silent) showStatus('Informe a URL do produto para preencher automaticamente.', 'warning');
      return;
    }
    if (!isValidHttpUrl(url)) {
      if (!silent) showStatus('Informe uma URL valida com http:// ou https://.', 'warning');
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
      if (!silent) showStatus('Preenchimento automatico concluido. Revise antes de salvar.', 'success');
    } catch (err) {
      if (!silent) showStatus(`Falha na captura automatica: ${err.message}.`, 'warning');
    } finally {
      setAutoFillLoading(false);
    }
  }

  async function clearFeaturedProductFlag(excludeId = null) {
    if (!state.supportsFeatured) return;

    let query = window.db
      .from('produtos')
      .update({ is_featured: false })
      .eq('profile_id', state.session.user.id)
      .eq('is_featured', true);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { error } = await query;
    if (error) throw error;
  }

  async function saveProduct(event) {
    event.preventDefault();
    hideStatus();

    const productUrl = refs.productUrl.value.trim();
    const titulo = refs.titulo.value.trim();
    const categoryId = refs.categoriaId.value.trim();
    const imagemUrl = refs.imagemUrl.value.trim();
    const preco = parsePrice(refs.preco.value);
    const descricao = refs.descricao.value.trim();
    const isFeatured = refs.isFeatured.checked;

    if (!state.categories.length) {
      showStatus('Crie pelo menos uma categoria antes de cadastrar produtos.', 'warning');
      return;
    }

    if (!getCategoryById(categoryId)) {
      showStatus('Selecione uma categoria valida para o produto.', 'warning');
      return;
    }

    if (!isValidHttpUrl(productUrl) || !titulo || Number.isNaN(preco) || preco <= 0) {
      showStatus('Preencha uma URL válida, nome e preço maior que zero.', 'warning');
      return;
    }

    if (isFeatured && !state.supportsFeatured) {
      showStatus('Atualize o schema do Supabase para habilitar o destaque de produtos.', 'warning');
      return;
    }

    const payload = {
      [state.productUrlField]: productUrl,
      titulo,
      category_id: categoryId,
      imagem_url: imagemUrl || null,
      preco,
      descricao: descricao || null,
      source_url: state.productMeta.source_url || productUrl,
      ml_item_id: state.productMeta.ml_item_id || null,
      ml_currency: state.productMeta.ml_currency || null,
      ml_permalink: state.productMeta.ml_permalink || null,
      ml_thumbnail: state.productMeta.ml_thumbnail || null,
      ml_pictures: state.productMeta.ml_pictures.length ? state.productMeta.ml_pictures : []
    };

    if (state.supportsFeatured) {
      payload.is_featured = isFeatured;
    }

    setSaveLoading(true);
    try {
      if (state.editingId) {
        const { error } = await window.db
          .from('produtos')
          .update(payload)
          .eq('id', state.editingId)
          .eq('profile_id', state.session.user.id);
        if (error) throw error;
        if (isFeatured) {
          await clearFeaturedProductFlag(state.editingId);
        }
        showStatus('Produto atualizado com sucesso.', 'success');
      } else {
        const { data, error } = await window.db.from('produtos').insert({
          ...payload,
          profile_id: state.session.user.id,
          created_by: state.session.user.id
        }).select('id').single();
        if (error) throw error;
        if (isFeatured) {
          await clearFeaturedProductFlag(data?.id || null);
        }
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
      const { error } = await window.db
        .from('produtos')
        .delete()
        .eq('id', id)
        .eq('profile_id', state.session.user.id);
      if (error) throw error;
      showStatus('Produto excluido com sucesso.', 'success');
      await loadProducts();
    } catch (err) {
      showStatus(`Erro ao excluir produto: ${err.message}`, 'danger');
    }
  }

  async function toggleFeaturedProduct(item) {
    if (!state.supportsFeatured) {
      showStatus('Atualize o schema do Supabase para habilitar o destaque de produtos.', 'warning');
      return;
    }

    const shouldFeature = !item.is_featured;

    try {
      if (shouldFeature) {
        await clearFeaturedProductFlag(item.id);
      }

      const { error } = await window.db
        .from('produtos')
        .update({ is_featured: shouldFeature })
        .eq('id', item.id)
        .eq('profile_id', state.session.user.id);

      if (error) throw error;

      showStatus(
        shouldFeature
          ? `Produto "${item.titulo}" colocado em destaque.`
          : `Destaque removido de "${item.titulo}".`,
        'success'
      );

      await loadProducts();
    } catch (err) {
      showStatus(`Erro ao atualizar destaque: ${err.message}`, 'danger');
    }
  }

  function exportVisibleProductsToCsv() {
    if (!state.visibleProducts.length) {
      showStatus('Não h? produtos para exportar.', 'warning');
      return;
    }

    const rows = [
      ['titulo', 'categoria', 'categoria_ordem', 'destaque', 'preco', 'product_url', 'imagem_url', 'descricao', 'created_at'],
      ...state.visibleProducts.map((item) => [
        item.titulo || '',
        item.category_name || '',
        item.category_sort_order ?? '',
        item.is_featured ? 'sim' : 'nao',
        Number(item.preco || 0).toFixed(2),
        getProductUrlValue(item),
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
    [refs.productUrl, refs.titulo, refs.imagemUrl, refs.preco, refs.descricao].forEach((field) => {
      field.addEventListener('input', () => {
        updatePreview();
        saveDraft();
      });
    });

    refs.isFeatured.addEventListener('change', () => {
      updatePreview();
      saveDraft();
    });

    refs.categoriaId.addEventListener('change', saveDraft);

    refs.preco.addEventListener('blur', () => {
      const formatted = formatPriceInput(refs.preco.value);
      if (formatted) refs.preco.value = formatted;
      updatePreview();
    });

    refs.productUrl.addEventListener('blur', async () => {
      const shouldAutoFill = isFilled(refs.productUrl.value) &&
        refs.productUrl.value.trim() !== state.lastAutoFillUrl &&
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
    refs.categoryFilterSelect.addEventListener('change', applyFiltersAndSort);
    refs.reloadBtn.addEventListener('click', async () => {
      await loadCategories();
      await loadProducts();
    });
    refs.exportCsvBtn.addEventListener('click', exportVisibleProductsToCsv);
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
      state.role = window.Auth.normalizeRole(state.profile?.role);
      state.isAdmin = state.role === 'admin';
      applyHeader();
      bindEvents();
      refs.logoutBtn.addEventListener('click', async () => {
        await window.Auth.logout();
        window.location.href = 'login.html';
      });

      updateFormHeader();
      updatePreview();
      await loadCategories();
      restoreDraft();
      await loadProducts();
    } catch (err) {
      showStatus(`Erro ao iniciar a gestão de produtos: ${err.message}`, 'danger');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
