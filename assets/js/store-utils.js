(() => {
  const RESERVED_SLUGS = ['login', 'dashboard', 'admin', 'api', 'users'];

  function normalizeStoreSlug(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function isReservedSlug(value) {
    return RESERVED_SLUGS.includes(normalizeStoreSlug(value));
  }

  function validateStoreSlug(value) {
    const slug = normalizeStoreSlug(value);

    if (!slug) {
      return {
        ok: false,
        slug,
        message: 'Informe um slug válido.'
      };
    }

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return {
        ok: false,
        slug,
        message: 'Use apenas letras, números e hífens.'
      };
    }

    if (isReservedSlug(slug)) {
      return {
        ok: false,
        slug,
        message: 'Esse slug é reservado pelo sistema.'
      };
    }

    return {
      ok: true,
      slug,
      message: 'Slug válido.'
    };
  }

  function getStoreSlugFromPath(pathname = window.location.pathname) {
    const cleaned = String(pathname || '')
      .replace(/^\/+|\/+$/g, '')
      .trim();

    if (!cleaned || cleaned === 'index.html') return null;
    if (cleaned.includes('/')) return null;
    if (cleaned.includes('.')) return null;
    if (isReservedSlug(cleaned)) return null;

    const slug = normalizeStoreSlug(cleaned);
    return slug || null;
  }

  function getStoreUrl(slug) {
    const normalized = normalizeStoreSlug(slug);
    return normalized ? `${window.location.origin}/${normalized}` : `${window.location.origin}/`;
  }

  async function checkSlugAvailability(slug, currentProfileId = null) {
    if (!window.db) {
      throw new Error('Supabase não configurado.');
    }

    const validation = validateStoreSlug(slug);
    if (!validation.ok) {
      return {
        available: false,
        slug: validation.slug,
        reason: validation.message,
        validation
      };
    }

    const { data, error } = await window.db
      .from('public_store_profiles')
      .select('id, slug')
      .eq('slug', validation.slug)
      .maybeSingle();

    if (error) throw error;

    const available = !data || data.id === currentProfileId;
    return {
      available,
      slug: validation.slug,
      reason: available ? 'Slug disponível.' : 'Esse slug já está em uso.',
      validation
    };
  }

  async function extractProductFromUrl(url) {
    const rawUrl = String(url || '').trim();

    if (!rawUrl) {
      throw new Error('Informe uma URL para extrair o produto.');
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      throw new Error('Informe uma URL válida.');
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('A URL precisa começar com http:// ou https://.');
    }

    const response = await fetch(`/api/preview?url=${encodeURIComponent(parsedUrl.toString())}`);
    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || 'Não foi possível extrair dados do produto.');
    }

    const data = payload.data || {};

    return {
      title: data.title || null,
      image: data.image || null,
      price: typeof data.price === 'number' ? data.price : null,
      description: data.description || null,
      metadata: data
      // TODO: trocar a origem quando existir scraping dedicado por marketplace.
    };
  }

  window.StoreUtils = {
    RESERVED_SLUGS,
    normalizeStoreSlug,
    validateStoreSlug,
    isReservedSlug,
    getStoreSlugFromPath,
    getStoreUrl,
    checkSlugAvailability,
    extractProductFromUrl
  };
})();
