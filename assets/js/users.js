(() => {
  const state = {
    session: null,
    profile: null,
    users: []
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
    emptyUsersState: document.getElementById('emptyUsersState')
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

  function setUsersLoading(isLoading) {
    refs.usersLoading.classList.toggle('d-none', !isLoading);
  }

  function formatDate(value) {
    if (!value) return '-';
    return new Date(value).toLocaleString('pt-BR');
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

  function renderUsers() {
    refs.usersTableBody.innerHTML = '';

    if (!state.users.length) {
      refs.emptyUsersState.classList.remove('d-none');
      return;
    }

    refs.emptyUsersState.classList.add('d-none');

    state.users.forEach((user) => {
      const tr = document.createElement('tr');

      const tdEmail = document.createElement('td');
      tdEmail.textContent = user.user_email || `Sem email (${user.user_id.slice(0, 8)}...)`;

      const tdRole = document.createElement('td');
      const roleSelect = document.createElement('select');
      roleSelect.className = 'form-select form-select-sm';
      roleSelect.innerHTML = `
        <option value="produtor">produtor</option>
        <option value="admin">admin</option>
      `;
      roleSelect.value = user.role || 'produtor';

      const isCurrentUser = user.user_id === state.session.user.id;
      if (isCurrentUser) {
        roleSelect.disabled = true;
      }

      tdRole.appendChild(roleSelect);

      const tdCreatedAt = document.createElement('td');
      tdCreatedAt.className = 'small text-secondary';
      tdCreatedAt.textContent = formatDate(user.created_at);

      const tdActions = document.createElement('td');
      tdActions.className = 'text-end';

      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.className = 'btn btn-sm btn-outline-primary';
      saveBtn.textContent = 'Salvar perfil';

      if (isCurrentUser) {
        saveBtn.disabled = true;
        saveBtn.title = 'Voce nao pode alterar o proprio perfil aqui.';
      } else {
        saveBtn.addEventListener('click', async () => {
          await updateUserRole(user.user_id, roleSelect.value);
        });
      }

      tdActions.appendChild(saveBtn);
      tr.append(tdEmail, tdRole, tdCreatedAt, tdActions);
      refs.usersTableBody.appendChild(tr);
    });
  }

  async function loadUsers() {
    setUsersLoading(true);

    try {
      const { data, error } = await window.db
        .from('user_profiles')
        .select('user_id, user_email, role, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      state.users = data || [];
      renderUsers();
    } catch (err) {
      showStatus(`Erro ao carregar usuarios: ${err.message}`, 'danger');
    } finally {
      setUsersLoading(false);
    }
  }

  async function updateUserRole(userId, role) {
    hideStatus();

    if (!['admin', 'produtor'].includes(role)) {
      showStatus('Perfil invalido.', 'warning');
      return;
    }

    try {
      const { error } = await window.db
        .from('user_profiles')
        .update({ role })
        .eq('user_id', userId);

      if (error) throw error;

      showStatus('Perfil atualizado com sucesso.', 'success');
      await loadUsers();
    } catch (err) {
      showStatus(`Erro ao atualizar perfil: ${err.message}`, 'danger');
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
      const { data, error } = await window.Auth.register(email, password);
      if (error) throw error;

      refs.createUserForm.reset();
      updatePasswordValidation();

      if (data?.user && !data?.session) {
        showStatus('Usuario criado. Ele precisa confirmar o email antes de entrar.', 'success');
      } else {
        showStatus('Usuario criado com sucesso.', 'success');
      }

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

      updatePasswordValidation();
      await loadUsers();
    } catch (err) {
      showStatus(`Erro ao iniciar a gestao de usuarios: ${err.message}`, 'danger');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
