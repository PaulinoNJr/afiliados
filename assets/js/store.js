(() => {
  const DEFAULT_ACCENT = '#0d6efd';
  const DEFAULT_TEXT = '#152238';
  const DEFAULT_PAGE_BACKGROUND = '#f3f6fb';
  const DEFAULT_BUTTON_TEXT = '#ffffff';
  const DEFAULT_BUTTON_STYLE = 'solid';
  const DEFAULT_CARD_STYLE = 'soft';
  const DEFAULT_CTA = 'Ver produto';
  const SLUG_CHANGE_WINDOW_DAYS = 7;

  const state = {
    session: null,
    profile: null,
    isAdmin: false,
    slugCheckNonce: 0,
    slugCheckedValue: '',
    slugAvailable: false,
    originalSlug: ''
  };

  const refs = {
    userRoleBadge: document.getElementById('userRoleBadge'),
    userEmail: document.getElementById('userEmail'),
    logoutBtn: document.getElementById('logoutBtn'),
    status: document.getElementById('statusMessage'),
    storeProfileForm: document.getElementById('storeProfileForm'),
    saveStoreBtn: document.getElementById('saveStoreBtn'),
    headerStorePublicLink: document.getElementById('headerStorePublicLink'),
    storeName: document.getElementById('storeName'),
    storeSlug: document.getElementById('storeSlug'),
    checkSlugBtn: document.getElementById('checkSlugBtn'),
    storeSlugFeedback: document.getElementById('storeSlugFeedback'),
    storeSlugSchedule: document.getElementById('storeSlugSchedule'),
    headline: document.getElementById('headline'),
    accentColor: document.getElementById('accentColor'),
    textColor: document.getElementById('textColor'),
    pageBackground: document.getElementById('pageBackground'),
    buttonTextColor: document.getElementById('buttonTextColor'),
    buttonStyle: document.getElementById('buttonStyle'),
    cardStyle: document.getElementById('cardStyle'),
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

  function normalizeHexColor(value, fallback) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return fallback;
    return /^#([0-9a-f]{6}|[0-9a-f]{3})$/.test(raw) ? raw : fallback;
  }

  function normalizeButtonStyle(value) {
    const raw = String(value || '').trim().toLowerCase();
    return ['solid', 'outline', 'pill'].includes(raw) ? raw : DEFAULT_BUTTON_STYLE;
  }

  function normalizeCardStyle(value) {
    const raw = String(value || '').trim().toLowerCase();
    return ['soft', 'outline', 'glass'].includes(raw) ? raw : DEFAULT_CARD_STYLE;
  }

  function formatDateTime(date) {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(date);
  }

  function getSlugLockedUntil(profile = state.profile) {
    const changedAt = profile?.slug_changed_at ? new Date(profile.slug_changed_at) : null;
    if (!changedAt || Number.isNaN(changedAt.getTime())) return null;

    const nextChange = new Date(changedAt.getTime());
    nextChange.setDate(nextChange.getDate() + SLUG_CHANGE_WINDOW_DAYS);
    return nextChange;
  }

  function canChangeSlug(profile = state.profile) {
    const lockedUntil = getSlugLockedUntil(profile);
    return !lockedUntil || lockedUntil.getTime() <= Date.now();
  }

  function updateSlugScheduleMessage() {
    const currentSlug = window.StoreUtils.normalizeStoreSlug(refs.storeSlug.value);
    const changed = Boolean(currentSlug && currentSlug !== state.originalSlug);
    const lockedUntil = getSlugLockedUntil();

    if (!lockedUntil) {
      refs.storeSlugSchedule.textContent = 'Verifique o slug antes de salvar. Se você trocar agora, outra alteração só será liberada daqui a 7 dias.';
      refs.storeSlugSchedule.className = 'd-block mt-2 text-secondary';
      return;
    }

    if (canChangeSlug()) {
      refs.storeSlugSchedule.textContent = changed
        ? 'Slug pronto para troca. Depois de salvar, uma nova alteracao ficara bloqueada por 7 dias.'
        : 'Você pode trocar o slug agora, mas essa alteração só será permitida novamente após 7 dias.';
      refs.storeSlugSchedule.className = 'd-block mt-2 text-secondary';
      return;
    }

    refs.storeSlugSchedule.textContent = `Troca de slug bloqueada ate ${formatDateTime(lockedUntil)}.`;
    refs.storeSlugSchedule.className = 'd-block mt-2 text-danger';
  }

  function setStoreSaveLoading(isLoading) {
    refs.saveStoreBtn.disabled = isLoading;
    refs.saveStoreBtn.textContent = isLoading ? 'Salvando...' : 'Salvar alterações';
  }

  function setSlugCheckLoading(isLoading) {
    refs.checkSlugBtn.disabled = isLoading;
    refs.checkSlugBtn.textContent = isLoading ? 'Verificando...' : 'Checar disponibilidade';
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
    return [state.profile?.first_name, state.profile?.last_name].filter(Boolean).join(' ').trim() || 'Seu nome';
  }

  function getCurrentStoreTheme() {
    return {
      accentColor: normalizeHexColor(refs.accentColor.value, DEFAULT_ACCENT),
      textColor: normalizeHexColor(refs.textColor.value, DEFAULT_TEXT),
      pageBackground: normalizeHexColor(refs.pageBackground.value, DEFAULT_PAGE_BACKGROUND),
      buttonTextColor: normalizeHexColor(refs.buttonTextColor.value, DEFAULT_BUTTON_TEXT),
      buttonStyle: normalizeButtonStyle(refs.buttonStyle.value),
      cardStyle: normalizeCardStyle(refs.cardStyle.value),
      ctaLabel: refs.ctaLabel.value.trim() || DEFAULT_CTA
    };
  }

  function applyHeader() {
    const email = state.session.user.email || 'Usuário autenticado';
    refs.userEmail.textContent = email;
    refs.userRoleBadge.textContent = window.Auth.getRoleLabel(state.profile?.role);
    refs.userRoleBadge.className = state.isAdmin ? 'badge text-bg-primary' : 'badge text-bg-secondary';
    window.Auth.applyProfileAccess(state.profile);
  }

  function applyPreviewTheme() {
    const theme = getCurrentStoreTheme();

    refs.storePreviewCard.style.setProperty('--store-accent-preview', theme.accentColor);
    refs.storePreviewCard.style.setProperty('--store-text-preview', theme.textColor);
    refs.storePreviewCard.style.setProperty('--store-surface-preview', theme.pageBackground);
    refs.storePreviewCard.style.setProperty('--store-button-text-preview', theme.buttonTextColor);
    refs.storePreviewCard.dataset.cardStyle = theme.cardStyle;

    refs.ctaPreviewBtn.dataset.buttonStyle = theme.buttonStyle;
    refs.ctaPreviewBtn.style.backgroundColor = theme.buttonStyle === 'outline' ? 'transparent' : theme.accentColor;
    refs.ctaPreviewBtn.style.borderColor = theme.accentColor;
    refs.ctaPreviewBtn.style.color = theme.buttonStyle === 'outline' ? theme.accentColor : theme.buttonTextColor;

    refs.storePublicUrlLink.style.color = theme.accentColor;
    refs.storePublicUrlLink.style.borderColor = theme.accentColor;
  }

  function invalidateSlugCheck() {
    state.slugCheckedValue = '';
    state.slugAvailable = false;
  }

  function updatePreview() {
    const slug = window.StoreUtils.normalizeStoreSlug(refs.storeSlug.value);
    const photoUrl = String(state.profile?.photo_url || '').trim();
    const bannerUrl = refs.storeBannerUrl.value.trim();
    const publicUrl = slug ? window.StoreUtils.getStoreUrl(slug) : null;
    const headline = refs.headline.value.trim();
    const bio = refs.storeBio.value.trim();
    const theme = getCurrentStoreTheme();

    refs.profileNamePreview.textContent = getFullName();
    refs.profilePhonePreview.textContent = String(state.profile?.phone || '').trim() || 'Telefone não informado';
    refs.storeNamePreview.textContent = refs.storeName.value.trim() || 'Sua loja';
    refs.headlinePreview.textContent = headline || 'Adicione uma headline para destacar sua proposta.';
    refs.storeBioPreview.textContent = bio || 'Adicione uma bio para apresentar sua loja.';
    refs.ctaPreviewBtn.textContent = theme.ctaLabel;

    applyPreviewTheme();

    if (publicUrl) {
      refs.storePublicUrl.textContent = publicUrl;
      refs.storePublicUrlLink.href = publicUrl;
      refs.headerStorePublicLink.href = publicUrl;
      refs.storePublicUrlLink.classList.remove('disabled', 'text-secondary');
      refs.headerStorePublicLink.classList.remove('disabled');
    } else {
      refs.storePublicUrl.textContent = 'Página pública indisponível.';
      refs.storePublicUrlLink.href = 'index.html';
      refs.headerStorePublicLink.href = 'index.html';
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

    updateSlugScheduleMessage();
  }

  function populateForm(profile) {
    refs.storeName.value = profile?.store_name || '';
    refs.storeSlug.value = profile?.slug || '';
    refs.headline.value = profile?.headline || '';
    refs.accentColor.value = normalizeHexColor(profile?.accent_color, DEFAULT_ACCENT);
    refs.textColor.value = normalizeHexColor(profile?.text_color, DEFAULT_TEXT);
    refs.pageBackground.value = normalizeHexColor(profile?.page_background, DEFAULT_PAGE_BACKGROUND);
    refs.buttonTextColor.value = normalizeHexColor(profile?.button_text_color, DEFAULT_BUTTON_TEXT);
    refs.buttonStyle.value = normalizeButtonStyle(profile?.button_style);
    refs.cardStyle.value = normalizeCardStyle(profile?.card_style);
    refs.ctaLabel.value = profile?.cta_label || DEFAULT_CTA;
    refs.storeBio.value = profile?.bio || '';
    refs.storeBannerUrl.value = profile?.banner_url || '';

    state.originalSlug = window.StoreUtils.normalizeStoreSlug(profile?.slug || '');
    state.slugCheckedValue = state.originalSlug;
    state.slugAvailable = true;

    setUploadStatus(refs.bannerUploadStatus, 'Tamanho recomendado do banner: 1600 x 400 px. Use imagem horizontal para melhor encaixe. Envie JPG, PNG, WEBP ou GIF com ate 5 MB.', 'secondary');
    setSlugFeedback(state.originalSlug ? 'Slug atual da sua loja.' : 'Use letras minúsculas, números e hifens.', state.originalSlug ? 'success' : 'secondary');
    updatePreview();
  }

  async function validateSlugAvailability({ silent = false, forceCheck = false } = {}) {
    const validation = window.StoreUtils.validateStoreSlug(refs.storeSlug.value);
    refs.storeSlug.value = validation.slug;
    updatePreview();

    if (!validation.ok) {
      invalidateSlugCheck();
      setSlugFeedback(validation.message, 'danger');
      return { ok: false, slug: validation.slug };
    }

    const hasChanged = validation.slug !== state.originalSlug;
    if (!hasChanged) {
      state.slugCheckedValue = validation.slug;
      state.slugAvailable = true;
      setSlugFeedback('Este e o slug atual da sua loja.', 'success');
      return { ok: true, slug: validation.slug, unchanged: true };
    }

    if (!canChangeSlug()) {
      const lockedUntil = getSlugLockedUntil();
      const message = lockedUntil
        ? `O slug só pode ser alterado novamente em ${formatDateTime(lockedUntil)}.`
        : 'O slug só pode ser alterado uma vez a cada 7 dias.';
      invalidateSlugCheck();
      setSlugFeedback(message, 'danger');
      if (!silent) showStatus(message, 'warning');
      return { ok: false, slug: validation.slug };
    }

    if (!forceCheck && state.slugCheckedValue === validation.slug && state.slugAvailable) {
      setSlugFeedback('Slug disponível para uso.', 'success');
      return { ok: true, slug: validation.slug };
    }

    const nonce = ++state.slugCheckNonce;
    setSlugCheckLoading(true);
    setSlugFeedback('Verificando disponibilidade...', 'secondary');

    try {
      const availability = await window.StoreUtils.checkSlugAvailability(validation.slug, state.session.user.id);
      if (nonce !== state.slugCheckNonce) return { ok: false, stale: true, slug: validation.slug };

      state.slugCheckedValue = validation.slug;
      state.slugAvailable = Boolean(availability.available);

      if (!availability.available) {
        setSlugFeedback(availability.reason, 'danger');
        if (!silent) showStatus(availability.reason, 'warning');
        return { ok: false, slug: availability.slug };
      }

      setSlugFeedback(availability.reason, 'success');
      return { ok: true, slug: availability.slug };
    } catch (err) {
      invalidateSlugCheck();
      setSlugFeedback(`Não foi possóvel validar o slug: ${err.message}`, 'danger');
      if (!silent) showStatus(`Erro ao validar slug: ${err.message}`, 'danger');
      return { ok: false, slug: validation.slug };
    } finally {
      setSlugCheckLoading(false);
    }
  }

  async function handleAssetUpload(file, assetType) {
    if (!file) return null;

    const statusRef = refs.bannerUploadStatus;
    const urlRef = refs.storeBannerUrl;
    const label = 'banner';

    setUploadStatus(statusRef, `Enviando ${label}...`, 'secondary');

    try {
      const upload = await window.StoreUtils.uploadStoreAsset(file, {
        userId: state.session.user.id,
        assetType
      });

      if (!upload?.publicUrl) {
        throw new Error('Não foi possível obter a URL pública da imagem.');
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

    const storeName = refs.storeName.value.trim();
    const headline = refs.headline.value.trim();
    const bio = refs.storeBio.value.trim();
    const bannerUrl = refs.storeBannerUrl.value.trim();
    const theme = getCurrentStoreTheme();
    const requestedSlug = window.StoreUtils.normalizeStoreSlug(refs.storeSlug.value);

    if (!storeName) {
      showStatus('Informe o nome da loja.', 'warning');
      return;
    }

    if (bannerUrl && !isValidHttpUrl(bannerUrl)) {
      showStatus('Informe uma URL valida para o banner ou deixe o campo vazio.', 'warning');
      return;
    }

    if (requestedSlug !== state.originalSlug && (!state.slugAvailable || state.slugCheckedValue !== requestedSlug)) {
      showStatus('Cheque a disponibilidade do novo slug antes de salvar.', 'warning');
      setSlugFeedback('Cheque a disponibilidade antes de salvar.', 'danger');
      return;
    }

    const slugResult = await validateSlugAvailability();
    if (!slugResult.ok) return;

    setStoreSaveLoading(true);

    try {
      const { data, error } = await window.db
        .from('user_profiles')
        .update({
          store_name: storeName,
          slug: slugResult.slug,
          headline: headline || null,
          accent_color: theme.accentColor,
          text_color: theme.textColor,
          page_background: theme.pageBackground,
          button_text_color: theme.buttonTextColor,
          button_style: theme.buttonStyle,
          card_style: theme.cardStyle,
          cta_label: theme.ctaLabel,
          bio: bio || null,
          banner_url: bannerUrl || null
        })
        .eq('user_id', state.session.user.id)
        .select('user_id, user_email, role, first_name, last_name, phone, photo_url, store_name, slug, slug_changed_at, headline, accent_color, text_color, page_background, button_text_color, button_style, card_style, cta_label, bio, banner_url, created_at, updated_at')
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
    [
      refs.storeName,
      refs.storeSlug,
      refs.headline,
      refs.accentColor,
      refs.textColor,
      refs.pageBackground,
      refs.buttonTextColor,
      refs.buttonStyle,
      refs.cardStyle,
      refs.ctaLabel,
      refs.storeBio,
      refs.storeBannerUrl
    ].forEach((field) => field.addEventListener('input', updatePreview));

    refs.storeSlug.addEventListener('input', () => {
      refs.storeSlug.value = window.StoreUtils.normalizeStoreSlug(refs.storeSlug.value);
      invalidateSlugCheck();
      const validation = window.StoreUtils.validateStoreSlug(refs.storeSlug.value);
      setSlugFeedback(validation.message, validation.ok ? 'secondary' : 'danger');
      updatePreview();
    });

    refs.checkSlugBtn.addEventListener('click', async () => {
      hideStatus();
      await validateSlugAvailability({ silent: false, forceCheck: true });
    });

    refs.bannerUpload.addEventListener('change', async () => {
      if (!refs.bannerUpload.filesó.length) return;
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
      const activation = await window.Auth.ensureActivatedSession('ativacao.html');
      if (!activation) return;

      state.session = activation.session;
      state.profile = activation.profile;
      const allowed = await window.Auth.ensureRoleAccess(state.profile, ['admin', 'advertiser']);
      if (!allowed) return;
      state.isAdmin = window.Auth.normalizeRole(state.profile?.role) === 'admin';
      applyHeader();
      populateForm(state.profile);
      bindEvents();

      refs.logoutBtn.addEventListener('click', async () => {
        await window.Auth.logout();
        window.location.href = 'login.html';
      });
    } catch (err) {
      showStatus(`Erro ao iniciar a página da loja: ${err.message}`, 'danger');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
