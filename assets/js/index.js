(() => {
  const DEFAULT_ACCENT = '#0d6efd';
  const DEFAULT_CTA = 'Ver produto';

  const state = {
    mode: 'home',
    storeSlug: window.StoreUtils.getStoreSlugFromPath(),
    store: null,
    products: [],
    filteredProducts: []
  };

  const refs = {
    navAdmin: document.getElementById('navAdmin'),
    navLogout: document.getElementById('navLogout'),
    homeHeroBadge: document.getElementById('homeHeroBadge'),
    homeHeroTitle: document.getElementById('homeHeroTitle'),
    homeHeroDescription: document.getElementById('homeHeroDescription'),
    heroTitle: document.getElementById('heroTitle'),
    heroDescription: document.getElementById('heroDescription'),
    marketingCardContent: document.getElementById('marketingCardContent'),
    storeBannerSection: document.getElementById('storeBannerSection'),
    storeBannerImage: document.getElementById('storeBannerImage'),
    storeTopBar: document.getElementById('storeTopBar'),
    storeIdentityCard: document.getElementById('storeIdentityCard'),
    storeIdentityAvatar: document.getElementById('storeIdentityAvatar'),
    storeIdentityName: document.getElementById('storeIdentityName'),
    storeIdentityHeadline: document.getElementById('storeIdentityHeadline'),
    searchInput: document.getElementById('searchInput'),
    sortProducts: document.getElementById('sortProducts'),
    searchHelperText: document.getElementById('searchHelperText'),
    homeMarketingSection: document.getElementById('homeMarketingSection'),
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
    const sortLabel = refs.sortProducts?.selectedOptions?.[0]?.textContent || 'Mais recentes';

    if (!total) {
      refs.productsSearchSummary.textContent = 'Esta loja ainda nao publicou produtos.';
      return;
    }

    if (!term) {
      refs.productsSearchSummary.textContent = `${total} produto(s) disponivel(is), ordenados por ${sortLabel.toLowerCase()}.`;
      return;
    }

    refs.productsSearchSummary.textContent = `${filtered} produto(s) encontrado(s) para "${term}", ordenados por ${sortLabel.toLowerCase()}.`;
  }

  function sortProducts(items) {
    const sortMode = refs.sortProducts?.value || 'recent';
    const list = [...items];

    switch (sortMode) {
      case 'title-asc':
        return list.sort((a, b) => String(a.titulo || '').localeCompare(String(b.titulo || ''), 'pt-BR'));
      case 'title-desc':
        return list.sort((a, b) => String(b.titulo || '').localeCompare(String(a.titulo || ''), 'pt-BR'));
      case 'price-asc':
        return list.sort((a, b) => Number(a.preco || 0) - Number(b.preco || 0));
      case 'price-desc':
        return list.sort((a, b) => Number(b.preco || 0) - Number(a.preco || 0));
      case 'recent':
      default:
        return list.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    }
  }

  function resetStoreUi() {
    refs.storeBannerSection.classList.add('d-none');
    refs.storeTopBar.classList.add('d-none');
    refs.storeIdentityCard.classList.add('d-none');
    refs.productsSection.classList.add('d-none');
    refs.emptyState.classList.add('d-none');
    refs.notFoundState.classList.add('d-none');
    refs.loading.classList.add('d-none');
    refs.productsGrid.innerHTML = '';
    refs.searchInput.value = '';
  }

  function applyHomeHero() {
    state.mode = 'home';
    state.store = null;
    state.products = [];
    state.filteredProducts = [];
    document.body.classList.remove('storefront-mode');

    refs.homeHeroBadge.textContent = 'Plataforma de afiliados';
    refs.homeHeroTitle.textContent = 'Transforme seu link em uma pagina profissional de vendas';
    refs.homeHeroDescription.textContent = 'Crie sua loja personalizada, publique produtos, gerencie seu catalogo e compartilhe um link unico para vender com mais confianca.';
    refs.marketingCardContent.classList.remove('d-none');
    refs.homeMarketingSection.classList.remove('d-none');
    resetStoreUi();

    updateSeo({
      title: 'Afiliados ML | Sua pagina de vendas para afiliados',
      description: 'Crie sua vitrine de afiliado, publique produtos e tenha uma pagina personalizada para vender mais.',
      image: defaultImage(),
      url: `${window.location.origin}/`
    });
  }

  function applyStoreHero(store) {
    state.mode = 'store';
    state.store = store;
    document.body.classList.add('storefront-mode');

    const description = String(store.bio || store.headline || 'Confira os produtos publicados nesta loja.').trim();
    const accentColor = normalizeAccentColor(store.accent_color);

    refs.heroTitle.textContent = store.store_name || 'Loja de afiliado';
    refs.heroDescription.textContent = description;
    refs.searchHelperText.textContent = 'A busca filtra apenas os produtos desta loja.';
    refs.productsSectionTitle.textContent = `Produtos de ${store.store_name || 'esta loja'}`;
    refs.emptyStateTitle.textContent = 'Nenhum produto publicado ainda';
    refs.emptyStateDescription.textContent = 'Esta loja ainda nao publicou produtos.';
    refs.marketingCardContent.classList.add('d-none');
    refs.homeMarketingSection.classList.add('d-none');
    refs.storeTopBar.classList.remove('d-none');
    refs.productsSection.classList.remove('d-none');
    refs.notFoundState.classList.add('d-none');

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

    refs.storeBannerSection.style.setProperty('--store-banner-accent', accentColor);
    if (store.banner_url) {
      refs.storeBannerImage.src = store.banner_url;
      refs.storeBannerSection.classList.remove('is-placeholder');
      refs.storeBannerSection.classList.remove('d-none');
      refs.storeBannerImage.classList.remove('d-none');
      refs.storeBannerImage.onerror = () => {
        refs.storeBannerSection.classList.add('is-placeholder');
        refs.storeBannerImage.classList.add('d-none');
      };
    } else {
      refs.storeBannerSection.classList.remove('d-none');
      refs.storeBannerSection.classList.add('is-placeholder');
      refs.storeBannerImage.classList.add('d-none');
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
    document.body.classList.remove('storefront-mode');

    refs.marketingCardContent.classList.add('d-none');
    refs.homeMarketingSection.classList.add('d-none');
    refs.storeBannerSection.classList.add('d-none');
    refs.storeTopBar.classList.add('d-none');
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

      if (hasSearchMiss) {
        refs.emptyStateTitle.textContent = 'Nenhum produto encontrado';
        refs.emptyStateDescription.textContent = 'Tente outro termo para encontrar itens desta lista.';
      } else {
        refs.emptyStateTitle.textContent = 'Nenhum produto publicado ainda';
        refs.emptyStateDescription.textContent = 'Esta loja ainda nao publicou produtos.';
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
      col.className = 'col-12 col-sm-6 col-lg-4 col-xxl-3';

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
    if (state.mode !== 'store') return;

    const term = refs.searchInput.value.trim().toLowerCase();

    if (!term) {
      state.filteredProducts = sortProducts(state.products);
      renderProducts(state.filteredProducts);
      updateSearchSummary(state.products.length, state.filteredProducts.length);
      return;
    }

    state.filteredProducts = sortProducts(state.products.filter((item) => {
      const title = (item.titulo || '').toLowerCase();
      const desc = (item.descricao || '').toLowerCase();
      return title.includes(term) || desc.includes(term);
    }));

    renderProducts(state.filteredProducts);
    updateSearchSummary(state.products.length, state.filteredProducts.length);
  }

  async function loadHome() {
    applyHomeHero();
  }

  async function loadStorefront(slug) {
    refs.loading.classList.remove('d-none');
    refs.emptyState.classList.add('d-none');
    refs.notFoundState.classList.add('d-none');
    refs.productsGrid.innerHTML = '';

    const { data: store, error: storeError } = await window.db
      .from('public_store_profiles')
      .select('id, store_name, slug, headline, accent_color, cta_label, bio, photo_url, banner_url')
      .eq('slug', slug)
      .maybeSingle();

    if (storeError) throw storeError;

    if (!store) {
      refs.loading.classList.add('d-none');
      applyNotFoundState();
      return;
    }

    applyStoreHero(store);

    const { data: products, error: productsError } = await window.db
      .from('public_store_products')
      .select('id, titulo, preco, imagem_url, link_afiliado, descricao, created_at')
      .eq('profile_id', store.id)
      .order('created_at', { ascending: false });

    if (productsError) throw productsError;

    state.products = products || [];
    refs.loading.classList.add('d-none');
    applyFilter();
  }

  async function loadPage() {
    hideStatus();

    if (!state.storeSlug) {
      await loadHome();
      return;
    }

    if (window.AppConfig?.missingConfig) {
      applyNotFoundState();
      showStatus('Configure o Supabase em assets/js/config.js para carregar as lojas publicas.', 'warning');
      return;
    }

    try {
      await loadStorefront(state.storeSlug);
    } catch (err) {
      refs.loading.classList.add('d-none');
      showStatus(`Erro ao carregar pagina publica: ${err.message}`, 'danger');
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
    refs.sortProducts?.addEventListener('change', applyFilter);

    setupNavbarAuthState();
    loadPage();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
