(() => {
  const state = {
    tokenHash: '',
    tokenType: 'recovery',
    authListener: null
  };

  const refs = {
    status: document.getElementById('statusMessage'),
    requestSection: document.getElementById('requestSection'),
    verifySection: document.getElementById('verifySection'),
    resetSection: document.getElementById('resetSection'),
    requestForm: document.getElementById('requestResetForm'),
    requestEmail: document.getElementById('recoveryEmail'),
    requestBtn: document.getElementById('requestResetBtn'),
    verifyBtn: document.getElementById('verifyRecoveryBtn'),
    resetForm: document.getElementById('resetPasswordForm'),
    password: document.getElementById('newPassword'),
    passwordConfirm: document.getElementById('newPasswordConfirm'),
    passwordRules: document.getElementById('passwordRules'),
    passwordMatchFeedback: document.getElementById('passwordMatchFeedback'),
    updatePasswordBtn: document.getElementById('updatePasswordBtn')
  };

  function showStatus(message, type = 'info') {
    refs.status.className = `alert alert-${type}`;
    refs.status.textContent = message;
    refs.status.classList.remove('d-none');
  }

  function hideStatus() {
    refs.status.classList.add('d-none');
  }

  function getParams() {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    return { query, hash };
  }

  function getParam(name) {
    const { query, hash } = getParams();
    return String(query.get(name) || hash.get(name) || '').trim();
  }

  function hasSessionPayload() {
    return ['access_token', 'refresh_token', 'code'].some((name) => Boolean(getParam(name)));
  }

  function getRecoveryRedirectUrl() {
    return `${window.location.origin}/recuperar-senha`;
  }

  function setSection(mode) {
    refs.requestSection.classList.toggle('d-none', mode !== 'request');
    refs.verifySection.classList.toggle('d-none', mode !== 'verify');
    refs.resetSection.classList.toggle('d-none', mode !== 'reset');
  }

  function setRequestLoading(isLoading) {
    refs.requestBtn.disabled = isLoading;
    refs.requestBtn.textContent = isLoading ? 'Enviando link...' : 'Enviar link de recuperação';
  }

  function setVerifyLoading(isLoading) {
    refs.verifyBtn.disabled = isLoading;
    refs.verifyBtn.textContent = isLoading ? 'Validando link...' : 'Validar link de recuperação';
  }

  function setUpdateLoading(isLoading) {
    refs.updatePasswordBtn.disabled = isLoading;
    refs.updatePasswordBtn.textContent = isLoading ? 'Atualizando senha...' : 'Salvar nova senha';
  }

  function updatePasswordValidation() {
    const result = window.StoreUtils.validatePasswordRules(refs.password.value);
    const rulesList = refs.passwordRules?.querySelectorAll('[data-rule]') || [];

    rulesList.forEach((item) => {
      const ruleName = item.dataset.rule;
      const valid = Boolean(result.rules[ruleName]);
      item.classList.toggle('is-valid', valid);
      item.classList.toggle('is-invalid', !valid && refs.password.value.length > 0);
    });

    const hasConfirm = refs.passwordConfirm.value.length > 0;
    const matches = hasConfirm && refs.password.value === refs.passwordConfirm.value;

    if (!hasConfirm) {
      refs.passwordMatchFeedback.className = 'd-block mt-2 text-secondary';
      refs.passwordMatchFeedback.textContent = 'Repita a nova senha para confirmar.';
    } else if (matches) {
      refs.passwordMatchFeedback.className = 'd-block mt-2 text-success';
      refs.passwordMatchFeedback.textContent = 'As senhas coincidem.';
    } else {
      refs.passwordMatchFeedback.className = 'd-block mt-2 text-danger';
      refs.passwordMatchFeedback.textContent = 'As senhas não coincidem.';
    }

    return {
      ...result,
      matches
    };
  }

  async function waitForSession(timeoutMs = 5000) {
    const currentSession = await window.Auth.getSession().catch(() => null);
    if (currentSession) return currentSession;

    return new Promise((resolve) => {
      let resolved = false;
      const startedAt = Date.now();
      const { data: listener } = window.db.auth.onAuthStateChange((_event, session) => {
        if (resolved || !session) return;
        resolved = true;
        listener?.subscription?.unsubscribe();
        resolve(session);
      });

      async function poll() {
        if (resolved) return;

        const session = await window.Auth.getSession().catch(() => null);
        if (session) {
          resolved = true;
          listener?.subscription?.unsubscribe();
          resolve(session);
          return;
        }

        if (Date.now() - startedAt >= timeoutMs) {
          resolved = true;
          listener?.subscription?.unsubscribe();
          resolve(null);
          return;
        }

        window.setTimeout(poll, 250);
      }

      poll();
    });
  }

  function clearSensitiveParams() {
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  async function handleRequestReset(event) {
    event.preventDefault();

    const email = refs.requestEmail.value.trim();
    if (!email) {
      showStatus('Informe o email da conta para continuar.', 'warning');
      return;
    }

    setRequestLoading(true);
    hideStatus();

    try {
      const [{ error }] = await Promise.all([
        window.Auth.requestPasswordReset(email, {
          redirectTo: getRecoveryRedirectUrl()
        }),
        new Promise((resolve) => window.setTimeout(resolve, 700))
      ]);

      if (error) throw error;

      refs.requestForm.reset();
      showStatus(
        'Se o email estiver cadastrado, enviaremos um link temporário de recuperação. Verifique sua caixa de entrada e também o spam.',
        'success'
      );
    } catch (err) {
      showStatus(err.message || 'Não foi possível iniciar a recuperação de senha.', 'danger');
    } finally {
      setRequestLoading(false);
    }
  }

  async function enterResetMode(message = 'Link validado com sucesso. Agora defina sua nova senha.') {
    clearSensitiveParams();
    setSection('reset');
    refs.resetForm.reset();
    updatePasswordValidation();
    showStatus(message, 'info');
  }

  async function handleVerifyRecoveryLink() {
    if (!state.tokenHash) return;

    setVerifyLoading(true);
    hideStatus();

    try {
      const { error } = await window.db.auth.verifyOtp({
        token_hash: state.tokenHash,
        type: state.tokenType || 'recovery'
      });

      if (error) throw error;

      const session = await waitForSession();
      if (!session) {
        throw new Error('O link foi validado, mas a sessão de recuperação não ficou disponível. Solicite um novo email para tentar novamente.');
      }

      state.tokenHash = '';
      await enterResetMode();
    } catch (err) {
      showStatus(err.message || 'Não foi possível validar o link de recuperação.', 'danger');
    } finally {
      setVerifyLoading(false);
    }
  }

  async function tryRecoverSessionFromUrl() {
    if (!hasSessionPayload()) return false;

    showStatus('Recebemos o retorno do email e estamos validando sua sessão de recuperação...', 'info');
    const session = await waitForSession();

    if (!session) {
      showStatus(
        'O link foi aberto, mas a sessão de recuperação não foi concluída automaticamente. Solicite um novo email se necessário.',
        'warning'
      );
      setSection('request');
      return false;
    }

    await enterResetMode('Sessão de recuperação validada. Defina sua nova senha.');
    return true;
  }

  async function handleUpdatePassword(event) {
    event.preventDefault();

    const passwordValidation = updatePasswordValidation();
    if (!passwordValidation.ok) {
      showStatus('Use uma senha forte com pelo menos 8 caracteres, letras maiúsculas, minúsculas, números e caractere especial.', 'warning');
      return;
    }

    if (!passwordValidation.matches) {
      showStatus('As senhas não coincidem.', 'warning');
      return;
    }

    const session = await window.Auth.getSession().catch(() => null);
    if (!session) {
      showStatus('Sua sessão de recuperação expirou. Solicite um novo link para redefinir a senha.', 'warning');
      setSection('request');
      return;
    }

    setUpdateLoading(true);
    hideStatus();

    try {
      const { error } = await window.Auth.updatePassword(refs.password.value);
      if (error) throw error;

      refs.resetForm.reset();
      updatePasswordValidation();
      showStatus('Senha atualizada com sucesso. Por segurança, faça login novamente com a nova senha.', 'success');

      window.setTimeout(async () => {
        await window.Auth.logout().catch(() => null);
        window.location.href = 'login.html';
      }, 1200);
    } catch (err) {
      showStatus(err.message || 'Não foi possível atualizar a senha.', 'danger');
    } finally {
      setUpdateLoading(false);
    }
  }

  async function init() {
    if (window.AppConfig?.missingConfig) {
      showStatus('Configure SUPABASE_URL e SUPABASE_ANON_KEY em assets/js/config.js.', 'warning');
      return;
    }

    refs.requestForm.addEventListener('submit', handleRequestReset);
    refs.verifyBtn.addEventListener('click', handleVerifyRecoveryLink);
    refs.resetForm.addEventListener('submit', handleUpdatePassword);
    refs.password.addEventListener('input', updatePasswordValidation);
    refs.passwordConfirm.addEventListener('input', updatePasswordValidation);
    updatePasswordValidation();

    const errorDescription = getParam('error_description');
    const errorCode = getParam('error_code');
    state.tokenHash = getParam('token_hash');
    state.tokenType = getParam('type') || 'recovery';

    const { data: authListener } = window.db.auth.onAuthStateChange((event, session) => {
      if (event !== 'PASSWORD_RECOVERY' || !session) return;
      enterResetMode('Sessão de recuperação confirmada. Defina sua nova senha.');
    });
    state.authListener = authListener?.subscription || null;

    if (errorDescription) {
      showStatus(
        errorCode
          ? `${errorDescription} (código ${errorCode})`
          : errorDescription,
        'danger'
      );
    }

    if (state.tokenHash) {
      setSection('verify');
      showStatus('Seu link de recuperação foi recebido. Clique no botão abaixo para validar o acesso antes de trocar a senha.', 'info');
      return;
    }

    try {
      const recovered = await tryRecoverSessionFromUrl();
      if (recovered) return;
    } catch (err) {
      showStatus(err.message || 'Não foi possível preparar a recuperação de senha.', 'danger');
    }

    setSection('request');
  }

  window.addEventListener('beforeunload', () => {
    state.authListener?.unsubscribe?.();
  });

  document.addEventListener('DOMContentLoaded', init);
})();
