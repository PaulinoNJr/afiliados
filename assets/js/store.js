(() => {
  const DEFAULT_ACCENT = '#0d6efd';
  const DEFAULT_CTA = 'Ver produto';

  const state = {
    session: null,
    profile: null,
    isAdmin: false,
    slugCheckNonce: 0
  };

  const refs = {
    userRoleBadge: document.getElementById('userRoleBadge'),
    userEmail: document.getElementById('userEmail'),
    logoutBtn: document.getElementById('logoutBtn'),
    status: document.getElementById('statusMessage'),
    storeProfileForm: document.getElementById('storeProfileForm'),
    saveStoreBtn: document.getElementById('saveStoreBtn'),
    firstName: document.getElementById('firstName'),
    lastName: document.getElementById('lastName'),
    phone: document.getElementById('phone'),
    photoUpload: document.getElementById('photoUpload'),
    photoUploadStatus: document.getElementById('photoUploadStatus'),
    photoUrl: document.getElementById('photoUrl'),
    storeName: document.getElementById('storeName'),
    storeSlug: document.getElementById('storeSlug'),
    storeSlugFeedback: document.getElementById('storeSlugFeedback'),
    headline: document.getElementById('headline'),
    accentColor: document.getElementById('accentColor'),
    ctaLabel: document.getElementById('ctaLabel'),
    storeBio: document.getElementById('storeBio'),
    bannerUpload: document.getElementById('bannerUpload'),
    bannerUploadStatus: document.getElementById('bannerUploadStatus'),
    storeBannerUrl: document.getElementById('storeBannerUrl'),
    photoPreview: document.getElementById('photoPreview'),
    profileNamePreview: document.getElementById('profileNamePreview'),
    profilePhonePreview: document.getElementById('profilePhonePreview'),
    storeBannerPreview: document.getElementById('storeBannerPreview'),
    storePreviewCard: document.getElementById('storePreviewCard'),
    storeNamePreview: document.getElementById('storeNamePreview'),
    headlinePreview: document.getElementById('headlinePreview'),
    storeBioPreview: document.getElementById('storeBioPreview'),
    storePublicUrl: document.getElementById('storePublicUrl'),
    storePublicUrlLink: document.getElementById('storePublicUrlLink'),
    ctaPreviewBtn: document.getElementById('ctaPreviewBtn')
  };

  function showStatus(message, type = 'warning') {
    refs.status.className = `alert alert-${type}`;
    refs.status.textContent = message;
    refs.status.classList.remove('d-none');
  }

  function hideStatus() {
    refs.status.classList.add('d-none');
  }

  function isValidHttpUrl(raw) {
    try {
      const parsed = new URL(raw);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  function normalizeAccentColor(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return DEFAULT_ACCENT;
    return /^#([0-9a-f]{6}|[0-9a-f]{3})$/.test(raw) ? raw : DEFAULT_ACCENT;
  }

  function setStoreSaveLoading(isLoading) {
    refs.saveStoreBtn.disabled = isLoading;
    refs.saveStoreBtn.textContent = isLoading ? 'Salvando...' : 'Salvar alteracoes';
  }

  function setSlugFeedback(message, tone = 'secondary') {
    refs.storeSlugFeedback.className = `d-block mt-2 text-${tone}`;
    refs.storeSlugFeedback.textContent = message;
  }

  function setUploadStatus(element, message, tone = 'secondary') {
    element.className = `d-block mt-2 text-${tone}`;
    element.textContent = message;
  }

  function getFullName() {
    return [refs.firstName.value.trim(), refs.lastName.value.trim()].filter(Boolean).join(' ').trim() || 'Seu nome';
  }

  function applyHeader() {
    refs.userEmail.textContent = state.session.user.email || 'Usuario autenticado';
    refs.userRoleBadge.textContent = state.isAdmin ? 'admin' : 'produtor';
    refs.userRoleBadge.className = state.isAdmin ? 'badge text-bg-primary' : 'badge text-bg-secondary';
  }

  function updatePreview() {
    const slug = window.StoreUtils.normalizeStoreSlug(refs.storeSlug.value);
    const photoUrl = refs.photoUrl.value.trim();
    const bannerUrl = refs.storeBannerUrl.value.trim();
    const publicUrl = slug ? window.StoreUtils.getStoreUrl(slug) : null;
    const accentColor = normalizeAccentColor(refs.accentColor.value);
    const ctaLabel = refs.ctaLabel.value.trim() || DEFAULT_CTA;
    const headline = refs.headline.value.trim();

    refs.profileNamePreview.textContent = getFullName();
    refs.profilePhonePreview.textContent = refs.phone.value.trim() || 'Telefone nao informado';
    refs.storeNamePreview.textContent = refs.storeName.value.trim() || 'Sua loja';
    refs.headlinePreview.textContent = headline || 'Adicione uma headline para destacar sua proposta.';
    refs.storeBioPreview.textContent = refs.storeBio.value.trim() || 'Adicione uma bio para apresentar sua loja.';
    refs.ctaPreviewBtn.textContent = ctaLabel;
    refs.storePreviewCard.style.setProperty('--store-accent-preview', accentColor);
    refs.ctaPreviewBtn.style.backgroundColor = accentColor;
    refs.ctaPreviewBtn.style.borderColor = accentColor;
    refs.storePublicUrlLink.style.color = accentColor;
    refs.storePublicUrlLink.style.borderColor = accentColor;

    if (publicUrl) {
      refs.storePublicUrl.textContent = publicUrl;
      refs.storePublicUrlLink.href = publicUrl;
      refs.storePublicUrlLink.classList.remove('disabled', 'text-secondary');
    } else {
      refs.storePublicUrl.textContent = 'Pagina publica indisponivel.';
      refs.storePublicUrlLink.href = 'index.html';
      refs.storePublicUrlLink.classList.add('text-secondary');
    }

    if (isValidHttpUrl(photoUrl)) {
      refs.photoPreview.src = photoUrl;
      refs.photoPreview.classList.remove('d-none');
      refs.photoPreview.onerror = () => refs.photoPreview.classList.add('d-none');
    } else {
      refs.photoPreview.classList.add('d-none');
    }

    if (isValidHttpUrl(bannerUrl)) {
      refs.storeBannerPreview.src = bannerUrl;
      refs.storeBannerPreview.classList.remove('d-none');
      refs.storeBannerPreview.onerror = () => refs.storeBannerPreview.classList.add('d-none');
    } else {
      refs.storeBannerPreview.classList.add('d-none');
    }
  }

  function populateForm(profile) {
    refs.firstName.value = profile?.first_name || '';
    refs.lastName.value = profile?.last_name || '';
    refs.phone.value = profile?.phone || '';
    refs.photoUrl.value = profile?.photo_url || '';
    refs.storeName.value = profile?.store_name || '';
    refs.storeSlug.value = profile?.slug || '';
    refs.headline.value = profile?.headline || '';
    refs.accentColor.value = normalizeAccentColor(profile?.accent_color || DEFAULT_ACCENT);
    refs.ctaLabel.value = profile?.cta_label || DEFAULT_CTA;
    refs.storeBio.value = profile?.bio || '';
    refs.storeBannerUrl.value = profile?.banner_url || '';
    setUploadStatus(refs.photoUploadStatus, 'Envie JPG, PNG, WEBP ou GIF com ate 5 MB.', 'secondary');
    setUploadStatus(refs.bannerUploadStatus, 'Tamanho recomendado do banner: 1600 x 400 px. Use imagem horizontal para melhor encaixe. Envie JPG, PNG, WEBP ou GIF com ate 5 MB.', 'secondary');
    updatePreview();
  }

  async function validateSlugAvailability({ silent = false } = {}) {
    const validation = window.StoreUtils.validateStoreSlug(refs.storeSlug.value);
    refs.storeSlug.value = validation.slug;
    updatePreview();

    if (!validation.ok) {
      setSlugFeedback(validation.message, 'danger');
      return { ok: false, slug: validation.slug };
    }

    const nonce = ++state.slugCheckNonce;
    setSlugFeedback('Verificando disponibilidade...', 'secondary');

    try {
      const availability = await window.StoreUtils.checkSlugAvailability(validation.slug, state.session.user.id);
      if (nonce !== state.slugCheckNonce) return { ok: false, stale: true, slug: validation.slug };

      if (!availability.available) {
        setSlugFeedback(availability.reason, 'danger');
        if (!silent) showStatus(availability.reason, 'warning');
        return { ok: false, slug: availability.slug };
      }

      setSlugFeedback(availability.reason, 'success');
      return { ok: true, slug: availability.slug };
    } catch (err) {
      setSlugFeedback(`Nao foi possivel validar o slug: ${err.message}`, 'danger');
      if (!silent) showStatus(`Erro ao validar slug: ${err.message}`, 'danger');
      return { ok: false, slug: validation.slug };
    }
  }

  async function handleAssetUpload(file, assetType) {
    if (!file) return null;

    const statusRef = assetType === 'banner' ? refs.bannerUploadStatus : refs.photoUploadStatus;
    const urlRef = assetType === 'banner' ? refs.storeBannerUrl : refs.photoUrl;
    const label = assetType === 'banner' ? 'banner' : 'foto';

    setUploadStatus(statusRef, `Enviando ${label}...`, 'secondary');

    try {
      const upload = await window.StoreUtils.uploadStoreAsset(file, {
        userId: state.session.user.id,
        assetType
      });

      if (!upload?.publicUrl) {
        throw new Error('Nao foi possivel obter a URL publica da imagem.');
      }

      urlRef.value = upload.publicUrl;
      setUploadStatus(statusRef, `${label.charAt(0).toUpperCase() + label.slice(1)} enviada com sucesso.`, 'success');
      updatePreview();
      return upload.publicUrl;
    } catch (err) {
      setUploadStatus(statusRef, `Erro no upload da ${label}: ${err.message}`, 'danger');
      throw err;
    }
  }

  async function saveStoreProfile(event) {
    event.preventDefault();
    hideStatus();

    const firstName = refs.firstName.value.trim();
    const lastName = refs.lastName.value.trim();
    const phone = refs.phone.value.trim();
    const photoUrl = refs.photoUrl.value.trim();
    const storeName = refs.storeName.value.trim();
    const headline = refs.headline.value.trim();
    const accentColor = normalizeAccentColor(refs.accentColor.value);
    const ctaLabel = refs.ctaLabel.value.trim() || DEFAULT_CTA;
    const bio = refs.storeBio.value.trim();
    const bannerUrl = refs.storeBannerUrl.value.trim();

    if (!firstName) {
      showStatus('Informe seu nome.', 'warning');
      return;
    }

    if (!storeName) {
      showStatus('Informe o nome da loja.', 'warning');
      return;
    }

    if (photoUrl && !isValidHttpUrl(photoUrl)) {
      showStatus('Informe uma URL valida para a foto ou deixe o campo vazio.', 'warning');
      return;
    }

    if (bannerUrl && !isValidHttpUrl(bannerUrl)) {
      showStatus('Informe uma URL valida para o banner ou deixe o campo vazio.', 'warning');
      return;
    }

    const slugResult = await validateSlugAvailability();
    if (!slugResult.ok) return;

    setStoreSaveLoading(true);

    try {
      const { data, error } = await window.db
        .from('user_profiles')
        .update({
          first_name: firstName,
          last_name: lastName || null,
          phone: phone || null,
          photo_url: photoUrl || null,
          store_name: storeName,
          slug: slugResult.slug,
          headline: headline || null,
          accent_color: accentColor,
          cta_label: ctaLabel,
          bio: bio || null,
          banner_url: bannerUrl || null
        })
        .eq('user_id', state.session.user.id)
        .select('user_id, user_email, role, first_name, last_name, phone, photo_url, store_name, slug, headline, accent_color, cta_label, bio, banner_url, created_at, updated_at')
        .single();

      if (error) throw error;

      state.profile = data;
      populateForm(state.profile);
      showStatus('Dados da loja atualizados com sucesso.', 'success');
    } catch (err) {
      showStatus(`Erro ao salvar loja: ${err.message}`, 'danger');
    } finally {
      setStoreSaveLoading(false);
    }
  }

  function bindEvents() {
    [refs.firstName, refs.lastName, refs.phone, refs.photoUrl, refs.storeName, refs.storeSlug, refs.headline, refs.accentColor, refs.ctaLabel, refs.storeBio, refs.storeBannerUrl]
      .forEach((field) => field.addEventListener('input', updatePreview));

    refs.phone.addEventListener('input', () => {
      refs.phone.value = window.StoreUtils.formatPhone(refs.phone.value);
      updatePreview();
    });

    refs.storeSlug.addEventListener('input', () => {
      refs.storeSlug.value = window.StoreUtils.normalizeStoreSlug(refs.storeSlug.value);
      const validation = window.StoreUtils.validateStoreSlug(refs.storeSlug.value);
      setSlugFeedback(validation.message, validation.ok ? 'secondary' : 'danger');
      updatePreview();
    });

    refs.storeSlug.addEventListener('blur', async () => {
      if (!refs.storeSlug.value.trim()) return;
      await validateSlugAvailability({ silent: true });
    });

    refs.photoUpload.addEventListener('change', async () => {
      if (!refs.photoUpload.files?.length) return;
      try {
        await handleAssetUpload(refs.photoUpload.files[0], 'photo');
      } catch {}
    });

    refs.bannerUpload.addEventListener('change', async () => {
      if (!refs.bannerUpload.files?.length) return;
      try {
        await handleAssetUpload(refs.bannerUpload.files[0], 'banner');
      } catch {}
    });

    refs.storeProfileForm.addEventListener('submit', saveStoreProfile);
  }

  async function init() {
    if (window.AppConfig?.missingConfig) {
      showStatus('Configure SUPABASE_URL e SUPABASE_ANON_KEY em assets/js/config.js.', 'warning');
      return;
    }

    try {
      state.session = await window.Auth.requireAuth('login.html');
      if (!state.session) return;

      state.profile = await window.Auth.getProfile();
      state.isAdmin = state.profile?.role === 'admin';
      applyHeader();
      populateForm(state.profile);
      bindEvents();

      refs.logoutBtn.addEventListener('click', async () => {
        await window.Auth.logout();
        window.location.href = 'login.html';
      });
    } catch (err) {
      showStatus(`Erro ao iniciar a pagina da loja: ${err.message}`, 'danger');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
