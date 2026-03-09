(() => {
  const state = {
    products: []
  };

  const refs = {
    navAdmin: document.getElementById('navAdmin'),
    navLogout: document.getElementById('navLogout'),
    searchInput: document.getElementById('searchInput'),
    refreshBtn: document.getElementById('refreshBtn'),
    productsGrid: document.getElementById('productsGrid'),
    loading: document.getElementById('loading'),
    emptyState: document.getElementById('emptyState'),
    status: document.getElementById('statusMessage')
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

  function defaultImage() {
    return 'https://via.placeholder.com/640x480?text=Produto';
  }

  function renderProducts(products) {
    refs.productsGrid.innerHTML = '';

    if (!products.length) {
      refs.emptyState.classList.remove('d-none');
      return;
    }

    refs.emptyState.classList.add('d-none');

    products.forEach((item) => {
      const col = document.createElement('div');
      col.className = 'col-12 col-sm-6 col-lg-4';

      const card = document.createElement('article');
      card.className = 'card h-100 border-0 shadow-sm p-3 product-card';

      const image = document.createElement('img');
      image.className = 'product-image mb-3';
      image.src = item.imagem_url || defaultImage();
      image.alt = item.titulo || 'Imagem do produto';
      image.loading = 'lazy';
      image.referrerPolicy = 'no-referrer';

      const title = document.createElement('h2');
      title.className = 'h6 mb-2';
      title.textContent = item.titulo || 'Produto sem título';

      const desc = document.createElement('p');
      desc.className = 'text-secondary small mb-3';
      desc.textContent = item.descricao || 'Sem descrição.';

      const price = document.createElement('div');
      price.className = 'price-tag mb-3';
      price.textContent = formatPrice(item.preco);

      const link = document.createElement('a');
      link.className = 'btn btn-primary mt-auto';
      link.href = item.link_afiliado;
      link.textContent = 'Ver produto';
      link.target = '_blank';
      link.rel = 'noopener noreferrer nofollow';

      card.append(image, title, desc, price, link);
      col.appendChild(card);
      refs.productsGrid.appendChild(col);
    });
  }

  async function loadProducts() {
    if (window.AppConfig?.missingConfig) {
      refs.loading.classList.add('d-none');
      showStatus('Configure o Supabase em assets/js/config.js para listar produtos.');
      return;
    }

    hideStatus();
    refs.loading.classList.remove('d-none');
    refs.emptyState.classList.add('d-none');

    try {
      const { data, error } = await window.db
        .from('produtos')
        .select('id, titulo, preco, imagem_url, link_afiliado, descricao, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      state.products = data || [];
      applyFilter();
    } catch (err) {
      showStatus(`Erro ao carregar produtos: ${err.message}`, 'danger');
    } finally {
      refs.loading.classList.add('d-none');
    }
  }

  function applyFilter() {
    const term = refs.searchInput.value.trim().toLowerCase();

    if (!term) {
      renderProducts(state.products);
      return;
    }

    const filtered = state.products.filter((item) => {
      const title = (item.titulo || '').toLowerCase();
      const desc = (item.descricao || '').toLowerCase();
      return title.includes(term) || desc.includes(term);
    });

    renderProducts(filtered);
  }

  async function setupNavbarAuthState() {
    try {
      if (window.AppConfig?.missingConfig) return;

      const session = await window.Auth.getSession();
      if (!session) return;

      refs.navAdmin.textContent = 'Painel admin';
      refs.navAdmin.href = 'admin.html';
      refs.navLogout.classList.remove('d-none');

      refs.navLogout.addEventListener('click', async () => {
        await window.Auth.logout();
        window.location.href = 'index.html';
      });
    } catch (err) {
      console.error(err);
    }
  }

  function init() {
    refs.searchInput.addEventListener('input', applyFilter);
    refs.refreshBtn.addEventListener('click', loadProducts);

    setupNavbarAuthState();
    loadProducts();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
