(() => {
  const state = {
    session: null,
    profile: null,
    isAdmin: false
  };

  const refs = {
    userRoleBadge: document.getElementById('userRoleBadge'),
    userEmail: document.getElementById('userEmail'),
    userEmailReadonly: document.getElementById('userEmailReadonly'),
    logoutBtn: document.getElementById('logoutBtn'),
    status: document.getElementById('statusMessage'),
    personalProfileForm: document.getElementById('personalProfileForm'),
    saveProfileBtn: document.getElementById('saveProfileBtn'),
    firstName: document.getElementById('firstName'),
    lastName: document.getElementById('lastName'),
    phone: document.getElementById('phone'),
    photoUpload: document.getElementById('photoUpload'),
    photoUploadStatus: document.getElementById('photoUploadStatus'),
    photoUrl: document.getElementById('photoUrl'),
    photoPreview: document.getElementById('photoPreview'),
    profileNamePreview: document.getElementById('profileNamePreview'),
    profilePhonePreview: document.getElementById('profilePhonePreview')
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

  function setSaveLoading(isLoading) {
    refs.saveProfileBtn.disabled = isLoading;
    refs.saveProfileBtn.textContent = isLoading ? 'Salvando...' : 'Salvar dados';
  }

  function setUploadStatus(message, tone = 'secondary') {
    refs.photoUploadStatus.className = `d-block mt-2 text-${tone}`;
    refs.photoUploadStatus.textContent = message;
  }

  function getFullName() {
    return [refs.firstName.value.trim(), refs.lastName.value.trim()].filter(Boolean).join(' ').trim() || 'Seu nome';
  }

  function applyHeader() {
    const email = state.session.user.email || 'Usuario autenticado';
    refs.userEmail.textContent = email;
    refs.userEmailReadonly.value = email;
    refs.userRoleBadge.textContent = state.isAdmin ? 'admin' : 'produtor';
    refs.userRoleBadge.className = state.isAdmin ? 'badge text-bg-primary' : 'badge text-bg-secondary';
    window.Auth.applyProfileAccess(state.profile);
  }

  function updatePreview() {
    const photoUrl = refs.photoUrl.value.trim();
    refs.profileNamePreview.textContent = getFullName();
    refs.profilePhonePreview.textContent = refs.phone.value.trim() || 'Telefone nao informado';

    if (isValidHttpUrl(photoUrl)) {
      refs.photoPreview.src = photoUrl;
      refs.photoPreview.classList.remove('d-none');
      refs.photoPreview.onerror = () => refs.photoPreview.classList.add('d-none');
    } else {
      refs.photoPreview.classList.add('d-none');
    }
  }

  function populateForm(profile) {
    refs.firstName.value = profile?.first_name || '';
    refs.lastName.value = profile?.last_name || '';
    refs.phone.value = profile?.phone || '';
    refs.photoUrl.value = profile?.photo_url || '';
    setUploadStatus('Envie JPG, PNG, WEBP ou GIF com ate 5 MB.', 'secondary');
    updatePreview();
  }

  async function handlePhotoUpload() {
    if (!refs.photoUpload.files?.length) return;

    setUploadStatus('Enviando foto...', 'secondary');

    try {
      const upload = await window.StoreUtils.uploadStoreAsset(refs.photoUpload.files[0], {
        userId: state.session.user.id,
        assetType: 'photo'
      });

      if (!upload?.publicUrl) {
        throw new Error('Nao foi possivel obter a URL publica da foto.');
      }

      refs.photoUrl.value = upload.publicUrl;
      setUploadStatus('Foto enviada com sucesso.', 'success');
      updatePreview();
    } catch (err) {
      setUploadStatus(`Erro no upload da foto: ${err.message}`, 'danger');
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    hideStatus();

    const firstName = refs.firstName.value.trim();
    const lastName = refs.lastName.value.trim();
    const phone = refs.phone.value.trim();
    const photoUrl = refs.photoUrl.value.trim();

    if (!firstName) {
      showStatus('Informe seu nome.', 'warning');
      return;
    }

    if (photoUrl && !isValidHttpUrl(photoUrl)) {
      showStatus('Informe uma URL valida para a foto ou deixe o campo vazio.', 'warning');
      return;
    }

    setSaveLoading(true);

    try {
      const { data, error } = await window.db
        .from('user_profiles')
        .update({
          first_name: firstName,
          last_name: lastName || null,
          phone: phone || null,
          photo_url: photoUrl || null
        })
        .eq('user_id', state.session.user.id)
        .select('user_id, user_email, role, first_name, last_name, phone, photo_url, store_name, slug, slug_changed_at, activation_status, activation_requested_at, activation_email_sent_at, activation_expires_at, activation_confirmed_at, headline, accent_color, text_color, page_background, button_text_color, button_style, card_style, cta_label, bio, banner_url, created_at, updated_at')
        .single();

      if (error) throw error;

      state.profile = data;
      applyHeader();
      populateForm(state.profile);
      showStatus('Dados pessoais atualizados com sucesso.', 'success');
    } catch (err) {
      showStatus(`Erro ao salvar dados pessoais: ${err.message}`, 'danger');
    } finally {
      setSaveLoading(false);
    }
  }

  function bindEvents() {
    [refs.firstName, refs.lastName, refs.photoUrl].forEach((field) => field.addEventListener('input', updatePreview));

    refs.phone.addEventListener('input', () => {
      refs.phone.value = window.StoreUtils.formatPhone(refs.phone.value);
      updatePreview();
    });

    refs.photoUpload.addEventListener('change', handlePhotoUpload);
    refs.personalProfileForm.addEventListener('submit', saveProfile);
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
      state.isAdmin = state.profile?.role === 'admin';

      applyHeader();
      populateForm(state.profile);
      bindEvents();

      refs.logoutBtn.addEventListener('click', async () => {
        await window.Auth.logout();
        window.location.href = 'login.html';
      });
    } catch (err) {
      showStatus(`Erro ao iniciar os dados pessoais: ${err.message}`, 'danger');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
