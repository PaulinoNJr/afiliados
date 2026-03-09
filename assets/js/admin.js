(() => {
  const state = {
    session: null,
    products: [],
    editingId: null,
    role: 'produtor',
    isAdmin: false
  };

  const refs = {
    userRoleBadge: document.getElementById('userRoleBadge'),
    userEmail: document.getElementById('userEmail'),
    logoutBtn: document.getElementById('logoutBtn'),
    manageUsersLink: document.getElementById('manageUsersLink'),
    status: document.getElementById('statusMessage'),

    form: document.getElementById('productForm'),
    saveBtn: document.getElementById('saveBtn'),
    cancelEditBtn: document.getElementById('cancelEditBtn'),

    linkAfiliado: document.getElementById('linkAfiliado'),
    autoFillBtn: document.getElementById('autoFillBtn'),
    titulo: document.getElementById('titulo'),
    imagemUrl: document.getElementById('imagemUrl'),
    preco: document.getElementById('preco'),
    descricao: document.getElementById('descricao'),

    reloadBtn: document.getElementById('reloadBtn'),
    listLoading: document.getElementById('listLoading'),
    tableBody: document.getElementById('productsTableBody'),
    emptyAdminState: document.getElementById('emptyAdminState')
  };

  function formatPrice(value) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(Number(value || 0));
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

  function setListLoading(isLoading) {
    refs.listLoading.classList.toggle('d-none', !isLoading);
  }

  function applyRoleUI() {
    refs.userRoleBadge.textContent = state.isAdmin ? 'admin' : 'produtor';
    refs.userRoleBadge.className = state.isAdmin ? 'badge text-bg-primary' : 'badge text-bg-secondary';
    refs.emptyAdminState.textContent = state.isAdmin
      ? 'Nenhum produto cadastrado no sistema.'
      : 'Nenhum produto cadastrado por este usuário.';

    if (!state.isAdmin) {
      refs.manageUsersLink.classList.add('d-none');
    } else {
      refs.manageUsersLink.classList.remove('d-none');
    }
  }

  function resetForm() {
    refs.form.reset();
    state.editingId = null;
    refs.cancelEditBtn.classList.add('d-none');
    refs.saveBtn.textContent = 'Salvar produto';
  }

  function beginEdit(item) {
    state.editingId = item.id;

    refs.linkAfiliado.value = item.link_afiliado || '';
    refs.titulo.value = item.titulo || '';
    refs.imagemUrl.value = item.imagem_url || '';
    refs.preco.value = item.preco || '';
    refs.descricao.value = item.descricao || '';

    refs.cancelEditBtn.classList.remove('d-none');
    refs.saveBtn.textContent = 'Atualizar produto';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function parsePrice(value) {
    const normalized = String(value || '').replace(',', '.').trim();
    return Number(normalized);
  }

  function renderTable() {
    refs.tableBody.innerHTML = '';

    if (!state.products.length) {
      refs.emptyAdminState.classList.remove('d-none');
      return;
    }

    refs.emptyAdminState.classList.add('d-none');

    state.products.forEach((item) => {
      const tr = document.createElement('tr');

      const tdProduct = document.createElement('td');
      const title = document.createElement('div');
      title.className = 'fw-semibold';
      title.textContent = item.titulo;

      const link = document.createElement('a');
      link.href = item.link_afiliado;
      link.target = '_blank';
      link.rel = 'noopener noreferrer nofollow';
      link.className = 'small text-decoration-none';
      link.textContent = 'Abrir link de afiliado';

      tdProduct.append(title, link);

      const tdPrice = document.createElement('td');
      tdPrice.className = 'text-nowrap';
      tdPrice.textContent = formatPrice(item.preco);

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
      tr.append(tdProduct, tdPrice, tdActions);
      refs.tableBody.appendChild(tr);
    });
  }

  async function loadProducts() {
    setListLoading(true);

    try {
      let query = window.db
        .from('produtos')
        .select('id, titulo, preco, imagem_url, link_afiliado, descricao, created_at, created_by')
        .order('created_at', { ascending: false });

      if (!state.isAdmin) {
        query = query.eq('created_by', state.session.user.id);
      }

      const { data, error } = await query;

      if (error) throw error;

      state.products = data || [];
      renderTable();
    } catch (err) {
      showStatus(`Erro ao carregar produtos: ${err.message}`, 'danger');
    } finally {
      setListLoading(false);
    }
  }

  async function fillFromLink() {
    const url = refs.linkAfiliado.value.trim();

    if (!url) {
      showStatus('Informe o link de afiliado para preencher automaticamente.');
      return;
    }

    refs.autoFillBtn.disabled = true;
    refs.autoFillBtn.textContent = 'Buscando...';

    try {
      // Esta chamada usa backend serverless para evitar limitações de CORS do navegador.
      const response = await fetch(`/api/preview?url=${encodeURIComponent(url)}`);
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Não foi possível extrair dados do link.');
      }

      const data = payload.data || {};
      if (data.title) refs.titulo.value = data.title;
      if (data.image) refs.imagemUrl.value = data.image;
      if (typeof data.price === 'number') refs.preco.value = data.price.toFixed(2);

      if (!data.title && !data.image && typeof data.price !== 'number') {
        showStatus('Não encontramos metadados suficientes. Preencha os campos manualmente.', 'warning');
        return;
      }

      showStatus('Campos preenchidos automaticamente. Revise antes de salvar.', 'success');
    } catch (err) {
      showStatus(`Falha na captura automática: ${err.message}. Você pode preencher manualmente.`, 'warning');
    } finally {
      refs.autoFillBtn.disabled = false;
      refs.autoFillBtn.textContent = 'Preencher automaticamente';
    }
  }

  async function saveProduct(event) {
    event.preventDefault();
    hideStatus();

    const link_afiliado = refs.linkAfiliado.value.trim();
    const titulo = refs.titulo.value.trim();
    const imagem_url = refs.imagemUrl.value.trim();
    const preco = parsePrice(refs.preco.value);
    const descricao = refs.descricao.value.trim();

    if (!link_afiliado || !titulo || Number.isNaN(preco)) {
      showStatus('Preencha link, título e preço válidos.', 'warning');
      return;
    }

    const payload = {
      link_afiliado,
      titulo,
      imagem_url: imagem_url || null,
      preco,
      descricao: descricao || null
    };

    setSaveLoading(true);

    try {
      if (state.editingId) {
        let query = window.db
          .from('produtos')
          .update(payload)
          .eq('id', state.editingId);

        if (!state.isAdmin) {
          query = query.eq('created_by', state.session.user.id);
        }

        const { error } = await query;

        if (error) throw error;

        showStatus('Produto atualizado com sucesso.', 'success');
      } else {
        const { error } = await window.db
          .from('produtos')
          .insert({
            ...payload,
            created_by: state.session.user.id
          });

        if (error) throw error;

        showStatus('Produto cadastrado com sucesso.', 'success');
      }

      resetForm();
      await loadProducts();
    } catch (err) {
      showStatus(`Erro ao salvar produto: ${err.message}`, 'danger');
    } finally {
      setSaveLoading(false);
    }
  }

  async function deleteProduct(id) {
    const confirmed = window.confirm('Deseja realmente excluir este produto?');
    if (!confirmed) return;

    try {
      let query = window.db
        .from('produtos')
        .delete()
        .eq('id', id);

      if (!state.isAdmin) {
        query = query.eq('created_by', state.session.user.id);
      }

      const { error } = await query;

      if (error) throw error;

      showStatus('Produto excluído com sucesso.', 'success');
      await loadProducts();
    } catch (err) {
      showStatus(`Erro ao excluir produto: ${err.message}`, 'danger');
    }
  }

  async function init() {
    if (window.AppConfig?.missingConfig) {
      showStatus('Configure SUPABASE_URL e SUPABASE_ANON_KEY em assets/js/config.js.', 'warning');
      return;
    }

    try {
      state.session = await window.Auth.requireAuth('login.html');
      if (!state.session) return;

      const profile = await window.Auth.getProfile();
      state.role = profile?.role || 'produtor';
      state.isAdmin = state.role === 'admin';
      applyRoleUI();

      refs.userEmail.textContent = state.session.user.email || 'Usuário autenticado';

      refs.logoutBtn.addEventListener('click', async () => {
        await window.Auth.logout();
        window.location.href = 'login.html';
      });

      refs.form.addEventListener('submit', saveProduct);
      refs.autoFillBtn.addEventListener('click', fillFromLink);
      refs.linkAfiliado.addEventListener('blur', () => {
        if (refs.linkAfiliado.value.trim()) fillFromLink();
      });
      refs.reloadBtn.addEventListener('click', loadProducts);
      refs.cancelEditBtn.addEventListener('click', resetForm);

      await loadProducts();
    } catch (err) {
      showStatus(`Erro ao iniciar o painel: ${err.message}`, 'danger');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
