(() => {
  const state = {
    mode: 'home',
    publicContext: window.StoreUtils.getPublicStoreContext(),
    store: null,
    page: null,
    products: []
  };

  const refs = {
    navAdmin: document.getElementById('navAdmin'),
    navLogout: document.getElementById('navLogout'),
    guestNavLinks: document.querySelectorAll('[data-guest-nav="true"]'),
    homeHeroBadge: document.getElementById('homeHeroBadge'),
    homeHeroTitle: document.getElementById('homeHeroTitle'),
    homeHeroDescription: document.getElementById('homeHeroDescription'),
    marketingCardContent: document.getElementById('marketingCardContent'),
    homeHeroSection: document.getElementById('homeHeroSection'),
    homeTailwindSection: document.getElementById('homeTailwindSection'),
    homeMarketingSection: document.getElementById('homeMarketingSection'),
    dynamicStorePageSection: document.getElementById('dynamicStorePageSection'),
    dynamicStorePageRoot: document.getElementById('dynamicStorePageRoot'),
    storeBannerSection: document.getElementById('storeBannerSection'),
    storeTopBar: document.getElementById('storeTopBar'),
    storeFiltersSection: document.getElementById('storeFiltersSection'),
    productsSection: document.getElementById('productsSection'),
    loading: document.getElementById('loading'),
    emptyState: document.getElementById('emptyState'),
    notFoundState: document.getElementById('notFoundState'),
    status: document.getElementById('statusMessage')
  };

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
    if (tag && value) tag.setAttribute(attribute, value);
  }

  function setFavicon(url) {
    if (!url) return;
    let link = document.querySelector('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = url;
  }

  function updateCanonical(url) {
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', url);
  }

  function updateStructuredData(payload) {
    const script = document.getElementById('structuredData');
    if (script) script.textContent = JSON.stringify(payload, null, 2);
  }

  function updateSeo({ title, description, image, url, faviconUrl }) {
    document.title = title;
    setMetaTag('meta[name="description"]', 'content', description);
    setMetaTag('meta[name="twitter:title"]', 'content', title);
    setMetaTag('meta[name="twitter:description"]', 'content', description);
    setMetaTag('meta[property="og:title"]', 'content', title);
    setMetaTag('meta[property="og:description"]', 'content', description);
    setMetaTag('meta[property="og:image"]', 'content', image || 'https://via.placeholder.com/1200x630?text=Vitrine');
    setMetaTag('meta[property="og:url"]', 'content', url);
    updateCanonical(url);
    setFavicon(faviconUrl);
  }

  function normalizeStoreProduct(item = {}) {
    return {
      ...item,
      product_url: String(item.product_url || item.link_afiliado || '').trim(),
      is_featured: Boolean(item.is_featured)
    };
  }

  function dedupeStoreProducts(items = []) {
    const seen = new Set();
    return items.filter((item, index) => {
      const key = String(
        item.id
        || item.product_id
        || item.product_url
        || item.link_afiliado
        || `${item.titulo || 'produto'}-${index}`
      ).trim();

      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function resetStoreUi() {
    refs.dynamicStorePageSection.classList.add('d-none');
    refs.loading.classList.add('d-none');
    refs.emptyState.classList.add('d-none');
    refs.notFoundState.classList.add('d-none');
    refs.storeBannerSection.classList.add('d-none');
    refs.storeTopBar.classList.add('d-none');
    refs.storeFiltersSection.classList.add('d-none');
    refs.productsSection.classList.add('d-none');
    refs.dynamicStorePageRoot.innerHTML = '';
  }

  function applyHomeHero() {
    state.mode = 'home';
    state.store = null;
    state.page = null;
    state.products = [];

    document.body.classList.remove('storefront-mode');
    document.body.style.removeProperty('background');
    refs.homeHeroSection.classList.remove('d-none');
    refs.homeTailwindSection?.classList.remove('d-none');
    refs.homeMarketingSection.classList.remove('d-none');
    refs.marketingCardContent.classList.remove('d-none');
    refs.homeHeroBadge.textContent = 'Catalogo, loja e pagina publica';
    refs.homeHeroTitle.textContent = 'Monte sua vitrine com foco em produtos, categorias e identidade visual';
    refs.homeHeroDescription.textContent = 'Cadastre produtos, organize a navegacao da loja e publique uma pagina mais limpa para compartilhar seus itens.';
    resetStoreUi();
    finishResolvingPage();

    updateSeo({
      title: 'Vitrine | Catalogo, Loja e Pagina Publica',
      description: 'Organize produtos, categorias e uma pagina publica personalizada em um fluxo mais simples.',
      image: 'https://via.placeholder.com/1200x630?text=Vitrine',
      url: `${window.location.origin}/`
    });

    updateStructuredData({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Vitrine',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description: 'Base para cadastrar produtos, organizar categorias e publicar uma loja com identidade propria.',
      url: `${window.location.origin}/`
    });
  }

  function applyNotFoundState() {
    state.mode = 'not_found';
    document.body.classList.remove('storefront-mode');
    refs.homeHeroSection.classList.add('d-none');
    refs.homeTailwindSection?.classList.add('d-none');
    refs.homeMarketingSection.classList.add('d-none');
    refs.marketingCardContent.classList.add('d-none');
    resetStoreUi();
    refs.notFoundState.classList.remove('d-none');
    finishResolvingPage();

    updateSeo({
      title: 'Loja nao encontrada | Vitrine',
      description: 'Essa loja publica nao foi encontrada.',
      image: 'https://via.placeholder.com/1200x630?text=Vitrine',
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

  function applyStorePage(store, pagePayload, products) {
    state.mode = 'store';
    state.store = store;
    state.products = products;
    document.body.classList.add('storefront-mode');
    refs.homeHeroSection.classList.add('d-none');
    refs.homeTailwindSection?.classList.add('d-none');
    refs.homeMarketingSection.classList.add('d-none');
    refs.marketingCardContent.classList.add('d-none');
    resetStoreUi();
    refs.dynamicStorePageSection.classList.remove('d-none');

    const normalizedPage = window.PageBuilder.renderPageShell({
      mountEl: refs.dynamicStorePageRoot,
      store,
      page: pagePayload,
      products,
      preview: false,
      onTrack: ({ eventName, blockType, source, productId = null, payload = {} }) => {
        window.PageAnalytics?.trackEvent({
          storeProfileId: store.id,
          pageSlug: store.slug,
          eventName,
          eventSource: source,
          blockType,
          productId,
          payload
        });
      }
    });

    state.page = normalizedPage;
    document.body.style.background = normalizedPage.themeSettings.backgroundColor;
    finishResolvingPage();

    const seo = window.PageBuilder.buildSeoPayload(store, normalizedPage);
    updateSeo({
      title: seo.title,
      description: seo.description,
      image: seo.image || 'https://via.placeholder.com/1200x630?text=Vitrine',
      url: window.StoreUtils.getStoreUrl(store.slug),
      faviconUrl: seo.faviconUrl
    });

    updateStructuredData({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: seo.title,
      description: seo.description,
      url: window.StoreUtils.getStoreUrl(store.slug),
      image: seo.image || undefined,
      publisher: {
        '@type': 'Organization',
        name: store.store_name || 'Vitrine'
      }
    });

    window.PageAnalytics?.trackEvent({
      storeProfileId: store.id,
      pageSlug: store.slug,
      eventName: 'page_view',
      eventSource: state.publicContext.mode,
      blockType: 'page',
      payload: {
        products: products.length,
        theme: normalizedPage.themeKey
      }
    });
  }

  async function loadPublicProducts(storeId) {
    const primaryResult = await window.db.rpc('get_public_products_featured_by_profile', {
      store_profile_id: storeId
    });

    if (!primaryResult.error) {
      return dedupeStoreProducts((primaryResult.data || []).map(normalizeStoreProduct));
    }

    const fallbackResult = await window.db.rpc('get_public_products_by_profile', {
      store_profile_id: storeId
    });

    if (fallbackResult.error) {
      throw fallbackResult.error;
    }

    return dedupeStoreProducts((fallbackResult.data || []).map(normalizeStoreProduct));
  }

  async function getStorePagePayload(slug) {
    const { data, error } = await window.db.rpc('get_public_store_page', {
      store_slug: slug
    });

    if (error) {
      console.warn('Fallback para pagina publica legado:', error.message);
      return null;
    }

    return data || null;
  }

  async function getStoreBySlug(slug) {
    const { data, error } = await window.db.rpc('get_public_store_by_slug', {
      store_slug: slug
    });

    if (error) throw error;
    return Array.isArray(data) ? (data[0] || null) : (data || null);
  }

  async function loadStorefront(slug) {
    refs.loading.classList.remove('d-none');
    refs.dynamicStorePageSection.classList.remove('d-none');
    window.PageBuilder.renderSkeleton(refs.dynamicStorePageRoot);

    const payload = await getStorePagePayload(slug);
    const store = payload?.store || await getStoreBySlug(slug);

    if (!store) {
      refs.loading.classList.add('d-none');
      applyNotFoundState();
      return;
    }

    const products = await loadPublicProducts(store.id);
    refs.loading.classList.add('d-none');

    const pagePayload = payload?.page
      ? { page: payload.page, blocks: payload.blocks || [] }
      : window.PageBuilder.createDefaultPage(store);

    applyStorePage(store, pagePayload, products);
  }

  async function loadPage() {
    hideStatus();

    if (!state.publicContext.slug) {
      applyHomeHero();
      return;
    }

    if (window.AppConfig?.missingConfig) {
      applyNotFoundState();
      finishResolvingPage();
      showStatus('Configure o Supabase em assets/js/config.js para carregar as lojas publicas.', 'warning');
      return;
    }

    try {
      await loadStorefront(state.publicContext.slug);
    } catch (error) {
      finishResolvingPage();
      refs.loading.classList.add('d-none');
      showStatus(`Erro ao carregar pagina publica: ${error.message}`, 'danger');
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
    } catch (error) {
      console.error(error);
    }
  }

  function init() {
    setupNavbarAuthState();
    loadPage();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
