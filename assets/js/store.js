(() => {
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
    photoUrl: document.getElementById('photoUrl'),
    storeName: document.getElementById('storeName'),
    storeSlug: document.getElementById('storeSlug'),
    storeSlugFeedback: document.getElementById('storeSlugFeedback'),
    storeBio: document.getElementById('storeBio'),
    storeBannerUrl: document.getElementById('storeBannerUrl'),
    photoPreview: document.getElementById('photoPreview'),
    profileNamePreview: document.getElementById('profileNamePreview'),
    profilePhonePreview: document.getElementById('profilePhonePreview'),
    storeBannerPreview: document.getElementById('storeBannerPreview'),
    storeNamePreview: document.getElementById('storeNamePreview'),
    storeBioPreview: document.getElementById('storeBioPreview'),
    storePublicUrl: document.getElementById('storePublicUrl'),
    storePublicUrlLink: document.getElementById('storePublicUrlLink')
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

  function setStoreSaveLoading(isLoading) {
    refs.saveStoreBtn.disabled = isLoading;
    refs.saveStoreBtn.textContent = isLoading ? 'Salvando...' : 'Salvar alterações';
  }

  function setSlugFeedback(message, tone = 'secondary') {
    refs.storeSlugFeedback.className = `d-block mt-2 text-${tone}`;
    refs.storeSlugFeedback.textContent = message;
  }

  function getFullName() {
    return [refs.firstName.value.trim(), refs.lastName.value.trim()].filter(Boolean).join(' ').trim() || 'Seu nome';
  }

  function applyHeader() {
    refs.userEmail.textContent = state.session.user.email || 'Usuário autenticado';
    refs.userRoleBadge.textContent = state.isAdmin ? 'admin' : 'produtor';
    refs.userRoleBadge.className = state.isAdmin ? 'badge text-bg-primary' : 'badge text-bg-secondary';
  }

  function updatePreview() {
    const slug = window.StoreUtils.normalizeStoreSlug(refs.storeSlug.value);
    const photoUrl = refs.photoUrl.value.trim();
    const bannerUrl = refs.storeBannerUrl.value.trim();
    const publicUrl = slug ? window.StoreUtils.getStoreUrl(slug) : null;

    refs.profileNamePreview.textContent = getFullName();
    refs.profilePhonePreview.textContent = refs.phone.value.trim() || 'Telefone não informado';
    refs.storeNamePreview.textContent = refs.storeName.value.trim() || 'Sua loja';
    refs.storeBioPreview.textContent = refs.storeBio.value.trim() || 'Adicione uma bio para apresentar sua loja.';

    if (publicUrl) {
      refs.storePublicUrl.textContent = publicUrl;
      refs.storePublicUrlLink.href = publicUrl;
      refs.storePublicUrlLink.classList.remove('disabled', 'text-secondary');
    } else {
      refs.storePublicUrl.textContent = 'Página pública indisponível.';
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
    refs.storeBio.value = profile?.bio || '';
    refs.storeBannerUrl.value = profile?.banner_url || '';
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
      setSlugFeedback(`Não foi possível validar o slug: ${err.message}`, 'danger');
      if (!silent) showStatus(`Erro ao validar slug: ${err.message}`, 'danger');
      return { ok: false, slug: validation.slug };
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
      showStatus('Informe uma URL válida para a foto ou deixe o campo vazio.', 'warning');
      return;
    }

    if (bannerUrl && !isValidHttpUrl(bannerUrl)) {
      showStatus('Informe uma URL válida para o banner ou deixe o campo vazio.', 'warning');
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
          bio: bio || null,
          banner_url: bannerUrl || null
        })
        .eq('user_id', state.session.user.id)
        .select('user_id, user_email, role, first_name, last_name, phone, photo_url, store_name, slug, bio, banner_url, created_at, updated_at')
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
    [refs.firstName, refs.lastName, refs.phone, refs.photoUrl, refs.storeName, refs.storeSlug, refs.storeBio, refs.storeBannerUrl]
      .forEach((field) => field.addEventListener('input', updatePreview));

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
      showStatus(`Erro ao iniciar a página da loja: ${err.message}`, 'danger');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
