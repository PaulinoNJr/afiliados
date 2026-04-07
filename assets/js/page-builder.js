(() => {
  const DEFAULT_THEME_KEY = 'moderno';
  const VALID_THEME_KEYS = ['moderno', 'elegante', 'vibrante'];
  const VALID_BLOCK_TYPES = ['hero', 'products', 'cta', 'testimonials', 'video', 'faq', 'footer'];

  const THEME_PRESETS = {
    moderno: {
      label: 'Moderno',
      primaryColor: '#2563eb',
      secondaryColor: '#0f172a',
      textColor: '#0f172a',
      backgroundColor: '#f8fafc',
      surfaceColor: '#ffffff',
      accentSoft: '#dbeafe',
      fontFamily: "'Manrope', 'Segoe UI', sans-serif",
      headingFamily: "'Space Grotesk', 'Segoe UI', sans-serif",
      borderRadius: 26,
      buttonStyle: 'solid',
      cardLayout: 'soft',
      spacingScale: 'comfortable'
    },
    elegante: {
      label: 'Elegante',
      primaryColor: '#7c3aed',
      secondaryColor: '#1e1b4b',
      textColor: '#20183a',
      backgroundColor: '#f7f5ff',
      surfaceColor: '#ffffff',
      accentSoft: '#ede9fe',
      fontFamily: "Georgia, 'Times New Roman', serif",
      headingFamily: "'Space Grotesk', 'Segoe UI', sans-serif",
      borderRadius: 18,
      buttonStyle: 'outline',
      cardLayout: 'outline',
      spacingScale: 'airy'
    },
    vibrante: {
      label: 'Vibrante',
      primaryColor: '#ea580c',
      secondaryColor: '#7c2d12',
      textColor: '#431407',
      backgroundColor: '#fff7ed',
      surfaceColor: '#ffffff',
      accentSoft: '#ffedd5',
      fontFamily: "'Manrope', 'Segoe UI', sans-serif",
      headingFamily: "'Space Grotesk', 'Segoe UI', sans-serif",
      borderRadius: 30,
      buttonStyle: 'pill',
      cardLayout: 'glass',
      spacingScale: 'compact'
    }
  };

  const BLOCK_LIBRARY = {
    hero: {
      label: 'Hero/Banner principal',
      defaultConfig: {
        eyebrow: 'Pagina personalizada',
        title: 'Sua pagina pronta para converter mais',
        subtitle: 'Organize sua vitrine, destaque os produtos certos e conduza o clique com mais clareza.',
        primaryCtaLabel: 'Ver produtos',
        primaryCtaHref: '#produtos',
        secondaryCtaLabel: 'Falar no WhatsApp',
        secondaryCtaHref: '',
        backgroundImageUrl: '',
        trustItems: ['Curadoria propria', 'Layout personalizavel', 'Foco em conversao']
      }
    },
    products: {
      label: 'Lista de produtos',
      defaultConfig: {
        title: 'Produtos em destaque',
        subtitle: 'Produtos organizados para facilitar a decisao de compra.',
        showSearch: true,
        showCategoryFilter: true,
        showSort: true,
        limit: 24,
        emphasizeFeatured: true,
        showSocialProof: true,
        ctaLabelOverride: ''
      }
    },
    cta: {
      label: 'CTA principal',
      defaultConfig: {
        badge: 'Oferta principal',
        title: 'Leve o visitante para a proxima acao',
        description: 'Reforce a oferta, destaque o beneficio e use um CTA direto.',
        buttonLabel: 'Comprar agora',
        buttonHref: '#produtos',
        note: 'Pagina preparada para trafego de campanhas e conteudo organico.'
      }
    },
    testimonials: {
      label: 'Depoimentos',
      defaultConfig: {
        title: 'Quem chegou ate aqui aprovou',
        subtitle: 'Use prova social para reduzir friccao e acelerar a conversao.',
        items: [
          { quote: 'Pagina objetiva, facil de navegar e com ofertas bem claras.', name: 'Cliente 1', role: 'Compradora' },
          { quote: 'Encontrei o produto certo com muito menos esforco.', name: 'Cliente 2', role: 'Cliente recorrente' }
        ]
      }
    },
    video: {
      label: 'Video incorporado',
      defaultConfig: {
        title: 'Veja a oferta em detalhes',
        subtitle: 'Inclua review, demonstracao ou apresentacao em video.',
        embedUrl: ''
      }
    },
    faq: {
      label: 'FAQ',
      defaultConfig: {
        title: 'Perguntas frequentes',
        subtitle: 'Antecipe objecoes comuns antes do clique final.',
        items: [
          { question: 'Como funciona a compra?', answer: 'O clique leva para o parceiro responsavel pela oferta.' },
          { question: 'Posso ver mais produtos?', answer: 'Sim. Continue navegando pela vitrine para comparar opcoes.' }
        ]
      }
    },
    footer: {
      label: 'Rodape personalizado',
      defaultConfig: {
        title: 'Sua marca continua ate o ultimo bloco',
        description: 'Feche a pagina com links, suporte e reforco de identidade.',
        copyright: 'Todos os direitos reservados.',
        links: [
          { label: 'Produtos', href: '#produtos' },
          { label: 'Perguntas', href: '#faq' }
        ]
      }
    }
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function toText(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
  }

  function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function toBoolean(value, fallback = false) {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return fallback;
  }

  function normalizeHexColor(value, fallback) {
    const raw = String(value || '').trim().toLowerCase();
    return /^#([0-9a-f]{6}|[0-9a-f]{3})$/.test(raw) ? raw : fallback;
  }

  function isValidHttpUrl(raw) {
    try {
      const parsed = new URL(String(raw || '').trim());
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (typeof text === 'string') element.textContent = text;
    return element;
  }

  function normalizeThemeKey(value) {
    const key = String(value || '').trim().toLowerCase();
    return VALID_THEME_KEYS.includes(key) ? key : DEFAULT_THEME_KEY;
  }

  function normalizeThemeSettings(themeKey, raw = {}) {
    const preset = THEME_PRESETS[normalizeThemeKey(themeKey)];
    return {
      themeKey: normalizeThemeKey(themeKey),
      primaryColor: normalizeHexColor(raw.primaryColor, preset.primaryColor),
      secondaryColor: normalizeHexColor(raw.secondaryColor, preset.secondaryColor),
      textColor: normalizeHexColor(raw.textColor, preset.textColor),
      backgroundColor: normalizeHexColor(raw.backgroundColor, preset.backgroundColor),
      surfaceColor: normalizeHexColor(raw.surfaceColor, preset.surfaceColor),
      accentSoft: normalizeHexColor(raw.accentSoft, preset.accentSoft),
      fontFamily: toText(raw.fontFamily, preset.fontFamily),
      headingFamily: toText(raw.headingFamily, preset.headingFamily),
      borderRadius: Math.max(8, Math.min(40, toNumber(raw.borderRadius, preset.borderRadius))),
      buttonStyle: ['solid', 'outline', 'pill'].includes(String(raw.buttonStyle || '').trim().toLowerCase())
        ? String(raw.buttonStyle).trim().toLowerCase()
        : preset.buttonStyle,
      cardLayout: ['soft', 'outline', 'glass'].includes(String(raw.cardLayout || '').trim().toLowerCase())
        ? String(raw.cardLayout).trim().toLowerCase()
        : preset.cardLayout,
      spacingScale: ['compact', 'comfortable', 'airy'].includes(String(raw.spacingScale || '').trim().toLowerCase())
        ? String(raw.spacingScale).trim().toLowerCase()
        : preset.spacingScale
    };
  }

  function normalizeSeoSettings(raw = {}, store = {}) {
    return {
      title: toText(raw.title, store.store_name || 'Minha pagina'),
      metaDescription: toText(raw.metaDescription, store.bio || store.headline || 'Pagina personalizada para divulgar produtos com mais clareza.'),
      ogImageUrl: toText(raw.ogImageUrl, store.banner_url || store.photo_url || ''),
      shareImageUrl: toText(raw.shareImageUrl, raw.ogImageUrl || store.banner_url || store.photo_url || ''),
      faviconUrl: toText(raw.faviconUrl, store.photo_url || ''),
      logoUrl: toText(raw.logoUrl, store.photo_url || ''),
      customPath: toText(raw.customPath, ''),
      futureSubdomain: toText(raw.futureSubdomain, '')
    };
  }

  function normalizeConversionSettings(raw = {}, store = {}) {
    return {
      socialProofText: toText(raw.socialProofText, 'Produto em alta'),
      highlightBadgeText: toText(raw.highlightBadgeText, 'Destaque'),
      countdownEnabled: toBoolean(raw.countdownEnabled, false),
      countdownLabel: toText(raw.countdownLabel, 'Oferta termina em'),
      countdownEndAt: toText(raw.countdownEndAt, ''),
      promoBannerEnabled: toBoolean(raw.promoBannerEnabled, false),
      promoBannerText: toText(raw.promoBannerText, 'Oferta especial ativa hoje'),
      promoBannerLink: toText(raw.promoBannerLink, '#produtos'),
      whatsappEnabled: toBoolean(raw.whatsappEnabled, false),
      whatsappPhone: toText(raw.whatsappPhone, ''),
      whatsappMessage: toText(raw.whatsappMessage, `Oi! Vim da pagina ${store.store_name || 'da loja'} e quero saber mais.`),
      floatingCtaLabel: toText(raw.floatingCtaLabel, 'Falar no WhatsApp')
    };
  }

  function normalizeListItems(items, shape) {
    if (!Array.isArray(items)) return clone(shape);
    const normalized = items
      .map((item, index) => {
        if (typeof item === 'string') {
          return shape[0]?.quote
            ? { quote: item, name: `Pessoa ${index + 1}`, role: 'Cliente' }
            : shape[0]?.question
              ? { question: item, answer: '' }
              : { label: item, href: '#' };
        }
        return item || null;
      })
      .filter(Boolean)
      .map((item) => {
        if (shape[0]?.quote) {
          return {
            quote: toText(item.quote, ''),
            name: toText(item.name, 'Cliente'),
            role: toText(item.role, 'Cliente')
          };
        }
        if (shape[0]?.question) {
          return {
            question: toText(item.question, ''),
            answer: toText(item.answer, '')
          };
        }
        return {
          label: toText(item.label, 'Link'),
          href: toText(item.href, '#')
        };
      })
      .filter((item) => Object.values(item).some(Boolean));

    return normalized.length ? normalized : clone(shape);
  }

  function normalizeBlockConfig(type, config = {}, store = {}) {
    const defaults = clone(BLOCK_LIBRARY[type]?.defaultConfig || {});
    const merged = { ...defaults, ...(config || {}) };

    switch (type) {
      case 'hero':
        return {
          eyebrow: toText(merged.eyebrow, defaults.eyebrow),
          title: toText(merged.title, store.store_name ? `Achados e ofertas em ${store.store_name}` : defaults.title),
          subtitle: toText(merged.subtitle, store.headline || store.bio || defaults.subtitle),
          primaryCtaLabel: toText(merged.primaryCtaLabel, defaults.primaryCtaLabel),
          primaryCtaHref: toText(merged.primaryCtaHref, defaults.primaryCtaHref),
          secondaryCtaLabel: toText(merged.secondaryCtaLabel, defaults.secondaryCtaLabel),
          secondaryCtaHref: toText(merged.secondaryCtaHref, defaults.secondaryCtaHref),
          backgroundImageUrl: toText(merged.backgroundImageUrl, store.banner_url || ''),
          trustItems: Array.isArray(merged.trustItems)
            ? merged.trustItems.map((item) => toText(item)).filter(Boolean).slice(0, 4)
            : clone(defaults.trustItems)
        };
      case 'products':
        return {
          title: toText(merged.title, defaults.title),
          subtitle: toText(merged.subtitle, defaults.subtitle),
          showSearch: toBoolean(merged.showSearch, defaults.showSearch),
          showCategoryFilter: toBoolean(merged.showCategoryFilter, defaults.showCategoryFilter),
          showSort: toBoolean(merged.showSort, defaults.showSort),
          limit: Math.max(1, Math.min(60, toNumber(merged.limit, defaults.limit))),
          emphasizeFeatured: toBoolean(merged.emphasizeFeatured, defaults.emphasizeFeatured),
          showSocialProof: toBoolean(merged.showSocialProof, defaults.showSocialProof),
          ctaLabelOverride: toText(merged.ctaLabelOverride, '')
        };
      case 'cta':
        return {
          badge: toText(merged.badge, defaults.badge),
          title: toText(merged.title, defaults.title),
          description: toText(merged.description, defaults.description),
          buttonLabel: toText(merged.buttonLabel, defaults.buttonLabel),
          buttonHref: toText(merged.buttonHref, defaults.buttonHref),
          note: toText(merged.note, defaults.note)
        };
      case 'testimonials':
        return {
          title: toText(merged.title, defaults.title),
          subtitle: toText(merged.subtitle, defaults.subtitle),
          items: normalizeListItems(merged.items, defaults.items)
        };
      case 'video':
        return {
          title: toText(merged.title, defaults.title),
          subtitle: toText(merged.subtitle, defaults.subtitle),
          embedUrl: toText(merged.embedUrl, '')
        };
      case 'faq':
        return {
          title: toText(merged.title, defaults.title),
          subtitle: toText(merged.subtitle, defaults.subtitle),
          items: normalizeListItems(merged.items, defaults.items)
        };
      case 'footer':
        return {
          title: toText(merged.title, defaults.title),
          description: toText(merged.description, defaults.description),
          copyright: toText(merged.copyright, defaults.copyright),
          links: normalizeListItems(merged.links, defaults.links)
        };
      default:
        return merged;
    }
  }

  function normalizeBlock(raw = {}, index = 0, store = {}) {
    const type = VALID_BLOCK_TYPES.includes(String(raw.type || raw.block_type || '').trim().toLowerCase())
      ? String(raw.type || raw.block_type).trim().toLowerCase()
      : VALID_BLOCK_TYPES[index] || 'hero';

    return {
      id: raw.id || `${type}-${index + 1}`,
      type,
      label: toText(raw.label, BLOCK_LIBRARY[type].label),
      enabled: toBoolean(raw.enabled ?? raw.is_enabled, true),
      position: Math.max(0, toNumber(raw.position, index)),
      config: normalizeBlockConfig(type, raw.config || {}, store)
    };
  }

  function getDefaultBlocks(store = {}) {
    return VALID_BLOCK_TYPES.map((type, index) => normalizeBlock({
      type,
      position: index,
      config: clone(BLOCK_LIBRARY[type].defaultConfig)
    }, index, store));
  }

  function createDefaultPage(store = {}) {
    const themeKey = DEFAULT_THEME_KEY;
    return {
      id: null,
      profileId: store.id || store.user_id || null,
      status: 'published',
      themeKey,
      title: store.store_name || 'Minha pagina',
      description: store.bio || store.headline || 'Pagina personalizada para divulgar produtos com mais conversao.',
      themeSettings: normalizeThemeSettings(themeKey, {}),
      seoSettings: normalizeSeoSettings({}, store),
      conversionSettings: normalizeConversionSettings({}, store),
      pageSettings: {
        previewDevice: 'desktop'
      },
      blocks: getDefaultBlocks(store)
    };
  }

  function normalizePageData(payload = {}, store = {}) {
    const base = createDefaultPage(store);
    const rawPage = payload.page || payload;
    const themeKey = normalizeThemeKey(rawPage.theme_key || rawPage.themeKey || base.themeKey);
    const blocksSource = Array.isArray(payload.blocks) ? payload.blocks : Array.isArray(rawPage.blocks) ? rawPage.blocks : base.blocks;

    return {
      id: rawPage.id || null,
      profileId: rawPage.profile_id || rawPage.profileId || base.profileId,
      status: toText(rawPage.status, base.status) === 'draft' ? 'draft' : 'published',
      themeKey,
      title: toText(rawPage.title, base.title),
      description: toText(rawPage.description, base.description),
      themeSettings: normalizeThemeSettings(themeKey, rawPage.theme_settings || rawPage.themeSettings || {}),
      seoSettings: normalizeSeoSettings(rawPage.seo_settings || rawPage.seoSettings || {}, store),
      conversionSettings: normalizeConversionSettings(rawPage.conversion_settings || rawPage.conversionSettings || {}, store),
      pageSettings: {
        ...base.pageSettings,
        ...(rawPage.page_settings || rawPage.pageSettings || {})
      },
      blocks: blocksSource
        .map((block, index) => normalizeBlock(block, index, store))
        .sort((a, b) => a.position - b.position)
    };
  }

  function serializePageForSave(page = {}) {
    return {
      id: page.id || null,
      status: page.status || 'published',
      theme_key: page.themeKey || DEFAULT_THEME_KEY,
      title: toText(page.title, ''),
      description: toText(page.description, ''),
      theme_settings: clone(page.themeSettings || {}),
      seo_settings: clone(page.seoSettings || {}),
      conversion_settings: clone(page.conversionSettings || {}),
      page_settings: clone(page.pageSettings || {})
    };
  }

  function serializeBlocksForSave(blocks = [], pageId, profileId) {
    return blocks.map((block, index) => ({
      id: block.id && !String(block.id).startsWith(`${block.type}-`) ? block.id : undefined,
      page_id: pageId,
      profile_id: profileId,
      block_type: block.type,
      label: block.label || BLOCK_LIBRARY[block.type].label,
      is_enabled: Boolean(block.enabled),
      position: index,
      config: clone(block.config || {})
    }));
  }

  function buildSeoPayload(store = {}, page = {}) {
    const seo = normalizeSeoSettings(page.seoSettings || {}, store);
    return {
      title: seo.title || store.store_name || 'Pagina personalizada',
      description: seo.metaDescription || store.bio || store.headline || '',
      image: seo.shareImageUrl || seo.ogImageUrl || store.banner_url || store.photo_url || '',
      faviconUrl: seo.faviconUrl || '',
      logoUrl: seo.logoUrl || ''
    };
  }

  function getSpacingClass(scale) {
    if (scale === 'compact') return 'is-compact';
    if (scale === 'airy') return 'is-airy';
    return 'is-comfortable';
  }

  function applyThemeVariables(target, theme) {
    target.style.setProperty('--page-primary', theme.primaryColor);
    target.style.setProperty('--page-secondary', theme.secondaryColor);
    target.style.setProperty('--page-text', theme.textColor);
    target.style.setProperty('--page-bg', theme.backgroundColor);
    target.style.setProperty('--page-surface', theme.surfaceColor);
    target.style.setProperty('--page-accent-soft', theme.accentSoft);
    target.style.setProperty('--page-radius', `${theme.borderRadius}px`);
    target.style.setProperty('--page-font', theme.fontFamily);
    target.style.setProperty('--page-heading-font', theme.headingFamily);
  }

  function createButton(label, href, style, kind = 'primary') {
    const button = document.createElement(href ? 'a' : 'button');
    button.className = `affiliate-btn affiliate-btn-${kind}`;
    button.textContent = label;
    button.dataset.buttonStyle = style;

    if (href) {
      button.href = href;
      if (isValidHttpUrl(href)) {
        button.target = '_blank';
        button.rel = 'noopener noreferrer nofollow';
      }
    } else {
      button.type = 'button';
    }

    return button;
  }

  function attachTrackHandler(element, handler, payload) {
    if (!element || typeof handler !== 'function') return;
    element.addEventListener('click', () => handler(payload));
  }

  function buildWhatsappUrl(conversion) {
    const phone = String(conversion.whatsappPhone || '').replace(/\D/g, '');
    if (!phone) return '';
    const message = encodeURIComponent(conversion.whatsappMessage || 'Oi! Quero saber mais.');
    return `https://wa.me/${phone}?text=${message}`;
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(Number(value || 0));
  }

  function renderPromoBanner(conversion, theme, onTrack) {
    if (!conversion.promoBannerEnabled || !conversion.promoBannerText) return null;

    const banner = createElement('div', 'affiliate-promo-banner');
    const text = createElement('span', 'affiliate-promo-banner-text', conversion.promoBannerText);
    banner.appendChild(text);

    if (conversion.promoBannerLink) {
      const link = createButton('Aproveitar oferta', conversion.promoBannerLink, theme.buttonStyle, 'ghost');
      link.classList.add('affiliate-promo-banner-link');
      attachTrackHandler(link, onTrack, {
        eventName: 'cta_click',
        blockType: 'promo_banner',
        source: 'promo-banner'
      });
      banner.appendChild(link);
    }

    return banner;
  }

  function renderCountdown(conversion) {
    if (!conversion.countdownEnabled || !conversion.countdownEndAt) return null;

    const wrapper = createElement('div', 'affiliate-countdown');
    const label = createElement('span', 'affiliate-countdown-label', conversion.countdownLabel);
    const value = createElement('strong', 'affiliate-countdown-value', '--:--:--');
    wrapper.append(label, value);

    const targetDate = new Date(conversion.countdownEndAt);
    if (Number.isNaN(targetDate.getTime())) {
      value.textContent = 'Data invalida';
      return wrapper;
    }

    const updateCountdown = () => {
      const diff = targetDate.getTime() - Date.now();
      if (diff <= 0) {
        value.textContent = 'Encerrado';
        return;
      }

      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      value.textContent = [hours, minutes, seconds].map((item) => String(item).padStart(2, '0')).join(':');
      window.requestAnimationFrame(() => window.setTimeout(updateCountdown, 1000));
    };

    updateCountdown();
    return wrapper;
  }

  function renderHeroBlock(block, context) {
    const section = createElement('section', 'affiliate-block affiliate-hero-block');
    section.id = 'hero';
    const layout = createElement('div', 'affiliate-hero-layout');
    const copy = createElement('div', 'affiliate-hero-copy');
    const media = createElement('div', 'affiliate-hero-media');
    const badge = createElement('span', 'affiliate-kicker', block.config.eyebrow);
    const title = createElement('h1', 'affiliate-hero-title', block.config.title);
    const subtitle = createElement('p', 'affiliate-hero-subtitle', block.config.subtitle);
    const actions = createElement('div', 'affiliate-hero-actions');
    const meta = createElement('div', 'affiliate-hero-meta');

    if (context.conversion.highlightBadgeText) {
      meta.appendChild(createElement('span', 'affiliate-stat-pill', context.conversion.highlightBadgeText));
    }
    if (context.conversion.socialProofText) {
      meta.appendChild(createElement('span', 'affiliate-stat-pill is-soft', context.conversion.socialProofText));
    }

    (block.config.trustItems || []).forEach((item) => {
      meta.appendChild(createElement('span', 'affiliate-stat-pill is-outline', item));
    });

    const primaryButton = createButton(block.config.primaryCtaLabel, block.config.primaryCtaHref, context.theme.buttonStyle, 'primary');
    const secondaryHref = block.config.secondaryCtaHref || (context.conversion.whatsappEnabled ? buildWhatsappUrl(context.conversion) : '');
    const secondaryButton = createButton(block.config.secondaryCtaLabel, secondaryHref, context.theme.buttonStyle, 'secondary');

    attachTrackHandler(primaryButton, context.onTrack, {
      eventName: 'cta_click',
      blockType: block.type,
      source: 'hero-primary'
    });
    attachTrackHandler(secondaryButton, context.onTrack, {
      eventName: 'cta_click',
      blockType: block.type,
      source: 'hero-secondary'
    });

    actions.append(primaryButton, secondaryButton);
    copy.append(badge, title, subtitle);
    if (meta.childNodes.length) copy.appendChild(meta);
    const countdown = renderCountdown(context.conversion);
    if (countdown) copy.appendChild(countdown);
    copy.appendChild(actions);

    if (isValidHttpUrl(block.config.backgroundImageUrl)) {
      const image = createElement('img', 'affiliate-hero-image');
      image.src = block.config.backgroundImageUrl;
      image.alt = context.store.store_name || 'Imagem principal';
      image.loading = 'lazy';
      media.appendChild(image);
    } else {
      const card = createElement('div', 'affiliate-hero-placeholder');
      card.appendChild(createElement('span', 'affiliate-kicker', 'Conversao'));
      card.appendChild(createElement('strong', 'affiliate-placeholder-title', 'Pagina pensada para destacar a oferta certa'));
      card.appendChild(createElement('p', 'affiliate-placeholder-copy', 'Use o hero para posicionar proposta, prova social e CTA principal logo acima da dobra.'));
      media.appendChild(card);
    }

    layout.append(copy, media);
    section.appendChild(layout);
    return section;
  }

  function renderProductsBlock(block, context) {
    const section = createElement('section', 'affiliate-block affiliate-products-block');
    section.id = 'produtos';
    const header = createElement('div', 'affiliate-block-head');
    header.append(
      createElement('span', 'affiliate-kicker', 'Produtos'),
      createElement('h2', 'affiliate-section-title', block.config.title),
      createElement('p', 'affiliate-section-copy', block.config.subtitle)
    );
    section.appendChild(header);

    const products = Array.isArray(context.products) ? [...context.products] : [];
    const categories = Array.from(new Map(products.map((item) => [item.category_id, item.category_name || 'Geral'])).entries())
      .filter(([key]) => Boolean(key))
      .map(([id, name]) => ({ id, name }));

    const toolbar = createElement('div', 'affiliate-products-toolbar');
    const searchInput = createElement('input', 'form-control');
    searchInput.type = 'search';
    searchInput.placeholder = 'Buscar produto';
    const categorySelect = createElement('select', 'form-select');
    const sortSelect = createElement('select', 'form-select');
    categorySelect.innerHTML = '<option value="all">Todas as categorias</option>';
    categories.forEach((category) => {
      const option = createElement('option', '', category.name);
      option.value = category.id;
      categorySelect.appendChild(option);
    });
    sortSelect.innerHTML = [
      '<option value="recent">Mais recentes</option>',
      '<option value="featured">Destaques primeiro</option>',
      '<option value="price-asc">Menor preco</option>',
      '<option value="price-desc">Maior preco</option>',
      '<option value="title-asc">Nome A-Z</option>'
    ].join('');

    if (block.config.showCategoryFilter) {
      const wrap = createElement('div', 'affiliate-toolbar-field');
      wrap.append(createElement('label', 'form-label', 'Categoria'), categorySelect);
      toolbar.appendChild(wrap);
    }
    if (block.config.showSearch) {
      const wrap = createElement('div', 'affiliate-toolbar-field');
      wrap.append(createElement('label', 'form-label', 'Buscar'), searchInput);
      toolbar.appendChild(wrap);
    }
    if (block.config.showSort) {
      const wrap = createElement('div', 'affiliate-toolbar-field');
      wrap.append(createElement('label', 'form-label', 'Ordenar por'), sortSelect);
      toolbar.appendChild(wrap);
    }
    if (toolbar.childNodes.length) section.appendChild(toolbar);

    const grid = createElement('div', 'affiliate-products-grid');
    const empty = createElement('div', 'affiliate-empty-state d-none');
    empty.append(
      createElement('strong', 'affiliate-empty-title', 'Nenhum produto encontrado'),
      createElement('p', 'affiliate-empty-copy', 'Ajuste os filtros ou cadastre novos produtos para preencher este bloco.')
    );
    section.append(grid, empty);

    const sortItems = (items, mode) => {
      const list = [...items];
      switch (mode) {
        case 'price-asc':
          return list.sort((a, b) => Number(a.preco || 0) - Number(b.preco || 0));
        case 'price-desc':
          return list.sort((a, b) => Number(b.preco || 0) - Number(a.preco || 0));
        case 'title-asc':
          return list.sort((a, b) => String(a.titulo || '').localeCompare(String(b.titulo || ''), 'pt-BR'));
        case 'featured':
          return list.sort((a, b) => Number(Boolean(b.is_featured)) - Number(Boolean(a.is_featured)));
        case 'recent':
        default:
          return list.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      }
    };

    const renderProducts = () => {
      grid.innerHTML = '';
      const term = String(searchInput.value || '').trim().toLowerCase();
      const category = categorySelect.value;
      const filtered = products.filter((product) => {
        if (category && category !== 'all' && product.category_id !== category) return false;
        if (!term) return true;
        const bag = `${product.titulo || ''} ${product.descricao || ''} ${product.category_name || ''}`.toLowerCase();
        return bag.includes(term);
      });

      const sorted = sortItems(filtered, sortSelect.value || 'recent');
      const finalItems = block.config.emphasizeFeatured
        ? sorted.sort((a, b) => Number(Boolean(b.is_featured)) - Number(Boolean(a.is_featured)))
        : sorted;
      const limited = finalItems.slice(0, block.config.limit);

      empty.classList.toggle('d-none', limited.length > 0);

      limited.forEach((product) => {
        const card = createElement('article', 'affiliate-product-card');
        card.dataset.cardLayout = context.theme.cardLayout;

        const visual = createElement('div', 'affiliate-product-visual');
        const image = createElement('img', 'affiliate-product-image');
        image.src = product.imagem_url || 'https://via.placeholder.com/640x480?text=Produto';
        image.alt = product.titulo || 'Produto';
        image.loading = 'lazy';
        image.referrerPolicy = 'no-referrer';
        visual.appendChild(image);

        const badges = createElement('div', 'affiliate-product-badges');
        if (product.is_featured) {
          badges.appendChild(createElement('span', 'affiliate-product-badge is-featured', context.conversion.highlightBadgeText));
        }
        if (block.config.showSocialProof && context.conversion.socialProofText) {
          badges.appendChild(createElement('span', 'affiliate-product-badge is-proof', context.conversion.socialProofText));
        }
        if (product.category_name) {
          badges.appendChild(createElement('span', 'affiliate-product-badge is-category', product.category_name));
        }

        const body = createElement('div', 'affiliate-product-body');
        const title = createElement('h3', 'affiliate-product-title', product.titulo || 'Produto');
        const hasDescription = Boolean(String(product.descricao || '').trim());
        const description = createElement('p', 'affiliate-product-copy', product.descricao || 'Produto sem descricao detalhada.');
        const descriptionToggle = createElement('button', 'affiliate-product-more', 'Ler mais...');
        descriptionToggle.type = 'button';
        description.classList.toggle('is-collapsed', hasDescription);
        descriptionToggle.classList.toggle('d-none', !hasDescription);
        descriptionToggle.addEventListener('click', () => {
          const isCollapsed = description.classList.toggle('is-collapsed');
          descriptionToggle.textContent = isCollapsed ? 'Ler mais...' : 'Ler menos';
        });
        const price = createElement('div', 'affiliate-price-tag', formatCurrency(product.preco));
        const link = createButton(block.config.ctaLabelOverride || context.store.cta_label || 'Ver produto', product.product_url || product.link_afiliado || '#', context.theme.buttonStyle, 'primary');
        link.classList.add('affiliate-product-link');

        attachTrackHandler(link, context.onTrack, {
          eventName: 'product_click',
          blockType: block.type,
          source: 'product-card',
          productId: product.id,
          payload: {
            featured: Boolean(product.is_featured),
            category: product.category_name || null
          }
        });

        body.append(title, description, descriptionToggle, price, link);
        card.append(visual);
        if (badges.childNodes.length) card.appendChild(badges);
        card.appendChild(body);
        grid.appendChild(card);
      });
    };

    searchInput.addEventListener('input', renderProducts);
    categorySelect.addEventListener('change', renderProducts);
    sortSelect.addEventListener('change', renderProducts);
    renderProducts();

    return section;
  }

  function renderCtaBlock(block, context) {
    const section = createElement('section', 'affiliate-block affiliate-cta-block');
    const shell = createElement('div', 'affiliate-cta-shell');
    shell.append(
      createElement('span', 'affiliate-kicker', block.config.badge),
      createElement('h2', 'affiliate-section-title', block.config.title),
      createElement('p', 'affiliate-section-copy', block.config.description)
    );
    const button = createButton(block.config.buttonLabel, block.config.buttonHref, context.theme.buttonStyle, 'primary');
    attachTrackHandler(button, context.onTrack, {
      eventName: 'cta_click',
      blockType: block.type,
      source: 'cta-main'
    });
    shell.append(button, createElement('p', 'affiliate-cta-note', block.config.note));
    section.appendChild(shell);
    return section;
  }

  function renderTestimonialsBlock(block) {
    const section = createElement('section', 'affiliate-block');
    section.id = 'depoimentos';
    const header = createElement('div', 'affiliate-block-head');
    header.append(
      createElement('span', 'affiliate-kicker', 'Prova social'),
      createElement('h2', 'affiliate-section-title', block.config.title),
      createElement('p', 'affiliate-section-copy', block.config.subtitle)
    );
    section.appendChild(header);

    const grid = createElement('div', 'affiliate-testimonial-grid');
    block.config.items.forEach((item) => {
      const card = createElement('article', 'affiliate-testimonial-card');
      card.append(
        createElement('p', 'affiliate-testimonial-quote', item.quote),
        createElement('strong', 'affiliate-testimonial-name', item.name),
        createElement('span', 'affiliate-testimonial-role', item.role)
      );
      grid.appendChild(card);
    });
    section.appendChild(grid);
    return section;
  }

  function getEmbedUrl(raw) {
    const source = String(raw || '').trim();
    if (!source) return '';

    try {
      const parsed = new URL(source);
      if (parsed.hostname.includes('youtube.com') || parsed.hostname.includes('youtu.be')) {
        const videoId = parsed.searchParams.get('v') || parsed.pathname.split('/').filter(Boolean).pop();
        return videoId ? `https://www.youtube.com/embed/${videoId}` : '';
      }
      if (parsed.hostname.includes('vimeo.com')) {
        const videoId = parsed.pathname.split('/').filter(Boolean).pop();
        return videoId ? `https://player.vimeo.com/video/${videoId}` : '';
      }
      return source;
    } catch {
      return '';
    }
  }

  function renderVideoBlock(block) {
    const section = createElement('section', 'affiliate-block');
    section.id = 'video';
    const header = createElement('div', 'affiliate-block-head');
    header.append(
      createElement('span', 'affiliate-kicker', 'Video'),
      createElement('h2', 'affiliate-section-title', block.config.title),
      createElement('p', 'affiliate-section-copy', block.config.subtitle)
    );
    section.appendChild(header);

    const embedUrl = getEmbedUrl(block.config.embedUrl);
    const shell = createElement('div', 'affiliate-video-shell');

    if (embedUrl) {
      const iframe = createElement('iframe', 'affiliate-video-frame');
      iframe.src = embedUrl;
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      iframe.allowFullscreen = true;
      iframe.loading = 'lazy';
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      shell.appendChild(iframe);
    } else {
      shell.appendChild(createElement('p', 'affiliate-video-placeholder', 'Adicione uma URL de YouTube ou Vimeo para exibir um video aqui.'));
    }

    section.appendChild(shell);
    return section;
  }

  function renderFaqBlock(block) {
    const section = createElement('section', 'affiliate-block');
    section.id = 'faq';
    const header = createElement('div', 'affiliate-block-head');
    header.append(
      createElement('span', 'affiliate-kicker', 'FAQ'),
      createElement('h2', 'affiliate-section-title', block.config.title),
      createElement('p', 'affiliate-section-copy', block.config.subtitle)
    );
    section.appendChild(header);

    const list = createElement('div', 'affiliate-faq-list');
    block.config.items.forEach((item) => {
      const details = createElement('details', 'affiliate-faq-item');
      const summary = createElement('summary', 'affiliate-faq-question', item.question);
      const answer = createElement('p', 'affiliate-faq-answer', item.answer);
      details.append(summary, answer);
      list.appendChild(details);
    });
    section.appendChild(list);
    return section;
  }

  function renderFooterBlock(block, context) {
    const footer = createElement('section', 'affiliate-block affiliate-footer-block');
    const head = createElement('div', 'affiliate-footer-brand');
    head.append(
      createElement('strong', 'affiliate-footer-title', block.config.title || context.store.store_name || 'Sua pagina'),
      createElement('p', 'affiliate-footer-copy', block.config.description)
    );

    const links = createElement('div', 'affiliate-footer-links');
    block.config.links.forEach((item) => {
      const link = createButton(item.label, item.href, context.theme.buttonStyle, 'link');
      links.appendChild(link);
    });

    footer.append(head, links, createElement('small', 'affiliate-footer-meta', block.config.copyright));
    return footer;
  }

  function renderFloatingWhatsapp(conversion, theme, onTrack) {
    if (!conversion.whatsappEnabled || !conversion.whatsappPhone) return null;
    const href = buildWhatsappUrl(conversion);
    if (!href) return null;

    const button = createButton(conversion.floatingCtaLabel, href, theme.buttonStyle, 'whatsapp');
    button.classList.add('affiliate-whatsapp-float');
    attachTrackHandler(button, onTrack, {
      eventName: 'cta_click',
      blockType: 'floating_whatsapp',
      source: 'floating-whatsapp'
    });
    return button;
  }

  function renderPageShell({ mountEl, store = {}, page = {}, products = [], preview = false, onTrack = () => {} }) {
    const normalizedPage = normalizePageData(page, store);
    const wrapper = createElement('div', `affiliate-page-shell ${getSpacingClass(normalizedPage.themeSettings.spacingScale)}`);
    applyThemeVariables(wrapper, normalizedPage.themeSettings);
    wrapper.dataset.preview = preview ? 'true' : 'false';
    wrapper.dataset.cardLayout = normalizedPage.themeSettings.cardLayout;

    const promoBanner = renderPromoBanner(normalizedPage.conversionSettings, normalizedPage.themeSettings, onTrack);
    if (promoBanner) wrapper.appendChild(promoBanner);

    const sectionHost = createElement('div', 'affiliate-page-sections');
    const context = {
      store,
      page: normalizedPage,
      theme: normalizedPage.themeSettings,
      conversion: normalizedPage.conversionSettings,
      products,
      preview,
      onTrack
    };

    normalizedPage.blocks
      .filter((block) => block.enabled)
      .sort((a, b) => a.position - b.position)
      .forEach((block) => {
        let section = null;

        switch (block.type) {
          case 'hero':
            section = renderHeroBlock(block, context);
            break;
          case 'products':
            section = renderProductsBlock(block, context);
            break;
          case 'cta':
            section = renderCtaBlock(block, context);
            break;
          case 'testimonials':
            section = renderTestimonialsBlock(block, context);
            break;
          case 'video':
            section = renderVideoBlock(block, context);
            break;
          case 'faq':
            section = renderFaqBlock(block, context);
            break;
          case 'footer':
            section = renderFooterBlock(block, context);
            break;
          default:
            break;
        }

        if (section) {
          section.dataset.blockType = block.type;
          sectionHost.appendChild(section);
        }
      });

    wrapper.appendChild(sectionHost);

    const whatsapp = renderFloatingWhatsapp(normalizedPage.conversionSettings, normalizedPage.themeSettings, onTrack);
    if (whatsapp) wrapper.appendChild(whatsapp);

    if (preview) {
      wrapper.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', (event) => event.preventDefault());
      });
    }

    mountEl.innerHTML = '';
    mountEl.appendChild(wrapper);

    return normalizedPage;
  }

  function renderSkeleton(mountEl) {
    const shell = createElement('div', 'affiliate-skeleton-shell');
    shell.innerHTML = `
      <div class="affiliate-skeleton-card is-xl"></div>
      <div class="affiliate-skeleton-grid">
        <div class="affiliate-skeleton-card"></div>
        <div class="affiliate-skeleton-card"></div>
        <div class="affiliate-skeleton-card"></div>
      </div>
      <div class="affiliate-skeleton-grid is-products">
        <div class="affiliate-skeleton-card"></div>
        <div class="affiliate-skeleton-card"></div>
        <div class="affiliate-skeleton-card"></div>
        <div class="affiliate-skeleton-card"></div>
      </div>
    `;
    mountEl.innerHTML = '';
    mountEl.appendChild(shell);
  }

  function getMissingBlockTypes(blocks = []) {
    const existingTypes = new Set(blocks.map((block) => block.type));
    return VALID_BLOCK_TYPES.filter((type) => !existingTypes.has(type));
  }

  window.PageBuilder = {
    BLOCK_LIBRARY,
    THEME_PRESETS,
    VALID_BLOCK_TYPES,
    createDefaultPage,
    getDefaultBlocks,
    getMissingBlockTypes,
    normalizePageData,
    normalizeThemeSettings,
    normalizeSeoSettings,
    normalizeConversionSettings,
    normalizeBlock,
    serializePageForSave,
    serializeBlocksForSave,
    buildSeoPayload,
    renderPageShell,
    renderSkeleton
  };
})();
