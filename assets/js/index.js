(() => {
  const state = {
    mode: 'catalog',
    storeSlug: window.StoreUtils.getStoreSlugFromPath(),
    store: null,
    products: []
  };

  const refs = {
    navAdmin: document.getElementById('navAdmin'),
    navLogout: document.getElementById('navLogout'),
    heroBadge: document.getElementById('heroBadge'),
    heroTitle: document.getElementById('heroTitle'),
    heroDescription: document.getElementById('heroDescription'),
    storeMetaBar: document.getElementById('storeMetaBar'),
    storeMetaLink: document.getElementById('storeMetaLink'),
    storeBannerWrapper: document.getElementById('storeBannerWrapper'),
    storeBannerImage: document.getElementById('storeBannerImage'),
    searchInput: document.getElementById('searchInput'),
    searchHelperText: document.getElementById('searchHelperText'),
    refreshBtn: document.getElementById('refreshBtn'),
    productsGrid: document.getElementById('productsGrid'),
    loading: document.getElementById('loading'),
    emptyState: document.getElementById('emptyState'),
    emptyStateTitle: document.getElementById('emptyStateTitle'),
    emptyStateDescription: document.getElementById('emptyStateDescription'),
    notFoundState: document.getElementById('notFoundState'),
    status: document.getElementById('statusMessage')
  };

  function formatPrice(value) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(Number(value || 0));
  }

  function defaultImage() {
    return 'https://via.placeholder.com/640x480?text=Produto';
  }

  function showStatus(message, type = 'warning') {
    refs.status.className = `alert alert-${type}`;
    refs.status.textContent = message;
    refs.status.classList.remove('d-none');
  }

  function hideStatus() {
    refs.status.classList.add('d-none');
  }

  function setMetaTag(selector, attribute, value) {
    const tag = document.querySelector(selector);
    if (tag) tag.setAttribute(attribute, value);
  }

  function updateSeo({ title, description, image, url }) {
    document.title = title;
    setMetaTag('meta[name="description"]', 'content', description);
    setMetaTag('meta[property="og:title"]', 'content', title);
    setMetaTag('meta[property="og:description"]', 'content', description);
    setMetaTag('meta[property="og:image"]', 'content', image || defaultImage());
    setMetaTag('meta[property="og:url"]', 'content', url);
  }

  function applyCatalogHero() {
    state.mode = 'catalog';
    state.store = null;
    refs.heroBadge.textContent = 'Produtos selecionados';
    refs.heroTitle.textContent = 'Encontre ofertas recomendadas com links de afiliado';
    refs.heroDescription.textContent = 'Catálogo atualizado com produtos do Mercado Livre. Clique e veja os detalhes no anúncio oficial.';
    refs.searchHelperText.textContent = 'Os produtos mais recentes aparecem primeiro.';
    refs.storeMetaBar.classList.add('d-none');
    refs.storeBannerWrapper.classList.add('d-none');
    refs.emptyStateTitle.textContent = 'Nenhum produto cadastrado ainda';
    refs.emptyStateDescription.textContent = 'Volte em breve para ver novas recomendações.';

    updateSeo({
      title: 'Produtos Afiliados | Página Inicial',
      description: 'Produtos de afiliado do Mercado Livre selecionados para você.',
      image: defaultImage(),
      url: `${window.location.origin}/`
    });
  }

  function applyStoreHero(store) {
    state.mode = 'store';
    state.store = store;

    const description = String(store.bio || 'Confira os produtos publicados nesta loja.').trim();
    const publicUrl = window.StoreUtils.getStoreUrl(store.slug);

    refs.heroBadge.textContent = 'Loja personalizada';
    refs.heroTitle.textContent = store.store_name || 'Loja de afiliado';
    refs.heroDescription.textContent = description;
    refs.searchHelperText.textContent = 'Busque apenas entre os produtos desta loja.';
    refs.storeMetaLink.href = publicUrl;
    refs.storeMetaLink.textContent = publicUrl;
    refs.storeMetaBar.classList.remove('d-none');
    refs.emptyStateTitle.textContent = 'Nenhum produto publicado ainda';
    refs.emptyStateDescription.textContent = 'Esta loja ainda não publicou produtos.';

    if (store.banner_url) {
      refs.storeBannerImage.src = store.banner_url;
      refs.storeBannerWrapper.classList.remove('d-none');
      refs.storeBannerImage.onerror = () => {
        refs.storeBannerWrapper.classList.add('d-none');
      };
    } else {
      refs.storeBannerWrapper.classList.add('d-none');
    }

    updateSeo({
      title: `Loja de ${store.store_name}`,
      description,
      image: store.banner_url || defaultImage(),
      url: publicUrl
    });
  }

  function applyNotFoundState() {
    state.mode = 'not_found';
    state.store = null;
    state.products = [];
    refs.heroBadge.textContent = 'Página não encontrada';
    refs.heroTitle.textContent = 'Essa loja não está disponível';
    refs.heroDescription.textContent = 'Confira se o endereço foi digitado corretamente ou volte para a página inicial.';
    refs.searchHelperText.textContent = 'Você pode voltar e explorar outras recomendações.';
    refs.storeMetaBar.classList.add('d-none');
    refs.storeBannerWrapper.classList.add('d-none');
    refs.notFoundState.classList.remove('d-none');
    refs.emptyState.classList.add('d-none');
    refs.productsGrid.innerHTML = '';

    updateSeo({
      title: 'Loja não encontrada | Afiliados ML',
      description: 'Essa loja pública não foi encontrada.',
      image: defaultImage(),
      url: window.location.href
    });
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
      col.className = 'col-12 col-sm-6 col-lg-3';

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

      const descriptionText = item.descricao || 'Sem descrição.';

      const desc = document.createElement('p');
      desc.className = 'text-secondary small mb-1 product-desc is-collapsed';
      desc.textContent = descriptionText;

      const descMeta = document.createElement('div');
      descMeta.className = 'mb-3';

      const descDots = document.createElement('span');
      descDots.className = 'text-secondary small';
      descDots.textContent = '.... ';

      const toggleDescBtn = document.createElement('button');
      toggleDescBtn.type = 'button';
      toggleDescBtn.className = 'btn btn-link btn-sm p-0 product-desc-toggle';
      toggleDescBtn.textContent = 'ver mais...';
      toggleDescBtn.addEventListener('click', () => {
        const isCollapsed = desc.classList.toggle('is-collapsed');
        descDots.classList.toggle('d-none', !isCollapsed);
        toggleDescBtn.textContent = isCollapsed ? 'ver mais...' : 'ver menos';
      });

      const shouldShowToggle = Boolean((item.descricao || '').trim());
      if (shouldShowToggle) {
        descMeta.append(descDots, toggleDescBtn);
      } else {
        desc.classList.remove('is-collapsed');
        desc.classList.remove('mb-1');
        desc.classList.add('mb-3');
      }

      const price = document.createElement('div');
      price.className = 'price-tag mb-3';
      price.textContent = formatPrice(item.preco);

      const link = document.createElement('a');
      link.className = 'btn btn-primary mt-auto';
      link.href = item.link_afiliado;
      link.textContent = 'Ver produto';
      link.target = '_blank';
      link.rel = 'noopener noreferrer nofollow';

      card.append(image, title, desc);
      if (shouldShowToggle) card.append(descMeta);
      card.append(price, link);
      col.appendChild(card);
      refs.productsGrid.appendChild(col);
    });
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

  async function loadCatalog() {
    applyCatalogHero();
    refs.notFoundState.classList.add('d-none');

    const { data, error } = await window.db
      .from('public_store_products')
      .select('id, titulo, preco, imagem_url, link_afiliado, descricao, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    state.products = data || [];
    applyFilter();
  }

  async function loadStorefront(slug) {
    refs.notFoundState.classList.add('d-none');

    const { data: store, error: storeError } = await window.db
      .from('public_store_profiles')
      .select('id, store_name, slug, bio, banner_url, created_at, updated_at')
      .eq('slug', slug)
      .maybeSingle();

    if (storeError) throw storeError;

    if (!store) {
      applyNotFoundState();
      return;
    }

    applyStoreHero(store);

    const { data: products, error: productsError } = await window.db
      .from('public_store_products')
      .select('id, titulo, preco, imagem_url, link_afiliado, descricao, created_at, updated_at')
      .eq('profile_id', store.id)
      .order('created_at', { ascending: false });

    if (productsError) throw productsError;

    state.products = products || [];
    applyFilter();
  }

  async function loadPage() {
    if (window.AppConfig?.missingConfig) {
      refs.loading.classList.add('d-none');
      showStatus('Configure o Supabase em assets/js/config.js para listar produtos.');
      return;
    }

    hideStatus();
    refs.loading.classList.remove('d-none');
    refs.emptyState.classList.add('d-none');
    refs.notFoundState.classList.add('d-none');
    refs.productsGrid.innerHTML = '';

    try {
      if (state.storeSlug) {
        await loadStorefront(state.storeSlug);
      } else {
        await loadCatalog();
      }
    } catch (err) {
      showStatus(`Erro ao carregar página pública: ${err.message}`, 'danger');
    } finally {
      refs.loading.classList.add('d-none');
    }
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
    refs.refreshBtn.addEventListener('click', loadPage);

    setupNavbarAuthState();
    loadPage();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
