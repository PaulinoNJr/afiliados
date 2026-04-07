(() => {
  const state = {
    session: null,
    profile: null,
    page: null,
    products: [],
    selectedBlockId: null,
    dragBlockId: null,
    schemaReady: true
  };

  const refs = {
    status: document.getElementById('builderStatusMessage'),
    saveBuilderBtn: document.getElementById('saveBuilderBtn'),
    pageStatus: document.getElementById('pageStatus'),
    themePreset: document.getElementById('themePreset'),
    builderPrimaryColor: document.getElementById('builderPrimaryColor'),
    builderSecondaryColor: document.getElementById('builderSecondaryColor'),
    builderTextColor: document.getElementById('builderTextColor'),
    builderBackgroundColor: document.getElementById('builderBackgroundColor'),
    builderSurfaceColor: document.getElementById('builderSurfaceColor'),
    builderAccentSoft: document.getElementById('builderAccentSoft'),
    builderFontFamily: document.getElementById('builderFontFamily'),
    builderHeadingFamily: document.getElementById('builderHeadingFamily'),
    builderBorderRadius: document.getElementById('builderBorderRadius'),
    builderSpacingScale: document.getElementById('builderSpacingScale'),
    builderButtonStyle: document.getElementById('builderButtonStyle'),
    builderCardLayout: document.getElementById('builderCardLayout'),
    seoTitle: document.getElementById('seoTitle'),
    seoDescription: document.getElementById('seoDescription'),
    seoOgImageUrl: document.getElementById('seoOgImageUrl'),
    seoFaviconUrl: document.getElementById('seoFaviconUrl'),
    seoLogoUrl: document.getElementById('seoLogoUrl'),
    socialProofText: document.getElementById('socialProofText'),
    highlightBadgeText: document.getElementById('highlightBadgeText'),
    promoBannerEnabled: document.getElementById('promoBannerEnabled'),
    promoBannerText: document.getElementById('promoBannerText'),
    promoBannerLink: document.getElementById('promoBannerLink'),
    countdownEnabled: document.getElementById('countdownEnabled'),
    countdownLabel: document.getElementById('countdownLabel'),
    countdownEndAt: document.getElementById('countdownEndAt'),
    whatsappEnabled: document.getElementById('whatsappEnabled'),
    whatsappPhone: document.getElementById('whatsappPhone'),
    floatingCtaLabel: document.getElementById('floatingCtaLabel'),
    whatsappMessage: document.getElementById('whatsappMessage'),
    blockTypeSelect: document.getElementById('blockTypeSelect'),
    addBlockBtn: document.getElementById('addBlockBtn'),
    pageBlocksList: document.getElementById('pageBlocksList'),
    blockEditorTitle: document.getElementById('blockEditorTitle'),
    blockEditorHint: document.getElementById('blockEditorHint'),
    blockEditorEmpty: document.getElementById('blockEditorEmpty'),
    blockEditorFields: document.getElementById('blockEditorFields'),
    pageBuilderPreview: document.getElementById('pageBuilderPreview'),
    storeName: document.getElementById('storeName'),
    storeSlug: document.getElementById('storeSlug'),
    headline: document.getElementById('headline'),
    storeBio: document.getElementById('storeBio'),
    storeBannerUrl: document.getElementById('storeBannerUrl'),
    ctaLabel: document.getElementById('ctaLabel')
  };

  function showStatus(message, type = 'warning') {
    if (!refs.status) return;
    refs.status.className = `alert alert-${type}`;
    refs.status.textContent = message;
    refs.status.classList.remove('d-none');
  }

  function hideStatus() {
    refs.status?.classList.add('d-none');
  }

  function setSaveLoading(isLoading) {
    refs.saveBuilderBtn.disabled = isLoading;
    refs.saveBuilderBtn.textContent = isLoading ? 'Salvando...' : 'Salvar pagina';
  }

  function getPreviewStore() {
    return {
      id: state.profile?.user_id,
      store_name: refs.storeName?.value.trim() || state.profile?.store_name || 'Minha loja',
      slug: window.StoreUtils.normalizeStoreSlug(refs.storeSlug?.value || state.profile?.slug || ''),
      headline: refs.headline?.value.trim() || '',
      bio: refs.storeBio?.value.trim() || '',
      banner_url: refs.storeBannerUrl?.value.trim() || '',
      photo_url: state.profile?.photo_url || '',
      cta_label: refs.ctaLabel?.value.trim() || state.profile?.cta_label || 'Ver produto'
    };
  }

  function parsePairs(value, fields) {
    return String(value || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split('|').map((item) => item.trim());
        return fields.reduce((acc, key, index) => {
          acc[key] = parts[index] || '';
          return acc;
        }, {});
      });
  }

  function formatPairs(items, fields) {
    return (items || [])
      .map((item) => fields.map((field) => item?.[field] || '').join(' | '))
      .join('\n');
  }

  function dedupePreviewProducts(items = []) {
    const seen = new Set();
    return items.filter((item, index) => {
      const key = String(
        item.id
        || item.product_id
        || item.product_url
        || `${item.titulo || 'produto'}-${index}`
      ).trim();

      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function getCurrentPageFromInputs() {
    if (!state.page) {
      state.page = window.PageBuilder.createDefaultPage(getPreviewStore());
    }

    const themeSettings = window.PageBuilder.normalizeThemeSettings(refs.themePreset.value, {
      primaryColor: refs.builderPrimaryColor.value,
      secondaryColor: refs.builderSecondaryColor.value,
      textColor: refs.builderTextColor.value,
      backgroundColor: refs.builderBackgroundColor.value,
      surfaceColor: refs.builderSurfaceColor.value,
      accentSoft: refs.builderAccentSoft.value,
      fontFamily: refs.builderFontFamily.value,
      headingFamily: refs.builderHeadingFamily.value,
      borderRadius: refs.builderBorderRadius.value,
      buttonStyle: refs.builderButtonStyle.value,
      cardLayout: refs.builderCardLayout.value,
      spacingScale: refs.builderSpacingScale.value
    });

    return {
      ...state.page,
      status: refs.pageStatus.value,
      themeKey: refs.themePreset.value,
      themeSettings,
      seoSettings: window.PageBuilder.normalizeSeoSettings({
        title: refs.seoTitle.value,
        metaDescription: refs.seoDescription.value,
        ogImageUrl: refs.seoOgImageUrl.value,
        faviconUrl: refs.seoFaviconUrl.value,
        logoUrl: refs.seoLogoUrl.value,
        shareImageUrl: refs.seoOgImageUrl.value
      }, getPreviewStore()),
      conversionSettings: window.PageBuilder.normalizeConversionSettings({
        socialProofText: refs.socialProofText.value,
        highlightBadgeText: refs.highlightBadgeText.value,
        promoBannerEnabled: refs.promoBannerEnabled.checked,
        promoBannerText: refs.promoBannerText.value,
        promoBannerLink: refs.promoBannerLink.value,
        countdownEnabled: refs.countdownEnabled.checked,
        countdownLabel: refs.countdownLabel.value,
        countdownEndAt: refs.countdownEndAt.value,
        whatsappEnabled: refs.whatsappEnabled.checked,
        whatsappPhone: refs.whatsappPhone.value,
        floatingCtaLabel: refs.floatingCtaLabel.value,
        whatsappMessage: refs.whatsappMessage.value
      }, getPreviewStore())
    };
  }

  function renderPreview() {
    if (!state.page || !refs.pageBuilderPreview) return;
    state.page = getCurrentPageFromInputs();
    window.PageBuilder.renderPageShell({
      mountEl: refs.pageBuilderPreview,
      store: getPreviewStore(),
      page: state.page,
      products: state.products,
      preview: true
    });
  }

  function updateAvailableBlocks() {
    const missingTypes = window.PageBuilder.getMissingBlockTypes(state.page?.blocks || []);
    refs.blockTypeSelect.innerHTML = '';
    missingTypes.forEach((type) => {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = window.PageBuilder.BLOCK_LIBRARY[type].label;
      refs.blockTypeSelect.appendChild(option);
    });
    refs.addBlockBtn.disabled = missingTypes.length === 0;
  }

  function reorderBlocks(sourceId, targetId) {
    const sourceIndex = state.page.blocks.findIndex((block) => block.id === sourceId);
    const targetIndex = state.page.blocks.findIndex((block) => block.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;

    const [moved] = state.page.blocks.splice(sourceIndex, 1);
    state.page.blocks.splice(targetIndex, 0, moved);
    state.page.blocks = state.page.blocks.map((block, index) => ({ ...block, position: index }));
    renderBlocksList();
    renderPreview();
  }

  function selectBlock(blockId) {
    state.selectedBlockId = blockId;
    renderBlocksList();
    renderBlockEditor();
  }

  function renderBlocksList() {
    refs.pageBlocksList.innerHTML = '';

    state.page.blocks
      .sort((a, b) => a.position - b.position)
      .forEach((block, index) => {
        const item = document.createElement('article');
        item.className = `page-block-item ${state.selectedBlockId === block.id ? 'is-selected' : ''}`;
        item.draggable = true;
        item.dataset.blockId = block.id;

        item.addEventListener('dragstart', () => {
          state.dragBlockId = block.id;
          item.classList.add('is-dragging');
        });
        item.addEventListener('dragend', () => {
          state.dragBlockId = null;
          item.classList.remove('is-dragging');
        });
        item.addEventListener('dragover', (event) => {
          event.preventDefault();
          item.classList.add('is-over');
        });
        item.addEventListener('dragleave', () => item.classList.remove('is-over'));
        item.addEventListener('drop', (event) => {
          event.preventDefault();
          item.classList.remove('is-over');
          if (state.dragBlockId) reorderBlocks(state.dragBlockId, block.id);
        });

        const head = document.createElement('div');
        head.className = 'page-block-item-head';

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-link text-start text-decoration-none p-0 flex-grow-1';
        button.innerHTML = `<strong>${block.label}</strong><span>${window.PageBuilder.BLOCK_LIBRARY[block.type].label}</span>`;
        button.addEventListener('click', () => selectBlock(block.id));

        const toggle = document.createElement('input');
        toggle.type = 'checkbox';
        toggle.className = 'form-check-input';
        toggle.checked = block.enabled;
        toggle.addEventListener('change', () => {
          block.enabled = toggle.checked;
          renderPreview();
        });

        head.append(button, toggle);

        const actions = document.createElement('div');
        actions.className = 'page-block-item-actions';

        const upBtn = document.createElement('button');
        upBtn.type = 'button';
        upBtn.className = 'btn btn-outline-secondary btn-sm';
        upBtn.textContent = 'Subir';
        upBtn.disabled = index === 0;
        upBtn.addEventListener('click', () => reorderBlocks(block.id, state.page.blocks[index - 1].id));

        const downBtn = document.createElement('button');
        downBtn.type = 'button';
        downBtn.className = 'btn btn-outline-secondary btn-sm';
        downBtn.textContent = 'Descer';
        downBtn.disabled = index === state.page.blocks.length - 1;
        downBtn.addEventListener('click', () => reorderBlocks(block.id, state.page.blocks[index + 1].id));

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn btn-outline-danger btn-sm';
        removeBtn.textContent = 'Remover';
        removeBtn.addEventListener('click', () => {
          state.page.blocks = state.page.blocks.filter((item) => item.id !== block.id);
          if (state.selectedBlockId === block.id) {
            state.selectedBlockId = state.page.blocks[0]?.id || null;
          }
          updateAvailableBlocks();
          renderBlocksList();
          renderBlockEditor();
          renderPreview();
        });

        actions.append(upBtn, downBtn, removeBtn);
        item.append(head, actions);
        refs.pageBlocksList.appendChild(item);
      });

    updateAvailableBlocks();
  }

  function updateSelectedBlockConfig(nextConfig) {
    state.page.blocks = state.page.blocks.map((block) => (
      block.id === state.selectedBlockId
        ? { ...block, config: window.PageBuilder.normalizeBlock({ ...block, config: nextConfig }, 0, getPreviewStore()).config }
        : block
    ));
    renderPreview();
  }

  function addEditorField({ label, type = 'text', value = '', placeholder = '', options = [], checked = false, onInput }) {
    const col = document.createElement('div');
    col.className = type === 'textarea' ? 'col-12' : 'col-12 col-lg-6';

    const fieldLabel = document.createElement('label');
    fieldLabel.className = 'form-label';
    fieldLabel.textContent = label;

    let field;
    if (type === 'textarea') {
      field = document.createElement('textarea');
      field.className = 'form-control';
      field.rows = 4;
      field.value = value;
      field.placeholder = placeholder;
      field.addEventListener('input', () => onInput(field.value));
    } else if (type === 'select') {
      field = document.createElement('select');
      field.className = 'form-select';
      options.forEach((optionItem) => {
        const option = document.createElement('option');
        option.value = optionItem.value;
        option.textContent = optionItem.label;
        option.selected = optionItem.value === value;
        field.appendChild(option);
      });
      field.addEventListener('change', () => onInput(field.value));
    } else if (type === 'switch') {
      col.className = 'col-12 col-lg-6';
      const wrap = document.createElement('div');
      wrap.className = 'form-check form-switch mt-4';
      field = document.createElement('input');
      field.type = 'checkbox';
      field.className = 'form-check-input';
      field.checked = checked;
      field.addEventListener('change', () => onInput(field.checked));
      const switchLabel = document.createElement('label');
      switchLabel.className = 'form-check-label';
      switchLabel.textContent = label;
      wrap.append(field, switchLabel);
      col.appendChild(wrap);
      return col;
    } else {
      field = document.createElement('input');
      field.type = type;
      field.className = 'form-control';
      field.value = value;
      field.placeholder = placeholder;
      field.addEventListener('input', () => onInput(field.value));
    }

    col.append(fieldLabel, field);
    return col;
  }

  function renderBlockEditor() {
    const block = state.page.blocks.find((item) => item.id === state.selectedBlockId) || null;
    refs.blockEditorFields.innerHTML = '';

    if (!block) {
      refs.blockEditorEmpty.classList.remove('d-none');
      refs.blockEditorFields.classList.add('d-none');
      refs.blockEditorTitle.textContent = 'Selecione um bloco';
      refs.blockEditorHint.textContent = 'Use a lista ao lado para editar o conteudo e a configuracao de cada parte da pagina.';
      return;
    }

    refs.blockEditorEmpty.classList.add('d-none');
    refs.blockEditorFields.classList.remove('d-none');
    refs.blockEditorTitle.textContent = block.label;
    refs.blockEditorHint.textContent = window.PageBuilder.BLOCK_LIBRARY[block.type].label;

    const append = (field) => refs.blockEditorFields.appendChild(field);
    append(addEditorField({
      label: 'Nome interno do bloco',
      value: block.label,
      onInput: (value) => {
        block.label = value || window.PageBuilder.BLOCK_LIBRARY[block.type].label;
        renderBlocksList();
      }
    }));

    if (block.type === 'hero') {
      append(addEditorField({ label: 'Kicker', value: block.config.eyebrow, onInput: (value) => updateSelectedBlockConfig({ ...block.config, eyebrow: value }) }));
      append(addEditorField({ label: 'Titulo principal', value: block.config.title, onInput: (value) => updateSelectedBlockConfig({ ...block.config, title: value }) }));
      append(addEditorField({ label: 'Subtitulo', type: 'textarea', value: block.config.subtitle, onInput: (value) => updateSelectedBlockConfig({ ...block.config, subtitle: value }) }));
      append(addEditorField({ label: 'CTA principal', value: block.config.primaryCtaLabel, onInput: (value) => updateSelectedBlockConfig({ ...block.config, primaryCtaLabel: value }) }));
      append(addEditorField({ label: 'Link do CTA principal', value: block.config.primaryCtaHref, onInput: (value) => updateSelectedBlockConfig({ ...block.config, primaryCtaHref: value }) }));
      append(addEditorField({ label: 'CTA secundario', value: block.config.secondaryCtaLabel, onInput: (value) => updateSelectedBlockConfig({ ...block.config, secondaryCtaLabel: value }) }));
      append(addEditorField({ label: 'Link/WhatsApp secundario', value: block.config.secondaryCtaHref, onInput: (value) => updateSelectedBlockConfig({ ...block.config, secondaryCtaHref: value }) }));
      append(addEditorField({ label: 'Imagem de fundo', value: block.config.backgroundImageUrl, onInput: (value) => updateSelectedBlockConfig({ ...block.config, backgroundImageUrl: value }) }));
      append(addEditorField({
        label: 'Pilares de confianca',
        type: 'textarea',
        value: (block.config.trustItems || []).join('\n'),
        placeholder: 'Uma linha por item',
        onInput: (value) => updateSelectedBlockConfig({ ...block.config, trustItems: value.split('\n').map((item) => item.trim()).filter(Boolean) })
      }));
    }

    if (block.type === 'products') {
      append(addEditorField({ label: 'Titulo da lista', value: block.config.title, onInput: (value) => updateSelectedBlockConfig({ ...block.config, title: value }) }));
      append(addEditorField({ label: 'Subtitulo', type: 'textarea', value: block.config.subtitle, onInput: (value) => updateSelectedBlockConfig({ ...block.config, subtitle: value }) }));
      append(addEditorField({ label: 'Limite de produtos', type: 'number', value: String(block.config.limit), onInput: (value) => updateSelectedBlockConfig({ ...block.config, limit: Number(value || 1) }) }));
      append(addEditorField({ label: 'Texto do botao', value: block.config.ctaLabelOverride, onInput: (value) => updateSelectedBlockConfig({ ...block.config, ctaLabelOverride: value }) }));
      append(addEditorField({ label: 'Busca ativa', type: 'switch', checked: block.config.showSearch, onInput: (value) => updateSelectedBlockConfig({ ...block.config, showSearch: value }) }));
      append(addEditorField({ label: 'Filtro por categoria', type: 'switch', checked: block.config.showCategoryFilter, onInput: (value) => updateSelectedBlockConfig({ ...block.config, showCategoryFilter: value }) }));
      append(addEditorField({ label: 'Ordenacao visivel', type: 'switch', checked: block.config.showSort, onInput: (value) => updateSelectedBlockConfig({ ...block.config, showSort: value }) }));
      append(addEditorField({ label: 'Priorizar destaque', type: 'switch', checked: block.config.emphasizeFeatured, onInput: (value) => updateSelectedBlockConfig({ ...block.config, emphasizeFeatured: value }) }));
      append(addEditorField({ label: 'Mostrar prova social', type: 'switch', checked: block.config.showSocialProof, onInput: (value) => updateSelectedBlockConfig({ ...block.config, showSocialProof: value }) }));
    }

    if (block.type === 'cta') {
      append(addEditorField({ label: 'Badge', value: block.config.badge, onInput: (value) => updateSelectedBlockConfig({ ...block.config, badge: value }) }));
      append(addEditorField({ label: 'Titulo', value: block.config.title, onInput: (value) => updateSelectedBlockConfig({ ...block.config, title: value }) }));
      append(addEditorField({ label: 'Descricao', type: 'textarea', value: block.config.description, onInput: (value) => updateSelectedBlockConfig({ ...block.config, description: value }) }));
      append(addEditorField({ label: 'Texto do botao', value: block.config.buttonLabel, onInput: (value) => updateSelectedBlockConfig({ ...block.config, buttonLabel: value }) }));
      append(addEditorField({ label: 'Link do botao', value: block.config.buttonHref, onInput: (value) => updateSelectedBlockConfig({ ...block.config, buttonHref: value }) }));
      append(addEditorField({ label: 'Nota complementar', type: 'textarea', value: block.config.note, onInput: (value) => updateSelectedBlockConfig({ ...block.config, note: value }) }));
    }

    if (block.type === 'testimonials') {
      append(addEditorField({ label: 'Titulo', value: block.config.title, onInput: (value) => updateSelectedBlockConfig({ ...block.config, title: value }) }));
      append(addEditorField({ label: 'Subtitulo', type: 'textarea', value: block.config.subtitle, onInput: (value) => updateSelectedBlockConfig({ ...block.config, subtitle: value }) }));
      append(addEditorField({
        label: 'Depoimentos',
        type: 'textarea',
        value: formatPairs(block.config.items, ['name', 'role', 'quote']),
        placeholder: 'Nome | Cargo | Depoimento',
        onInput: (value) => updateSelectedBlockConfig({ ...block.config, items: parsePairs(value, ['name', 'role', 'quote']) })
      }));
    }

    if (block.type === 'video') {
      append(addEditorField({ label: 'Titulo', value: block.config.title, onInput: (value) => updateSelectedBlockConfig({ ...block.config, title: value }) }));
      append(addEditorField({ label: 'Subtitulo', type: 'textarea', value: block.config.subtitle, onInput: (value) => updateSelectedBlockConfig({ ...block.config, subtitle: value }) }));
      append(addEditorField({ label: 'URL do video', value: block.config.embedUrl, onInput: (value) => updateSelectedBlockConfig({ ...block.config, embedUrl: value }) }));
    }

    if (block.type === 'faq') {
      append(addEditorField({ label: 'Titulo', value: block.config.title, onInput: (value) => updateSelectedBlockConfig({ ...block.config, title: value }) }));
      append(addEditorField({ label: 'Subtitulo', type: 'textarea', value: block.config.subtitle, onInput: (value) => updateSelectedBlockConfig({ ...block.config, subtitle: value }) }));
      append(addEditorField({
        label: 'Perguntas',
        type: 'textarea',
        value: formatPairs(block.config.items, ['question', 'answer']),
        placeholder: 'Pergunta | Resposta',
        onInput: (value) => updateSelectedBlockConfig({ ...block.config, items: parsePairs(value, ['question', 'answer']) })
      }));
    }

    if (block.type === 'footer') {
      append(addEditorField({ label: 'Titulo', value: block.config.title, onInput: (value) => updateSelectedBlockConfig({ ...block.config, title: value }) }));
      append(addEditorField({ label: 'Descricao', type: 'textarea', value: block.config.description, onInput: (value) => updateSelectedBlockConfig({ ...block.config, description: value }) }));
      append(addEditorField({ label: 'Copyright', value: block.config.copyright, onInput: (value) => updateSelectedBlockConfig({ ...block.config, copyright: value }) }));
      append(addEditorField({
        label: 'Links do rodape',
        type: 'textarea',
        value: formatPairs(block.config.links, ['label', 'href']),
        placeholder: 'Label | href',
        onInput: (value) => updateSelectedBlockConfig({ ...block.config, links: parsePairs(value, ['label', 'href']) })
      }));
    }
  }

  function populateBuilderForm(page) {
    refs.pageStatus.value = page.status;
    refs.themePreset.value = page.themeKey;
    refs.builderPrimaryColor.value = page.themeSettings.primaryColor;
    refs.builderSecondaryColor.value = page.themeSettings.secondaryColor;
    refs.builderTextColor.value = page.themeSettings.textColor;
    refs.builderBackgroundColor.value = page.themeSettings.backgroundColor;
    refs.builderSurfaceColor.value = page.themeSettings.surfaceColor;
    refs.builderAccentSoft.value = page.themeSettings.accentSoft;
    refs.builderFontFamily.value = page.themeSettings.fontFamily;
    refs.builderHeadingFamily.value = page.themeSettings.headingFamily;
    refs.builderBorderRadius.value = String(page.themeSettings.borderRadius);
    refs.builderSpacingScale.value = page.themeSettings.spacingScale;
    refs.builderButtonStyle.value = page.themeSettings.buttonStyle;
    refs.builderCardLayout.value = page.themeSettings.cardLayout;
    refs.seoTitle.value = page.seoSettings.title || '';
    refs.seoDescription.value = page.seoSettings.metaDescription || '';
    refs.seoOgImageUrl.value = page.seoSettings.ogImageUrl || '';
    refs.seoFaviconUrl.value = page.seoSettings.faviconUrl || '';
    refs.seoLogoUrl.value = page.seoSettings.logoUrl || '';
    refs.socialProofText.value = page.conversionSettings.socialProofText || '';
    refs.highlightBadgeText.value = page.conversionSettings.highlightBadgeText || '';
    refs.promoBannerEnabled.checked = Boolean(page.conversionSettings.promoBannerEnabled);
    refs.promoBannerText.value = page.conversionSettings.promoBannerText || '';
    refs.promoBannerLink.value = page.conversionSettings.promoBannerLink || '';
    refs.countdownEnabled.checked = Boolean(page.conversionSettings.countdownEnabled);
    refs.countdownLabel.value = page.conversionSettings.countdownLabel || '';
    refs.countdownEndAt.value = page.conversionSettings.countdownEndAt || '';
    refs.whatsappEnabled.checked = Boolean(page.conversionSettings.whatsappEnabled);
    refs.whatsappPhone.value = page.conversionSettings.whatsappPhone || '';
    refs.floatingCtaLabel.value = page.conversionSettings.floatingCtaLabel || '';
    refs.whatsappMessage.value = page.conversionSettings.whatsappMessage || '';
  }

  async function loadProductsPreview(userId) {
    const [productsResult, categoriesResult] = await Promise.all([
      window.db
        .from('produtos')
        .select('id, category_id, titulo, preco, imagem_url, product_url, descricao, is_featured, created_at')
        .eq('profile_id', userId)
        .order('updated_at', { ascending: false })
        .limit(24),
      window.db
        .from('product_categories')
        .select('id, name, slug, sort_order')
        .eq('profile_id', userId)
        .order('sort_order', { ascending: true })
    ]);

    if (productsResult.error) throw productsResult.error;
    if (categoriesResult.error) throw categoriesResult.error;

    const categoryMap = new Map((categoriesResult.data || []).map((category) => [category.id, category]));
    state.products = dedupePreviewProducts((productsResult.data || []).map((product) => {
      const category = categoryMap.get(product.category_id) || {};
      return {
        ...product,
        category_name: category.name || 'Geral',
        category_slug: category.slug || '',
        category_sort_order: category.sort_order || 0
      };
    }));
  }

  async function loadPageBuilder(userId) {
    try {
      const { data: pageRow, error: pageError } = await window.db
        .from('store_pages')
        .select('id, profile_id, status, theme_key, title, description, theme_settings, seo_settings, conversion_settings, page_settings')
        .eq('profile_id', userId)
        .maybeSingle();

      if (pageError) throw pageError;

      let page = pageRow
        ? window.PageBuilder.normalizePageData(pageRow, getPreviewStore())
        : window.PageBuilder.createDefaultPage(getPreviewStore());

      if (pageRow?.id) {
        const { data: blocks, error: blocksError } = await window.db
          .from('store_page_blocks')
          .select('id, page_id, profile_id, block_type, label, is_enabled, position, config')
          .eq('page_id', pageRow.id)
          .order('position', { ascending: true });

        if (blocksError) throw blocksError;
        if (blocks?.length) {
          page = window.PageBuilder.normalizePageData({
            page: pageRow,
            blocks
          }, getPreviewStore());
        }
      }

      state.page = page;
      state.selectedBlockId = state.page.blocks[0]?.id || null;
      populateBuilderForm(state.page);
      renderBlocksList();
      renderBlockEditor();
      renderPreview();
    } catch (error) {
      state.schemaReady = false;
      showStatus('O editor visual depende do schema novo do Supabase. Rode o schema atualizado para habilitar blocos dinamicos, temas e analytics.', 'warning');
      console.error(error);
    }
  }

  async function saveBuilder() {
    if (!state.schemaReady) return;

    hideStatus();
    setSaveLoading(true);

    try {
      state.page = getCurrentPageFromInputs();
      const pagePayload = window.PageBuilder.serializePageForSave(state.page);
      const { data: savedPage, error: pageError } = await window.db
        .from('store_pages')
        .upsert({
          profile_id: state.profile.user_id,
          ...pagePayload
        }, { onConflict: 'profile_id' })
        .select('id, profile_id, status, theme_key, title, description, theme_settings, seo_settings, conversion_settings, page_settings')
        .single();

      if (pageError) throw pageError;

      const { error: deleteError } = await window.db
        .from('store_page_blocks')
        .delete()
        .eq('page_id', savedPage.id);

      if (deleteError) throw deleteError;

      const blocksPayload = window.PageBuilder.serializeBlocksForSave(state.page.blocks, savedPage.id, state.profile.user_id)
        .map((item) => ({
          page_id: item.page_id,
          profile_id: item.profile_id,
          block_type: item.block_type,
          label: item.label,
          is_enabled: item.is_enabled,
          position: item.position,
          config: item.config
        }));

      if (blocksPayload.length) {
        const { error: insertError } = await window.db
          .from('store_page_blocks')
          .insert(blocksPayload);

        if (insertError) throw insertError;
      }

      await loadPageBuilder(state.profile.user_id);
      showStatus('Pagina dinamica salva com sucesso.', 'success');
    } catch (error) {
      showStatus(`Erro ao salvar a pagina: ${error.message}`, 'danger');
    } finally {
      setSaveLoading(false);
    }
  }

  function applyThemePreset(themeKey) {
    const preset = window.PageBuilder.THEME_PRESETS[themeKey];
    if (!preset) return;
    refs.builderPrimaryColor.value = preset.primaryColor;
    refs.builderSecondaryColor.value = preset.secondaryColor;
    refs.builderTextColor.value = preset.textColor;
    refs.builderBackgroundColor.value = preset.backgroundColor;
    refs.builderSurfaceColor.value = preset.surfaceColor;
    refs.builderAccentSoft.value = preset.accentSoft;
    refs.builderFontFamily.value = preset.fontFamily;
    refs.builderHeadingFamily.value = preset.headingFamily;
    refs.builderBorderRadius.value = String(preset.borderRadius);
    refs.builderSpacingScale.value = preset.spacingScale;
    refs.builderButtonStyle.value = preset.buttonStyle;
    refs.builderCardLayout.value = preset.cardLayout;
    renderPreview();
  }

  function bindEvents() {
    refs.saveBuilderBtn.addEventListener('click', saveBuilder);
    refs.addBlockBtn.addEventListener('click', () => {
      const type = refs.blockTypeSelect.value;
      if (!type) return;
      const nextBlock = window.PageBuilder.normalizeBlock({
        type,
        position: state.page.blocks.length,
        config: window.PageBuilder.BLOCK_LIBRARY[type].defaultConfig
      }, state.page.blocks.length, getPreviewStore());
      state.page.blocks.push(nextBlock);
      state.selectedBlockId = nextBlock.id;
      renderBlocksList();
      renderBlockEditor();
      renderPreview();
    });

    refs.themePreset.addEventListener('change', () => applyThemePreset(refs.themePreset.value));

    [
      refs.pageStatus,
      refs.builderPrimaryColor,
      refs.builderSecondaryColor,
      refs.builderTextColor,
      refs.builderBackgroundColor,
      refs.builderSurfaceColor,
      refs.builderAccentSoft,
      refs.builderFontFamily,
      refs.builderHeadingFamily,
      refs.builderBorderRadius,
      refs.builderSpacingScale,
      refs.builderButtonStyle,
      refs.builderCardLayout,
      refs.seoTitle,
      refs.seoDescription,
      refs.seoOgImageUrl,
      refs.seoFaviconUrl,
      refs.seoLogoUrl,
      refs.socialProofText,
      refs.highlightBadgeText,
      refs.promoBannerEnabled,
      refs.promoBannerText,
      refs.promoBannerLink,
      refs.countdownEnabled,
      refs.countdownLabel,
      refs.countdownEndAt,
      refs.whatsappEnabled,
      refs.whatsappPhone,
      refs.floatingCtaLabel,
      refs.whatsappMessage,
      refs.storeName,
      refs.storeSlug,
      refs.headline,
      refs.storeBio,
      refs.storeBannerUrl,
      refs.ctaLabel
    ].forEach((field) => {
      const eventName = field.type === 'checkbox' || field.tagName === 'SELECT' ? 'change' : 'input';
      field?.addEventListener(eventName, renderPreview);
    });
  }

  async function init() {
    if (!refs.saveBuilderBtn || window.AppConfig?.missingConfig || !window.PageBuilder) return;

    try {
      const activation = await window.Auth.ensureActivatedSession('ativacao.html');
      if (!activation) return;

      state.session = activation.session;
      state.profile = activation.profile;
      const allowed = await window.Auth.ensureRoleAccess(state.profile, ['admin', 'advertiser']);
      if (!allowed) return;

      bindEvents();
      await loadProductsPreview(state.profile.user_id);
      await loadPageBuilder(state.profile.user_id);
    } catch (error) {
      showStatus(`Erro ao iniciar o editor da pagina: ${error.message}`, 'danger');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
