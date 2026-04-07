(() => {
  const DEFAULT_ACCENT = '#2563eb';
  const DEFAULT_TEXT = '#0f172a';
  const DEFAULT_PAGE_BACKGROUND = '#f8fafc';
  const DEFAULT_BUTTON_TEXT = '#ffffff';
  const DEFAULT_CTA = 'Ver produto';

  const state = {
    mode: 'home',
    storeSlug: window.StoreUtils.getStoreSlugFromPath(),
    store: null,
    categories: [],
    products: [],
    filteredProducts: []
  };

  const refs = {
    navAdmin: document.getElementById('navAdmin'),
    navLogout: document.getElementById('navLogout'),
    guestNavLinks: document.querySelectorAll('[data-guest-nav="true"]'),
    homeHeroBadge: document.getElementById('homeHeroBadge'),
    homeHeroTitle: document.getElementById('homeHeroTitle'),
    homeHeroDescription: document.getElementById('homeHeroDescription'),
    heroTitle: document.getElementById('heroTitle'),
    heroHeadline: document.getElementById('heroHeadline'),
    heroBio: document.getElementById('heroBio'),
    marketingCardContent: document.getElementById('marketingCardContent'),
    storeBannerSection: document.getElementById('storeBannerSection'),
    storeBannerImage: document.getElementById('storeBannerImage'),
    storeTopBar: document.getElementById('storeTopBar'),
    storeFiltersSection: document.getElementById('storeFiltersSection'),
    storeCategoryFilter: document.getElementById('storeCategoryFilter'),
    searchInput: document.getElementById('searchInput'),
    sortProducts: document.getElementById('sortProducts'),
    homeMarketingSection: document.getElementById('homeMarketingSection'),
    productsSection: document.getElementById('productsSection'),
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

  function isValidHttpUrl(raw) {
    try {
      const parsed = new URL(String(raw || '').trim());
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  function getProductUrl(item = {}) {
    return String(item.product_url || item.link_afiliado || '').trim();
  }

  function normalizeStoreProduct(item = {}) {
    return {
      ...item,
      product_url: getProductUrl(item),
      is_featured: Boolean(item.is_featured)
    };
  }

  function normalizeAccentColor(value) {
    const raw = String(value || '').trim().toLowerCase();
    return /^#([0-9a-f]{6}|[0-9a-f]{3})$/.test(raw) ? raw : DEFAULT_ACCENT;
  }

  function normalizeHexColor(value, fallback) {
    const raw = String(value || '').trim().toLowerCase();
    return /^#([0-9a-f]{6}|[0-9a-f]{3})$/.test(raw) ? raw : fallback;
  }

  function normalizeButtonStyle(value) {
    const raw = String(value || '').trim().toLowerCase();
    return ['solid', 'outline', 'pill'].includes(raw) ? raw : 'solid';
  }

  function normalizeCardStyle(value) {
    const raw = String(value || '').trim().toLowerCase();
    return ['soft', 'outline', 'glass'].includes(raw) ? raw : 'soft';
  }

  function showStatus(message, type = 'warning') {
    refs.status.className = `alert alert-${type}`;
    refs.status.textContent = message;
    refs.status.classList.remove('d-none');
  }

  function hideStatus() {
    refs.status.classList.add('d-none');
  }

  function finishResolvingPage() {
    document.body.classList.remove('page-resolving');
  }

  function setMetaTag(selector, attribute, value) {
    const tag = document.querySelector(selector);
    if (tag) tag.setAttribute(attribute, value);
  }

  function updateCanonical(url) {
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', url);
  }

  function updateStructuredData(payload) {
    const script = document.getElementById('structuredData');
    if (!script) return;
    script.textContent = JSON.stringify(payload, null, 2);
  }

  function updateSeo({ title, description, image, url }) {
    document.title = title;
    setMetaTag('meta[name="description"]', 'content', description);
    setMetaTag('meta[name="twitter:title"]', 'content', title);
    setMetaTag('meta[name="twitter:description"]', 'content', description);
    setMetaTag('meta[property="og:title"]', 'content', title);
    setMetaTag('meta[property="og:description"]', 'content', description);
    setMetaTag('meta[property="og:image"]', 'content', image || defaultImage());
    setMetaTag('meta[property="og:url"]', 'content', url);
    updateCanonical(url);
  }

  function buildStoreCategories(products = []) {
    const categoriesMap = new Map();

    products.forEach((product) => {
      if (!product.category_id || categoriesMap.has(product.category_id)) return;
      categoriesMap.set(product.category_id, {
        id: product.category_id,
        name: product.category_name || 'Geral',
        slug: product.category_slug || '',
        sort_order: Number(product.category_sort_order || 0)
      });
    });

    return [...categoriesMap.values()].sort((a, b) => {
      const orderDiff = Number(a.sort_order || 0) - Number(b.sort_order || 0);
      if (orderDiff !== 0) return orderDiff;
      return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR');
    });
  }

  function renderCategoryFilter() {
    refs.storeCategoryFilter.innerHTML = '<option value="all">Todas</option>';

    state.categories.forEach((category) => {
      const option = document.createElement('option');
      option.value = category.id;
      option.textContent = category.name;
      refs.storeCategoryFilter.appendChild(option);
    });
  }

  function sortProducts(items) {
    const sortMode = refs.sortProducts.value || 'recent';
    const list = [...items];

    switch (sortMode) {
      case 'category':
        return list.sort((a, b) => {
          const categoryOrder = Number(a.category_sort_order || 0) - Number(b.category_sort_order || 0);
          if (categoryOrder !== 0) return categoryOrder;
          const categoryName = String(a.category_name || '').localeCompare(String(b.category_name || ''), 'pt-BR');
          if (categoryName !== 0) return categoryName;
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        });
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

  function prioritizeFeaturedProduct(items = []) {
    const featured = state.products.find((item) => item.is_featured) || null;
    const regularItems = items.filter((item) => !item.is_featured);
    const sortedRegularItems = sortProducts(regularItems);

    if (!featured) {
      return sortedRegularItems;
    }

    return [featured, ...sortedRegularItems.filter((item) => item.id !== featured.id)];
  }

  function resetStoreUi() {
    refs.storeBannerSection.classList.add('d-none');
    refs.storeTopBar.classList.add('d-none');
    refs.storeFiltersSection.classList.add('d-none');
    refs.productsSection.classList.add('d-none');
    refs.emptyState.classList.add('d-none');
    refs.notFoundState.classList.add('d-none');
    refs.loading.classList.add('d-none');
    refs.productsGrid.innerHTML = '';
    refs.storeCategoryFilter.value = 'all';
    refs.storeCategoryFilter.innerHTML = '<option value="all">Todas</option>';
    refs.searchInput.value = '';
  }

  function applyHomeHero() {
    state.mode = 'home';
    state.store = null;
    state.categories = [];
    state.products = [];
    state.filteredProducts = [];

    document.body.classList.remove('storefront-mode');
    document.body.style.removeProperty('--store-page-bg');
    document.body.style.removeProperty('--store-text-color');
    document.body.style.removeProperty('--store-accent-color');
    document.body.style.removeProperty('--store-button-text-color');

    refs.marketingCardContent.classList.remove('d-none');
    refs.homeMarketingSection.classList.remove('d-none');
    refs.homeHeroBadge.textContent = 'Catalogo, loja e pagina publica';
    refs.homeHeroTitle.textContent = 'Monte sua vitrine com foco em produtos, categorias e identidade visual';
    refs.homeHeroDescription.textContent = 'Cadastre produtos, organize a navegacao da loja e publique uma pagina mais limpa para compartilhar seus itens.';
    refs.heroHeadline.textContent = '';
    refs.heroHeadline.classList.add('d-none');
    refs.heroBio.textContent = '';
    refs.heroBio.classList.add('d-none');
    resetStoreUi();
    finishResolvingPage();

    updateSeo({
      title: 'Vitrine | Catalogo, Loja e Pagina Publica',
      description: 'Organize produtos, categorias e uma pagina publica personalizada em um fluxo mais simples.',
      image: defaultImage(),
      url: `${window.location.origin}/`
    });

    updateStructuredData({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Vitrine',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description: 'Base para cadastrar produtos, organizar categorias e publicar uma loja com identidade propria.',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'BRL'
      },
      url: `${window.location.origin}/`
    });
  }

  function applyStoreHero(store) {
    state.mode = 'store';
    state.store = store;
    document.body.classList.add('storefront-mode');

    const description = String(store.bio || store.headline || 'Confira os produtos publicados nesta loja.').trim();
    const accentColor = normalizeAccentColor(store.accent_color);
    const textColor = normalizeHexColor(store.text_color, DEFAULT_TEXT);
    const pageBackground = normalizeHexColor(store.page_background, DEFAULT_PAGE_BACKGROUND);
    const buttonTextColor = normalizeHexColor(store.button_text_color, DEFAULT_BUTTON_TEXT);
    const headline = String(store.headline || '').trim();
    const bio = String(store.bio || '').trim();

    refs.heroTitle.textContent = store.store_name || 'Loja';
    refs.heroHeadline.textContent = headline;
    refs.heroHeadline.classList.toggle('d-none', !headline);
    refs.heroBio.textContent = bio;
    refs.heroBio.classList.toggle('d-none', !bio);
    refs.emptyStateTitle.textContent = 'Nenhum produto publicado ainda';
    refs.emptyStateDescription.textContent = 'Esta loja ainda não publicou produtos.';
    refs.marketingCardContent.classList.add('d-none');
    refs.homeMarketingSection.classList.add('d-none');
    refs.storeTopBar.classList.remove('d-none');
    refs.storeFiltersSection.classList.remove('d-none');
    refs.productsSection.classList.remove('d-none');
    refs.notFoundState.classList.add('d-none');
    finishResolvingPage();

    document.body.style.setProperty('--store-page-bg', pageBackground);
    document.body.style.setProperty('--store-text-color', textColor);
    document.body.style.setProperty('--store-accent-color', accentColor);
    document.body.style.setProperty('--store-button-text-color', buttonTextColor);

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
      title: `${store.store_name} | Loja`,
      description,
      image: store.banner_url || store.photo_url || defaultImage(),
      url: window.StoreUtils.getStoreUrl(store.slug)
    });

    updateStructuredData({
      '@context': 'https://schema.org',
      '@type': 'Store',
      name: store.store_name || 'Loja',
      description,
      image: store.banner_url || store.photo_url || defaultImage(),
      url: window.StoreUtils.getStoreUrl(store.slug)
    });
  }

  function applyNotFoundState() {
    state.mode = 'not_found';
    state.store = null;
    state.categories = [];
    state.products = [];
    state.filteredProducts = [];

    document.body.classList.remove('storefront-mode');
    document.body.style.removeProperty('--store-page-bg');
    document.body.style.removeProperty('--store-text-color');
    document.body.style.removeProperty('--store-accent-color');
    document.body.style.removeProperty('--store-button-text-color');

    refs.marketingCardContent.classList.add('d-none');
    refs.homeMarketingSection.classList.add('d-none');
    refs.storeBannerSection.classList.add('d-none');
    refs.storeTopBar.classList.add('d-none');
    refs.notFoundState.classList.remove('d-none');
    refs.emptyState.classList.add('d-none');
    refs.productsSection.classList.add('d-none');
    refs.productsGrid.innerHTML = '';
    finishResolvingPage();

    updateSeo({
      title: 'Loja nao encontrada | Vitrine',
      description: 'Essa loja publica nao foi encontrada.',
      image: defaultImage(),
      url: window.location.href
    });

    updateStructuredData({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Loja nao encontrada | Vitrine',
      description: 'Essa loja publica nao foi encontrada.',
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
        refs.emptyStateDescription.textContent = 'Esta loja ainda não publicou produtos.';
      }

      refs.emptyState.classList.remove('d-none');
      refs.productsSection.classList.toggle('d-none', !hasSearchMiss);
      return;
    }

    refs.emptyState.classList.add('d-none');
    refs.productsSection.classList.remove('d-none');

    const accentColor = normalizeAccentColor(state.store?.accent_color || DEFAULT_ACCENT);
    const textColor = normalizeHexColor(state.store?.text_color, DEFAULT_TEXT);
    const buttonTextColor = normalizeHexColor(state.store?.button_text_color, DEFAULT_BUTTON_TEXT);
    const buttonStyle = normalizeButtonStyle(state.store?.button_style);
    const cardStyle = normalizeCardStyle(state.store?.card_style);
    const ctaLabel = state.store?.cta_label || DEFAULT_CTA;

    products.forEach((item) => {
      const col = document.createElement('div');
      col.className = 'col-12 col-sm-6 col-lg-4 col-xxl-3';

      const card = document.createElement('article');
      card.className = 'card h-100 border-0 shadow-sm p-3 product-card';
      card.style.setProperty('--product-accent', accentColor);
      card.style.setProperty('--product-text', textColor);
      card.style.setProperty('--product-button-text', buttonTextColor);
      card.dataset.cardStyle = cardStyle;

      const image = document.createElement('img');
      image.className = 'product-image mb-3';
      image.src = item.imagem_url || defaultImage();
      image.alt = item.titulo || 'Imagem do produto';
      image.loading = 'lazy';
      image.referrerPolicy = 'no-referrer';

      const title = document.createElement('h2');
      title.className = 'h6 mb-2';
      title.textContent = item.titulo || 'Produto sem titulo';

      const badges = document.createElement('div');
      badges.className = 'product-card-badges';

      if (item.is_featured) {
        const featuredBadge = document.createElement('span');
        featuredBadge.className = 'product-highlight-badge';
        featuredBadge.textContent = 'Destaque';
        badges.appendChild(featuredBadge);
      }

      const categoryBadge = document.createElement('div');
      categoryBadge.className = 'store-category-pill';
      categoryBadge.textContent = item.category_name || 'Geral';
      badges.appendChild(categoryBadge);

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
      const productUrl = getProductUrl(item);
      link.href = isValidHttpUrl(productUrl) ? productUrl : '#';
      link.textContent = ctaLabel;
      link.target = '_blank';
      link.rel = 'noopener noreferrer nofollow';
      link.classList.toggle('disabled', !isValidHttpUrl(productUrl));
      link.style.borderColor = accentColor;
      link.dataset.buttonStyle = buttonStyle;
      if (buttonStyle === 'outline') {
        link.style.backgroundColor = 'transparent';
        link.style.color = accentColor;
      } else {
        link.style.backgroundColor = accentColor;
        link.style.color = buttonTextColor;
      }

      card.append(image);
      if (badges.childNodes.length) card.appendChild(badges);
      card.append(title, desc);
      if (shouldShowToggle) card.append(descMeta);
      card.append(price, link);
      col.appendChild(card);
      refs.productsGrid.appendChild(col);
    });
  }

  function applyFilter() {
    if (state.mode !== 'store') return;

    const term = refs.searchInput.value.trim().toLowerCase();
    const categoryId = refs.storeCategoryFilter.value;

    const filteredBase = state.products.filter((item) => {
      if (categoryId !== 'all' && item.category_id !== categoryId) return false;
      if (!term) return true;

      const title = (item.titulo || '').toLowerCase();
      const desc = (item.descricao || '').toLowerCase();
      const categoryName = (item.category_name || '').toLowerCase();
      return title.includes(term) || desc.includes(term) || categoryName.includes(term);
    });

    state.filteredProducts = prioritizeFeaturedProduct(filteredBase);
    renderProducts(state.filteredProducts);
  }

  async function loadPublicProducts(storeId) {
    const primaryResult = await window.db.rpc('get_public_products_featured_by_profile', {
      store_profile_id: storeId
    });

    if (!primaryResult.error) {
      return (primaryResult.data || []).map(normalizeStoreProduct);
    }

    const fallbackResult = await window.db.rpc('get_public_products_by_profile', {
      store_profile_id: storeId
    });

    if (fallbackResult.error) {
      throw fallbackResult.error;
    }

    return (fallbackResult.data || []).map(normalizeStoreProduct);
  }

  async function loadHome() {
    applyHomeHero();
  }

  async function loadStorefront(slug) {
    refs.loading.classList.remove('d-none');
    refs.emptyState.classList.add('d-none');
    refs.notFoundState.classList.add('d-none');
    refs.productsGrid.innerHTML = '';

    const { data: storeRows, error: storeError } = await window.db.rpc('get_public_store_by_slug', {
      store_slug: slug
    });

    if (storeError) throw storeError;

    const store = Array.isArray(storeRows) ? (storeRows[0] || null) : (storeRows || null);

    if (!store) {
      refs.loading.classList.add('d-none');
      applyNotFoundState();
      return;
    }

    applyStoreHero(store);

    state.products = await loadPublicProducts(store.id);
    state.categories = buildStoreCategories(state.products);
    renderCategoryFilter();
    refs.loading.classList.add('d-none');
    applyFilter();
  }

  async function loadPage() {
    hideStatus();

    if (!state.storeSlug) {
      await loadHome();
      return;
    }

    refs.loading.classList.remove('d-none');

    if (window.AppConfig?.missingConfig) {
      applyNotFoundState();
      finishResolvingPage();
      showStatus('Configure o Supabase em assets/js/config.js para carregar as lojas publicas.', 'warning');
      return;
    }

    try {
      await loadStorefront(state.storeSlug);
    } catch (err) {
      refs.loading.classList.add('d-none');
      finishResolvingPage();
      showStatus(`Erro ao carregar pagina publica: ${err.message}`, 'danger');
    }
  }

  async function setupNavbarAuthState() {
    try {
      if (window.AppConfig?.missingConfig) return;

      const session = await window.Auth.getSession();
      if (!session) return;

      const profile = await window.Auth.getProfile();
      refs.guestNavLinks.forEach((link) => link.classList.add('d-none'));
      refs.navAdmin.textContent = `Painel ${window.Auth.getRoleLabel(profile?.role)}`;
      refs.navAdmin.href = window.Auth.getDashboardRoute(profile?.role);
      refs.navLogout.classList.remove('d-none');

      refs.navLogout.addEventListener('click', async () => {
        await window.Auth.logout();
        window.location.href = 'index.html';
      });
    } catch (err) {
      console.error(err);
    }
  }

  function detachStoreFilters() {
    const heroColumn = document.getElementById('storeHeroColumn');
    const filtersColumn = document.getElementById('storeFiltersColumn');
    const filtersCard = document.getElementById('storeFiltersCard');

    if (!heroColumn || !filtersColumn || !filtersCard || filtersCard.children.length) {
      return;
    }

    const filtersContent = filtersColumn.firstElementChild;
    if (filtersContent) {
      filtersCard.appendChild(filtersContent);
    }

    filtersColumn.remove();
    heroColumn.classList.remove('col-xl-4');
    heroColumn.classList.add('col-xl-12');
  }

  function init() {
    detachStoreFilters();
    refs.searchInput.addEventListener('input', applyFilter);
    refs.storeCategoryFilter?.addEventListener('change', applyFilter);
    refs.sortProducts.addEventListener('change', applyFilter);

    setupNavbarAuthState();
    loadPage();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
