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
    homeHeroBadge: document.getElementById('homeHeroBadge'),
    homeHeroTitle: document.getElementById('homeHeroTitle'),
    homeHeroDescription: document.getElementById('homeHeroDescription'),
    heroTitle: document.getElementById('heroTitle'),
    marketingCardContent: document.getElementById('marketingCardContent'),
    storeBannerSection: document.getElementById('storeBannerSection'),
    storeBannerImage: document.getElementById('storeBannerImage'),
    storeTopBar: document.getElementById('storeTopBar'),
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

  function updateSearchSummary(total, filtered) {
    return { total, filtered };
  }

  function buildStoreCategories(products = []) {
    const categoriesMap = new Map();

    products.forEach((product) => {
      if (!product.category_id) return;
      if (categoriesMap.has(product.category_id)) return;
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
    const sortMode = refs.sortProducts?.value || 'recent';
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

  function resetStoreUi() {
    refs.storeBannerSection.classList.add('d-none');
    refs.storeTopBar.classList.add('d-none');
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

    refs.homeHeroBadge.textContent = 'Pagina de afiliados profissional com URL propria';
    refs.homeHeroTitle.textContent = 'Crie sua loja de afiliados, publique seus produtos e venda com mais autoridade';
    refs.homeHeroDescription.textContent = 'Monte uma vitrine online otimizada para afiliados, organize seus links em uma página clara e compartilhe um endereço profissional para gerar mais cliques e mais confiança.';
    refs.marketingCardContent.classList.remove('d-none');
    refs.homeMarketingSection.classList.remove('d-none');
    refs.homeHeroBadge.textContent = 'SaaS para programas de afiliados';
    refs.homeHeroTitle.textContent = 'Crie, opere e escale seu programa de afiliados em um unico produto';
    refs.homeHeroDescription.textContent = 'Lance campanhas, publique produtos, aprove afiliados, gere links rastreaveis e acompanhe cliques, conversoes e comissoes com uma experiencia de software comercializavel.';
    resetStoreUi();
    finishResolvingPage();

    updateSeo({
      title: 'Pagina de Afiliados Profissional | Crie sua Loja de Afiliados',
      description: 'Crie uma página de afiliados profissional, organize seus links, publique sua loja online e apareça com mais autoridade no Google e nas redes sociais.',
      image: defaultImage(),
      url: `${window.location.origin}/`
    });
    updateSeo({
      title: 'Programa de Afiliados SaaS | Plataforma para Anunciantes e Afiliados',
      description: 'Crie, opere e escale seu programa de afiliados com uma plataforma SaaS para campanhas, links rastreaveis, cliques, conversoes e comissoes.',
      image: defaultImage(),
      url: `${window.location.origin}/`
    });

    updateStructuredData({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Afiliados',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description: 'Plataforma para criar página de afiliados, loja de afiliados e vitrine online com URL personalizada.',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'BRL'
      },
      url: `${window.location.origin}/`
    });
    updateStructuredData({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Afiliados',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description: 'Plataforma SaaS para empresas criarem seu proprio programa de afiliados, ativarem parceiros e acompanharem performance comercial.',
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

    refs.heroTitle.textContent = store.store_name || 'Loja de afiliado';
    refs.emptyStateTitle.textContent = 'Nenhum produto publicado ainda';
    refs.emptyStateDescription.textContent = 'Esta loja ainda não publicou produtos.';
    refs.marketingCardContent.classList.add('d-none');
    refs.homeMarketingSection.classList.add('d-none');
    refs.storeTopBar.classList.remove('d-none');
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
      title: `${store.store_name} | Loja de Afiliados`,
      description,
      image: store.banner_url || store.photo_url || defaultImage(),
      url: window.StoreUtils.getStoreUrl(store.slug)
    });

    updateStructuredData({
      '@context': 'https://schema.org',
      '@type': 'Store',
      name: store.store_name || 'Loja de afiliados',
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
      title: 'Loja não encontrada | Afiliados',
      description: 'Essa loja pública não foi encontrada.',
      image: defaultImage(),
      url: window.location.href
    });

    updateStructuredData({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Loja não encontrada | Afiliados',
      description: 'Essa loja pública não foi encontrada.',
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

      const categoryBadge = document.createElement('div');
      categoryBadge.className = 'store-category-pill mb-2';
      categoryBadge.textContent = item.category_name || 'Geral';

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
      link.textContent = ctaLabel;
      link.target = '_blank';
      link.rel = 'noopener noreferrer nofollow';
      link.style.borderColor = accentColor;
      link.dataset.buttonStyle = buttonStyle;
      if (buttonStyle === 'outline') {
        link.style.backgroundColor = 'transparent';
        link.style.color = accentColor;
      } else {
        link.style.backgroundColor = accentColor;
        link.style.color = buttonTextColor;
      }

      card.append(image, categoryBadge, title, desc);
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

    if (!term && categoryId === 'all') {
      state.filteredProducts = sortProducts(filteredBase);
      renderProducts(state.filteredProducts);
      updateSearchSummary(state.products.length, state.filteredProducts.length);
      return;
    }

    state.filteredProducts = sortProducts(filteredBase);

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

    const { data: storeRows, error: storeError } = await window.db
      .rpc('get_public_store_by_slug', {
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

    const { data: products, error: productsError } = await window.db
      .rpc('get_public_products_by_profile', {
        store_profile_id: store.id
      });

    if (productsError) throw productsError;

    state.products = products || [];
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
      showStatus('Configure o Supabase em assets/js/config.js para carregar as lojas públicas.', 'warning');
      return;
    }

    try {
      await loadStorefront(state.storeSlug);
    } catch (err) {
      refs.loading.classList.add('d-none');
      finishResolvingPage();
      showStatus(`Erro ao carregar página pública: ${err.message}`, 'danger');
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
    window.criarConta = function criarConta() {
      window.location.href = '/login.html';
    };

    refs.searchInput.addEventListener('input', applyFilter);
    refs.storeCategoryFilter?.addEventListener('change', applyFilter);
    refs.sortProducts?.addEventListener('change', applyFilter);

    setupNavbarAuthState();
    loadPage();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
