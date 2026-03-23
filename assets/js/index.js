(() => {
  const DEFAULT_ACCENT = '#0d6efd';
  const DEFAULT_CTA = 'Ver produto';

  const state = {
    mode: 'catalog',
    storeSlug: window.StoreUtils.getStoreSlugFromPath(),
    store: null,
    products: [],
    filteredProducts: []
  };

  const refs = {
    navAdmin: document.getElementById('navAdmin'),
    navLogout: document.getElementById('navLogout'),
    heroBadge: document.getElementById('heroBadge'),
    heroTitle: document.getElementById('heroTitle'),
    heroDescription: document.getElementById('heroDescription'),
    storeBannerWrapper: document.getElementById('storeBannerWrapper'),
    storeBannerImage: document.getElementById('storeBannerImage'),
    storeIdentityCard: document.getElementById('storeIdentityCard'),
    storeIdentityAvatar: document.getElementById('storeIdentityAvatar'),
    storeIdentityName: document.getElementById('storeIdentityName'),
    storeIdentityHeadline: document.getElementById('storeIdentityHeadline'),
    searchInput: document.getElementById('searchInput'),
    searchHelperText: document.getElementById('searchHelperText'),
    refreshBtn: document.getElementById('refreshBtn'),
    productsSection: document.getElementById('productsSection'),
    productsSectionTitle: document.getElementById('productsSectionTitle'),
    productsSearchSummary: document.getElementById('productsSearchSummary'),
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

  function normalizeAccentColor(value) {
    const raw = String(value || '').trim().toLowerCase();
    return /^#([0-9a-f]{6}|[0-9a-f]{3})$/.test(raw) ? raw : DEFAULT_ACCENT;
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

  function updateSearchSummary(total, filtered) {
    const term = refs.searchInput.value.trim();

    if (!total) {
      refs.productsSearchSummary.textContent = state.mode === 'store'
        ? 'Esta loja ainda nao publicou produtos.'
        : 'Ainda nao ha produtos publicados.';
      return;
    }

    if (!term) {
      refs.productsSearchSummary.textContent = `${total} produto(s) disponivel(is), ordenados dos mais recentes para os mais antigos.`;
      return;
    }

    refs.productsSearchSummary.textContent = `${filtered} produto(s) encontrado(s) para "${term}".`;
  }

  function applyCatalogHero() {
    state.mode = 'catalog';
    state.store = null;
    refs.heroBadge.textContent = 'Produtos selecionados';
    refs.heroTitle.textContent = 'Encontre ofertas recomendadas com links de afiliado';
    refs.heroDescription.textContent = 'Catalogo atualizado com produtos do Mercado Livre. Clique e veja os detalhes no anuncio oficial.';
    refs.searchHelperText.textContent = 'A busca filtra os produtos abaixo em tempo real.';
    refs.productsSectionTitle.textContent = 'Produtos em destaque';
    refs.heroBadge.style.backgroundColor = '';
    refs.heroBadge.style.borderColor = '';
    refs.emptyStateTitle.textContent = 'Nenhum produto cadastrado ainda';
    refs.emptyStateDescription.textContent = 'Volte em breve para ver novas recomendacoes.';
    refs.storeBannerWrapper.classList.add('d-none');
    refs.storeIdentityCard.classList.add('d-none');
    refs.productsSection.classList.remove('d-none');

    updateSeo({
      title: 'Produtos Afiliados | Pagina Inicial',
      description: 'Produtos de afiliado do Mercado Livre selecionados para voce.',
      image: defaultImage(),
      url: `${window.location.origin}/`
    });
  }

  function applyStoreHero(store) {
    state.mode = 'store';
    state.store = store;

    const description = String(store.bio || store.headline || 'Confira os produtos publicados nesta loja.').trim();
    const accentColor = normalizeAccentColor(store.accent_color);

    refs.heroBadge.textContent = 'Produtos da loja';
    refs.heroTitle.textContent = store.store_name || 'Loja de afiliado';
    refs.heroDescription.textContent = description;
    refs.searchHelperText.textContent = 'A busca filtra apenas os produtos desta loja.';
    refs.productsSectionTitle.textContent = `Produtos de ${store.store_name || 'esta loja'}`;
    refs.emptyStateTitle.textContent = 'Nenhum produto publicado ainda';
    refs.emptyStateDescription.textContent = 'Esta loja ainda nao publicou produtos.';
    refs.productsSection.classList.remove('d-none');
    refs.heroBadge.style.backgroundColor = accentColor;
    refs.heroBadge.style.borderColor = accentColor;

    refs.storeIdentityName.textContent = store.store_name || 'Loja';
    refs.storeIdentityHeadline.textContent = store.headline || 'Curadoria personalizada de produtos.';
    refs.storeIdentityCard.style.setProperty('--store-accent-preview', accentColor);
    refs.storeIdentityCard.classList.remove('d-none');

    if (store.photo_url) {
      refs.storeIdentityAvatar.src = store.photo_url;
      refs.storeIdentityAvatar.classList.remove('d-none');
      refs.storeIdentityAvatar.onerror = () => refs.storeIdentityAvatar.classList.add('d-none');
    } else {
      refs.storeIdentityAvatar.classList.add('d-none');
    }

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
      image: store.banner_url || store.photo_url || defaultImage(),
      url: window.StoreUtils.getStoreUrl(store.slug)
    });
  }

  function applyNotFoundState() {
    state.mode = 'not_found';
    state.store = null;
    state.products = [];
    state.filteredProducts = [];
    refs.heroBadge.textContent = 'Pagina nao encontrada';
    refs.heroTitle.textContent = 'Essa loja nao esta disponivel';
    refs.heroDescription.textContent = 'Confira se o endereco foi digitado corretamente ou volte para a pagina inicial.';
    refs.searchHelperText.textContent = 'Voce pode voltar e explorar outras recomendacoes.';
    refs.storeBannerWrapper.classList.add('d-none');
    refs.storeIdentityCard.classList.add('d-none');
    refs.notFoundState.classList.remove('d-none');
    refs.emptyState.classList.add('d-none');
    refs.productsSection.classList.add('d-none');
    refs.productsGrid.innerHTML = '';

    updateSeo({
      title: 'Loja nao encontrada | Afiliados ML',
      description: 'Essa loja publica nao foi encontrada.',
      image: defaultImage(),
      url: window.location.href
    });
  }

  function renderProducts(products) {
    refs.productsGrid.innerHTML = '';

    if (!products.length) {
      const hasSearchMiss = state.products.length && refs.searchInput.value.trim();

      if (state.products.length && refs.searchInput.value.trim()) {
        refs.emptyStateTitle.textContent = 'Nenhum produto encontrado';
        refs.emptyStateDescription.textContent = 'Tente outro termo para encontrar itens desta lista.';
      } else if (state.mode === 'store') {
        refs.emptyStateTitle.textContent = 'Nenhum produto publicado ainda';
        refs.emptyStateDescription.textContent = 'Esta loja ainda nao publicou produtos.';
      } else {
        refs.emptyStateTitle.textContent = 'Nenhum produto cadastrado ainda';
        refs.emptyStateDescription.textContent = 'Volte em breve para ver novas recomendacoes.';
      }

      refs.emptyState.classList.remove('d-none');
      refs.productsSection.classList.toggle('d-none', !hasSearchMiss);
      return;
    }

    refs.emptyState.classList.add('d-none');
    refs.productsSection.classList.remove('d-none');

    const accentColor = normalizeAccentColor(state.store?.accent_color || DEFAULT_ACCENT);
    const ctaLabel = state.store?.cta_label || DEFAULT_CTA;

    products.forEach((item) => {
      const col = document.createElement('div');
      col.className = 'col-12 col-sm-6 col-lg-3';

      const card = document.createElement('article');
      card.className = 'card h-100 border-0 shadow-sm p-3 product-card';
      card.style.setProperty('--product-accent', accentColor);

      const image = document.createElement('img');
      image.className = 'product-image mb-3';
      image.src = item.imagem_url || defaultImage();
      image.alt = item.titulo || 'Imagem do produto';
      image.loading = 'lazy';
      image.referrerPolicy = 'no-referrer';

      const title = document.createElement('h2');
      title.className = 'h6 mb-2';
      title.textContent = item.titulo || 'Produto sem titulo';

      const descriptionText = item.descricao || 'Sem descricao.';

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
      link.textContent = ctaLabel;
      link.target = '_blank';
      link.rel = 'noopener noreferrer nofollow';
      link.style.backgroundColor = accentColor;
      link.style.borderColor = accentColor;

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
      state.filteredProducts = [...state.products];
      renderProducts(state.filteredProducts);
      updateSearchSummary(state.products.length, state.filteredProducts.length);
      return;
    }

    state.filteredProducts = state.products.filter((item) => {
      const title = (item.titulo || '').toLowerCase();
      const desc = (item.descricao || '').toLowerCase();
      return title.includes(term) || desc.includes(term);
    });

    renderProducts(state.filteredProducts);
    updateSearchSummary(state.products.length, state.filteredProducts.length);
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
      .select('id, store_name, slug, headline, accent_color, cta_label, bio, photo_url, banner_url, created_at, updated_at')
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
      showStatus(`Erro ao carregar pagina publica: ${err.message}`, 'danger');
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
