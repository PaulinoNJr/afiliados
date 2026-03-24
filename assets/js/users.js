(() => {
  const DEFAULT_ACCENT = '#0d6efd';
  const DEFAULT_CTA = 'Ver produto';

  const state = {
    session: null,
    profile: null,
    users: [],
    selectedUser: null,
    slugCheckNonce: 0
  };

  const refs = {
    userRoleBadge: document.getElementById('userRoleBadge'),
    userEmail: document.getElementById('userEmail'),
    logoutBtn: document.getElementById('logoutBtn'),
    status: document.getElementById('statusMessage'),

    createUserForm: document.getElementById('createUserForm'),
    createUserBtn: document.getElementById('createUserBtn'),
    newUserEmail: document.getElementById('newUserEmail'),
    newUserPassword: document.getElementById('newUserPassword'),
    newUserPasswordConfirm: document.getElementById('newUserPasswordConfirm'),
    newUserPasswordRules: document.getElementById('newUserPasswordRules'),
    newUserPasswordMatchFeedback: document.getElementById('newUserPasswordMatchFeedback'),

    usersLoading: document.getElementById('usersLoading'),
    reloadUsersBtn: document.getElementById('reloadUsersBtn'),
    usersTableBody: document.getElementById('usersTableBody'),
    emptyUsersState: document.getElementById('emptyUsersState'),

    userEditorCard: document.getElementById('userEditorCard'),
    editorIntro: document.getElementById('editorIntro'),
    selectedUserStoreLink: document.getElementById('selectedUserStoreLink'),
    clearEditorBtn: document.getElementById('clearEditorBtn'),
    editUserForm: document.getElementById('editUserForm'),
    selectedUserEmail: document.getElementById('selectedUserEmail'),
    editRole: document.getElementById('editRole'),
    editFirstName: document.getElementById('editFirstName'),
    editLastName: document.getElementById('editLastName'),
    editPhone: document.getElementById('editPhone'),
    editStoreName: document.getElementById('editStoreName'),
    editStoreSlug: document.getElementById('editStoreSlug'),
    editStoreSlugFeedback: document.getElementById('editStoreSlugFeedback'),
    editHeadline: document.getElementById('editHeadline'),
    editAccentColor: document.getElementById('editAccentColor'),
    editCtaLabel: document.getElementById('editCtaLabel'),
    editBio: document.getElementById('editBio'),
    editPhotoUrl: document.getElementById('editPhotoUrl'),
    editBannerUrl: document.getElementById('editBannerUrl'),
    saveUserBtn: document.getElementById('saveUserBtn')
  };

  function showStatus(message, type = 'warning') {
    refs.status.className = `alert alert-${type}`;
    refs.status.textContent = message;
    refs.status.classList.remove('d-none');
  }

  function hideStatus() {
    refs.status.classList.add('d-none');
  }

  function setCreateUserLoading(isLoading) {
    refs.createUserBtn.disabled = isLoading;
    refs.createUserBtn.textContent = isLoading ? 'Criando...' : 'Criar usuario';
  }

  function setSaveUserLoading(isLoading) {
    refs.saveUserBtn.disabled = isLoading;
    refs.saveUserBtn.textContent = isLoading ? 'Salvando...' : 'Salvar alteracoes';
  }

  function setUsersLoading(isLoading) {
    refs.usersLoading.classList.toggle('d-none', !isLoading);
  }

  function formatDate(value) {
    if (!value) return '-';
    return new Date(value).toLocaleString('pt-BR');
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
    return /^#([0-9a-f]{6}|[0-9a-f]{3})$/.test(raw) ? raw : DEFAULT_ACCENT;
  }

  function setSlugFeedback(message, tone = 'secondary') {
    refs.editStoreSlugFeedback.className = `d-block mt-2 text-${tone}`;
    refs.editStoreSlugFeedback.textContent = message;
  }

  function updatePasswordValidation() {
    const result = window.StoreUtils.validatePasswordRules(refs.newUserPassword.value);
    const rulesList = refs.newUserPasswordRules?.querySelectorAll('[data-rule]') || [];

    rulesList.forEach((item) => {
      const ruleName = item.getAttribute('data-rule');
      const valid = Boolean(result.rules[ruleName]);
      item.classList.toggle('is-valid', valid);
      item.classList.toggle('is-invalid', !valid && refs.newUserPassword.value.length > 0);
    });

    const matches =
      refs.newUserPasswordConfirm.value.length > 0 &&
      refs.newUserPassword.value === refs.newUserPasswordConfirm.value;

    if (!refs.newUserPasswordConfirm.value.length) {
      refs.newUserPasswordMatchFeedback.className = 'd-block mt-2 text-secondary';
      refs.newUserPasswordMatchFeedback.textContent = 'Use a confirmacao para repetir exatamente a senha digitada.';
    } else if (matches) {
      refs.newUserPasswordMatchFeedback.className = 'd-block mt-2 text-success';
      refs.newUserPasswordMatchFeedback.textContent = 'As senhas coincidem.';
    } else {
      refs.newUserPasswordMatchFeedback.className = 'd-block mt-2 text-danger';
      refs.newUserPasswordMatchFeedback.textContent = 'As senhas nao coincidem.';
    }

    return {
      ...result,
      matches
    };
  }

  function applyHeader() {
    refs.userEmail.textContent = state.session.user.email || 'Usuario autenticado';
    refs.userRoleBadge.textContent = state.profile.role;
    refs.userRoleBadge.className = state.profile.role === 'admin' ? 'badge text-bg-primary' : 'badge text-bg-secondary';
  }

  function clearEditor() {
    state.selectedUser = null;
    refs.editUserForm.reset();
    refs.userEditorCard.classList.add('d-none');
    refs.selectedUserStoreLink.classList.add('d-none');
    setSlugFeedback('Use letras minusculas, numeros e hifens.', 'secondary');
  }

  function populateEditor(user) {
    state.selectedUser = user;

    refs.selectedUserEmail.value = user.user_email || '';
    refs.editRole.value = user.role || 'produtor';
    refs.editFirstName.value = user.first_name || '';
    refs.editLastName.value = user.last_name || '';
    refs.editPhone.value = user.phone || '';
    refs.editStoreName.value = user.store_name || '';
    refs.editStoreSlug.value = user.slug || '';
    refs.editHeadline.value = user.headline || '';
    refs.editAccentColor.value = normalizeAccentColor(user.accent_color || DEFAULT_ACCENT);
    refs.editCtaLabel.value = user.cta_label || DEFAULT_CTA;
    refs.editBio.value = user.bio || '';
    refs.editPhotoUrl.value = user.photo_url || '';
    refs.editBannerUrl.value = user.banner_url || '';
    refs.editorIntro.textContent = `Editando ${user.user_email || 'usuario sem email'}.`;
    refs.userEditorCard.classList.remove('d-none');

    if (user.slug) {
      refs.selectedUserStoreLink.href = window.StoreUtils.getStoreUrl(user.slug);
      refs.selectedUserStoreLink.classList.remove('d-none');
    } else {
      refs.selectedUserStoreLink.classList.add('d-none');
    }

    setSlugFeedback('Use letras minusculas, numeros e hifens.', 'secondary');
  }

  function renderUsers() {
    refs.usersTableBody.innerHTML = '';

    if (!state.users.length) {
      refs.emptyUsersState.classList.remove('d-none');
      clearEditor();
      return;
    }

    refs.emptyUsersState.classList.add('d-none');

    state.users.forEach((user) => {
      const tr = document.createElement('tr');
      const isSelected = state.selectedUser?.user_id === user.user_id;

      const tdEmail = document.createElement('td');
      tdEmail.innerHTML = `
        <div class="fw-semibold">${user.user_email || `Sem email (${user.user_id.slice(0, 8)}...)`}</div>
        <div class="small text-secondary">${[user.first_name, user.last_name].filter(Boolean).join(' ') || 'Sem nome informado'}</div>
      `;

      const tdStore = document.createElement('td');
      tdStore.innerHTML = `
        <div class="fw-semibold">${user.store_name || 'Sem loja'}</div>
        <div class="small text-secondary">${user.slug ? `/${user.slug}` : 'Slug nao definido'}</div>
      `;

      const tdRole = document.createElement('td');
      const badge = document.createElement('span');
      badge.className = user.role === 'admin' ? 'badge text-bg-primary' : 'badge text-bg-secondary';
      badge.textContent = user.role || 'produtor';
      tdRole.appendChild(badge);

      const tdUpdated = document.createElement('td');
      tdUpdated.className = 'small text-secondary';
      tdUpdated.textContent = formatDate(user.updated_at || user.created_at);

      const tdActions = document.createElement('td');
      tdActions.className = 'text-end';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = isSelected ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-outline-primary';
      editBtn.textContent = isSelected ? 'Editando' : 'Editar';
      editBtn.addEventListener('click', () => populateEditor(user));

      tdActions.appendChild(editBtn);
      tr.append(tdEmail, tdStore, tdRole, tdUpdated, tdActions);
      refs.usersTableBody.appendChild(tr);
    });
  }

  async function loadUsers() {
    setUsersLoading(true);

    try {
      const { data, error } = await window.db
        .from('user_profiles')
        .select('user_id, user_email, role, first_name, last_name, phone, store_name, slug, headline, accent_color, cta_label, bio, photo_url, banner_url, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      state.users = data || [];

      if (state.selectedUser) {
        const freshSelected = state.users.find((user) => user.user_id === state.selectedUser.user_id);
        if (freshSelected) {
          populateEditor(freshSelected);
        } else {
          clearEditor();
        }
      }

      renderUsers();
    } catch (err) {
      showStatus(`Erro ao carregar usuarios: ${err.message}`, 'danger');
    } finally {
      setUsersLoading(false);
    }
  }

  async function validateSelectedUserSlug({ silent = false } = {}) {
    const validation = window.StoreUtils.validateStoreSlug(refs.editStoreSlug.value);
    refs.editStoreSlug.value = validation.slug;

    if (!validation.ok) {
      setSlugFeedback(validation.message, 'danger');
      return { ok: false, slug: validation.slug };
    }

    const nonce = ++state.slugCheckNonce;
    setSlugFeedback('Verificando disponibilidade...', 'secondary');

    try {
      const availability = await window.StoreUtils.checkSlugAvailability(validation.slug, state.selectedUser?.user_id || null);
      if (nonce !== state.slugCheckNonce) return { ok: false, stale: true, slug: validation.slug };

      if (!availability.available) {
        setSlugFeedback(availability.reason, 'danger');
        if (!silent) showStatus(availability.reason, 'warning');
        return { ok: false, slug: availability.slug };
      }

      setSlugFeedback(availability.reason, 'success');
      return { ok: true, slug: availability.slug };
    } catch (err) {
      setSlugFeedback(`Erro ao validar slug: ${err.message}`, 'danger');
      if (!silent) showStatus(`Erro ao validar slug: ${err.message}`, 'danger');
      return { ok: false, slug: validation.slug };
    }
  }

  async function updateSelectedUser(event) {
    event.preventDefault();
    hideStatus();

    if (!state.selectedUser) {
      showStatus('Selecione um usuario para editar.', 'warning');
      return;
    }

    const firstName = refs.editFirstName.value.trim();
    const lastName = refs.editLastName.value.trim();
    const phone = refs.editPhone.value.trim();
    const storeName = refs.editStoreName.value.trim();
    const headline = refs.editHeadline.value.trim();
    const accentColor = normalizeAccentColor(refs.editAccentColor.value);
    const ctaLabel = refs.editCtaLabel.value.trim() || DEFAULT_CTA;
    const bio = refs.editBio.value.trim();
    const photoUrl = refs.editPhotoUrl.value.trim();
    const bannerUrl = refs.editBannerUrl.value.trim();
    const role = refs.editRole.value;

    if (!firstName) {
      showStatus('Informe o nome do usuario.', 'warning');
      return;
    }

    if (!storeName) {
      showStatus('Informe o nome da loja.', 'warning');
      return;
    }

    if (!['admin', 'produtor'].includes(role)) {
      showStatus('Perfil invalido.', 'warning');
      return;
    }

    if (state.selectedUser.user_id === state.session.user.id && role !== 'admin') {
      showStatus('Para evitar bloqueio do painel, seu proprio usuario precisa continuar como admin aqui.', 'warning');
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

    const slugResult = await validateSelectedUserSlug();
    if (!slugResult.ok) return;

    setSaveUserLoading(true);

    try {
      const { data, error } = await window.db
        .from('user_profiles')
        .update({
          role,
          first_name: firstName,
          last_name: lastName || null,
          phone: phone || null,
          store_name: storeName,
          slug: slugResult.slug,
          headline: headline || null,
          accent_color: accentColor,
          cta_label: ctaLabel,
          bio: bio || null,
          photo_url: photoUrl || null,
          banner_url: bannerUrl || null
        })
        .eq('user_id', state.selectedUser.user_id)
        .select('user_id, user_email, role, first_name, last_name, phone, store_name, slug, headline, accent_color, cta_label, bio, photo_url, banner_url, created_at, updated_at')
        .single();

      if (error) throw error;

      state.selectedUser = data;

      if (data.user_id === state.session.user.id) {
        state.profile = data;
        applyHeader();
      }

      showStatus('Usuario atualizado com sucesso.', 'success');
      await loadUsers();
    } catch (err) {
      showStatus(`Erro ao atualizar usuario: ${err.message}`, 'danger');
    } finally {
      setSaveUserLoading(false);
    }
  }

  async function createUser(event) {
    event.preventDefault();
    hideStatus();

    const email = refs.newUserEmail.value.trim();
    const password = refs.newUserPassword.value;
    const confirmPassword = refs.newUserPasswordConfirm.value;

    if (!email || !password || !confirmPassword) {
      showStatus('Preencha email, senha e confirmacao de senha.', 'warning');
      return;
    }

    const passwordValidation = updatePasswordValidation();
    if (!passwordValidation.ok) {
      showStatus('A senha precisa ter pelo menos 8 caracteres, com maiusculas, minusculas, numeros e caractere especial.', 'warning');
      return;
    }

    if (!passwordValidation.matches) {
      showStatus('As senhas nao coincidem.', 'warning');
      return;
    }

    setCreateUserLoading(true);

    try {
      const response = await fetch('/api/admin-create-user', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${state.session.access_token}`
        },
        body: JSON.stringify({
          email,
          password
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Nao foi possivel criar o usuario com seguranca.');
      }

      refs.createUserForm.reset();
      updatePasswordValidation();
      showStatus('Usuario criado com sucesso.', 'success');

      await loadUsers();
    } catch (err) {
      showStatus(`Erro ao criar usuario: ${err.message}`, 'danger');
    } finally {
      setCreateUserLoading(false);
    }
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
      const isAdmin = state.profile?.role === 'admin';

      if (!isAdmin) {
        showStatus('Acesso restrito: somente admin pode gerenciar usuarios.', 'danger');
        setTimeout(() => {
          window.location.href = 'admin.html';
        }, 1200);
        return;
      }

      applyHeader();

      refs.logoutBtn.addEventListener('click', async () => {
        await window.Auth.logout();
        window.location.href = 'login.html';
      });
      refs.newUserPassword.addEventListener('input', updatePasswordValidation);
      refs.newUserPasswordConfirm.addEventListener('input', updatePasswordValidation);
      refs.createUserForm.addEventListener('submit', createUser);
      refs.reloadUsersBtn.addEventListener('click', loadUsers);
      refs.clearEditorBtn.addEventListener('click', clearEditor);
      refs.editUserForm.addEventListener('submit', updateSelectedUser);

      refs.editPhone.addEventListener('input', () => {
        refs.editPhone.value = window.StoreUtils.formatPhone(refs.editPhone.value);
      });

      refs.editStoreSlug.addEventListener('input', () => {
        refs.editStoreSlug.value = window.StoreUtils.normalizeStoreSlug(refs.editStoreSlug.value);
        const validation = window.StoreUtils.validateStoreSlug(refs.editStoreSlug.value);
        setSlugFeedback(validation.message, validation.ok ? 'secondary' : 'danger');
      });

      refs.editStoreSlug.addEventListener('blur', async () => {
        if (!refs.editStoreSlug.value.trim()) return;
        await validateSelectedUserSlug({ silent: true });
      });

      updatePasswordValidation();
      await loadUsers();
    } catch (err) {
      showStatus(`Erro ao iniciar a gestao de usuarios: ${err.message}`, 'danger');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
