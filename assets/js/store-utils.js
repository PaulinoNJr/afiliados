(() => {
  const RESERVED_SLUGS = ['login', 'dashboard', 'admin', 'api', 'users', 'cadastro', 'ativacao', 'recuperar-senha', 'loja', 'produtos', 'campanhas', 'links', 'comissoes', 'r'];

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
    const cleaned = String(pathname || '').trim();
    const segments = cleaned
      .split('/')
      .map((segment) => String(segment || '').trim())
      .filter(Boolean);

    if (!segments.length) return null;

    const candidate = segments.find((segment) => {
      if (!segment) return false;
      if (segment === 'index.html') return false;
      if (segment.includes('.')) return false;
      if (isReservedSlug(segment)) return false;
      return true;
    });

    if (!candidate) return null;

    const slug = normalizeStoreSlug(candidate);
    return slug || null;
  }

  function getStoreUrl(slug) {
    const normalized = normalizeStoreSlug(slug);
    return normalized ? `${window.location.origin}/${normalized}` : `${window.location.origin}/`;
  }

  function getTrackingUrl(code) {
    const normalized = String(code || '').trim().toLowerCase();
    return normalized ? `${window.location.origin}/r/${normalized}` : `${window.location.origin}/r/`;
  }

  function validatePasswordRules(password) {
    const value = String(password || '');
    const rules = {
      minLength: value.length >= 8,
      lowercase: /[a-z]/.test(value),
      uppercase: /[A-Z]/.test(value),
      number: /\d/.test(value),
      special: /[!@#$%^&*()_\+\-=\[\]{};':"\\|<>?,./`~]/.test(value)
    };

    return {
      rules,
      ok: Object.values(rules).every(Boolean)
    };
  }

  function formatPhone(value) {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 11);

    if (!digits) return '';
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 3) return `(${digits.slice(0, 2)})${digits.slice(2)}`;
    if (digits.length <= 7) return `(${digits.slice(0, 2)})${digits.slice(2, 3)}.${digits.slice(3)}`;

    return `(${digits.slice(0, 2)})${digits.slice(2, 3)}.${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  function sanitizeFileName(fileName) {
    const normalized = String(fileName || 'arquivo')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-+|-+$/g, '');

    return normalized || 'arquivo';
  }

  async function uploadStoreAsset(file, { userId, assetType = 'asset' } = {}) {
    if (!window.db) {
      throw new Error('Supabase não configurado.');
    }

    if (!(file instanceof File)) {
      throw new Error('Selecione um arquivo valido.');
    }

    if (!userId) {
      throw new Error('Usuário não identificado para upload.');
    }

    if (!String(file.type || '').startsWith('image/')) {
      throw new Error('Envie apenas imagens para a loja.');
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error('A imagem deve ter no maximo 5 MB.');
    }

    const safeType = normalizeStoreSlug(assetType) || 'asset';
    const safeName = sanitizeFileName(file.name);
    const path = `${userId}/${safeType}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await window.db.storage
      .from('store-assets')
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { data } = window.db.storage.from('store-assets').getPublicUrl(path);

    return {
      path,
      publicUrl: data?.publicUrl || null
    };
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
      .rpc('check_public_slug_availability', {
        store_slug: validation.slug,
        current_profile_id: currentProfileId
      });

    if (error) throw error;

    const row = Array.isArray(data) ? (data[0] || null) : (data || null);
    const available = Boolean(row?.available);
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
    getTrackingUrl,
    formatPhone,
    validatePasswordRules,
    checkSlugAvailability,
    uploadStoreAsset,
    extractProductFromUrl
  };
})();
