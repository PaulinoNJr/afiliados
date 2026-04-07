(() => {
  const state = {
    session: null,
    profile: null,
    role: 'advertiser',
    isAdmin: false,
    categories: [],
    products: [],
    categoryEditingId: null,
    isSavingCategory: false
  };

  const refs = {
    userRoleBadge: document.getElementById('userRoleBadge'),
    userEmail: document.getElementById('userEmail'),
    logoutBtn: document.getElementById('logoutBtn'),
    status: document.getElementById('statusMessage'),
    viewPublicStoreLink: document.getElementById('viewPublicStoreLink'),
    productsPageLink: document.getElementById('productsPageLink'),
    statTotalCategories: document.getElementById('statTotalCategories'),
    statCategoriesWithProducts: document.getElementById('statCategoriesWithProducts'),
    statProductsCategorized: document.getElementById('statProductsCategorized'),
    statLastCategoryUpdate: document.getElementById('statLastCategoryUpdate'),
    categoryForm: document.getElementById('categoryForm'),
    categoryFormTitle: document.getElementById('categoryFormTitle'),
    categoryName: document.getElementById('categoryName'),
    categorySortOrder: document.getElementById('categorySortOrder'),
    saveCategoryBtn: document.getElementById('saveCategoryBtn'),
    cancelCategoryEditBtn: document.getElementById('cancelCategoryEditBtn'),
    clearCategoryFormBtn: document.getElementById('clearCategoryFormBtn'),
    reloadCategoriesBtn: document.getElementById('reloadCategoriesBtn'),
    categoriesList: document.getElementById('categoriesList'),
    categoriesEmptyState: document.getElementById('categoriesEmptyState')
  };

  function isFilled(value) {
    return Boolean(String(value || '').trim());
  }

  function parseSortOrder(value) {
    if (!isFilled(value)) return null;
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  function formatDate(value) {
    if (!value) return '-';
    return new Date(value).toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short'
    });
  }

  function showStatus(message, type = 'warning') {
    refs.status.className = `alert alert-${type}`;
    refs.status.textContent = message;
    refs.status.classList.remove('d-none');
  }

  function escapeHtml(value) {
    return window.StoreUtils.escapeHtml(value);
  }

  function hideStatus() {
    refs.status.classList.add('d-none');
  }

  function getProductCountByCategory(categoryId) {
    return state.products.filter((item) => item.category_id === categoryId).length;
  }

  function applyHeader() {
    refs.userEmail.textContent = state.session.user.email || 'Usuário autenticado';
    refs.userRoleBadge.textContent = window.Auth.getRoleLabel(state.profile?.role);
    refs.userRoleBadge.className = state.isAdmin ? 'badge text-bg-primary' : 'badge text-bg-secondary';
    refs.viewPublicStoreLink.href = state.profile?.slug ? window.StoreUtils.getStoreUrl(state.profile.slug) : 'loja.html';
    refs.productsPageLink.href = 'produtos.html';
    window.Auth.applyProfileAccess(state.profile);
  }

  function updateCategoryFormHeader() {
    refs.categoryFormTitle.textContent = state.categoryEditingId ? 'Editar categoria' : 'Nova categoria';
    refs.saveCategoryBtn.textContent = state.isSavingCategory
      ? (state.categoryEditingId ? 'Atualizando...' : 'Salvando...')
      : (state.categoryEditingId ? 'Atualizar categoria' : 'Salvar categoria');
    refs.cancelCategoryEditBtn.classList.toggle('d-none', !state.categoryEditingId);
  }

  function setCategorySaveLoading(isLoading) {
    state.isSavingCategory = isLoading;
    refs.saveCategoryBtn.disabled = isLoading;
    refs.categoryName.disabled = isLoading;
    refs.categorySortOrder.disabled = isLoading;
    refs.clearCategoryFormBtn.disabled = isLoading;
    updateCategoryFormHeader();
  }

  function resetCategoryForm() {
    refs.categoryForm.reset();
    state.categoryEditingId = null;
    state.isSavingCategory = false;
    updateCategoryFormHeader();
  }

  function beginCategoryEdit(category) {
    state.categoryEditingId = category.id;
    refs.categoryName.value = category.name || '';
    refs.categorySortOrder.value = Number.isFinite(Number(category.sort_order)) ? String(category.sort_order) : '';
    updateCategoryFormHeader();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderMetrics() {
    const totalCategories = state.categories.length;
    const categoriesWithProducts = state.categories.filter((category) => getProductCountByCategory(category.id) > 0).length;
    const totalProductsCategorized = state.products.length;
    const lastCategory = [...state.categories].sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))[0];

    refs.statTotalCategories.textContent = String(totalCategories);
    refs.statCategoriesWithProducts.textContent = String(categoriesWithProducts);
    refs.statProductsCategorized.textContent = String(totalProductsCategorized);
    refs.statLastCategoryUpdate.textContent = formatDate(lastCategory?.updated_at || lastCategory?.created_at);
  }

  function renderCategoriesList() {
    refs.categoriesList.innerHTML = '';

    if (!state.categories.length) {
      refs.categoriesEmptyState.classList.remove('d-none');
      return;
    }

    refs.categoriesEmptyState.classList.add('d-none');

    state.categories.forEach((category) => {
      const count = getProductCountByCategory(category.id);
      const row = document.createElement('article');
      row.className = 'category-admin-item';

      const content = document.createElement('div');
      content.className = 'category-admin-copy';
      content.innerHTML = `
        <div class="d-flex flex-wrap gap-2 align-items-center mb-1">
          <strong>${escapeHtml(category.name)}</strong>
          <span class="badge text-bg-light">ordem ${category.sort_order}</span>
          <span class="badge text-bg-secondary">${count} produto(s)</span>
        </div>
        <div class="small text-secondary">slug interno: ${escapeHtml(category.slug)}</div>
      `;

      const actions = document.createElement('div');
      actions.className = 'category-admin-actions';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn btn-sm btn-outline-primary';
      editBtn.textContent = 'Editar';
      editBtn.addEventListener('click', () => beginCategoryEdit(category));

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn btn-sm btn-outline-danger';
      deleteBtn.textContent = 'Excluir';
      deleteBtn.disabled = state.categories.length <= 1 || count > 0;
      deleteBtn.title = count > 0
        ? 'Remova ou troque os produtos desta categoria antes de excluir.'
        : (state.categories.length <= 1 ? 'Mantenha pelo menos uma categoria.' : '');
      deleteBtn.addEventListener('click', () => deleteCategory(category.id));

      actions.append(editBtn, deleteBtn);
      row.append(content, actions);
      refs.categoriesList.appendChild(row);
    });
  }

  async function loadProducts() {
    const { data, error } = await window.db
      .from('produtos')
      .select('id, category_id')
      .eq('profile_id', state.session.user.id);

    if (error) throw error;
    state.products = data || [];
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
    renderMetrics();
    renderCategoriesList();
  }

  async function refreshPageData() {
    await loadProducts();
    await loadCategories();
  }

  async function saveCategory(event) {
    event.preventDefault();
    hideStatus();

    const name = refs.categoryName.value.trim();
    const sortOrder = parseSortOrder(refs.categorySortOrder.value);

    if (!name) {
      showStatus('Informe o nome da categoria.', 'warning');
      return;
    }

    setCategorySaveLoading(true);
    try {
      const payload = {
        profile_id: state.session.user.id,
        name,
        sort_order: sortOrder
      };

      if (state.categoryEditingId) {
        const { error } = await window.db
          .from('product_categories')
          .update(payload)
          .eq('id', state.categoryEditingId)
          .eq('profile_id', state.session.user.id);

        if (error) throw error;
        showStatus('Categoria atualizada com sucesso.', 'success');
      } else {
        const { error } = await window.db
          .from('product_categories')
          .insert(payload);

        if (error) throw error;
        showStatus('Categoria cadastrada com sucesso.', 'success');
      }

      resetCategoryForm();
      await refreshPageData();
    } catch (err) {
      showStatus(`Erro ao salvar categoria: ${err.message}`, 'danger');
    } finally {
      setCategorySaveLoading(false);
    }
  }

  async function deleteCategory(categoryId) {
    const category = state.categories.find((item) => item.id === categoryId);
    if (!category) return;

    const count = getProductCountByCategory(categoryId);
    if (state.categories.length <= 1) {
      showStatus('Mantenha pelo menos uma categoria cadastrada.', 'warning');
      return;
    }
    if (count > 0) {
      showStatus('Remova ou recategorize os produtos desta categoria antes de excluir.', 'warning');
      return;
    }

    if (!window.confirm(`Deseja realmente excluir a categoria "${category.name}"?`)) return;

    try {
      const { error } = await window.db
        .from('product_categories')
        .delete()
        .eq('id', categoryId)
        .eq('profile_id', state.session.user.id);

      if (error) throw error;

      if (state.categoryEditingId === categoryId) resetCategoryForm();

      showStatus('Categoria excluída com sucesso.', 'success');
      await refreshPageData();
    } catch (err) {
      showStatus(`Erro ao excluir categoria: ${err.message}`, 'danger');
    }
  }

  function bindEvents() {
    refs.categoryForm.addEventListener('submit', saveCategory);
    refs.cancelCategoryEditBtn.addEventListener('click', resetCategoryForm);
    refs.clearCategoryFormBtn.addEventListener('click', resetCategoryForm);
    refs.reloadCategoriesBtn.addEventListener('click', refreshPageData);
    refs.logoutBtn.addEventListener('click', async () => {
      await window.Auth.logout();
      window.location.href = 'index.html';
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
      state.role = window.Auth.normalizeRole(state.profile?.role);
      state.isAdmin = state.role === 'admin';

      applyHeader();
      updateCategoryFormHeader();
      bindEvents();
      await refreshPageData();
    } catch (err) {
      showStatus(`Erro ao iniciar a gestão de categorias: ${err.message}`, 'danger');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
