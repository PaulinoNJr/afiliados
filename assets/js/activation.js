(() => {
  const state = {
    tokenHash: '',
    tokenType: 'email',
    confirming: false
  };

  const refs = {
    status: document.getElementById('statusMessage'),
    activationInfo: document.getElementById('activationInfo'),
    confirmEmailBtn: document.getElementById('confirmEmailBtn'),
    goToLoginBtn: document.getElementById('goToLoginBtn')
  };

  function showStatus(message, type = 'info') {
    refs.status.className = `alert alert-${type}`;
    refs.status.textContent = message;
    refs.status.classList.remove('d-none');
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

  function formatDateTime(value) {
    if (!value) return '';
    return new Date(value).toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short'
    });
  }

  function setConfirmButton({
    visible = false,
    disabled = false,
    text = 'Confirmar email e ativar conta'
  } = {}) {
    if (!refs.confirmEmailBtn) return;

    refs.confirmEmailBtn.textContent = text;
    refs.confirmEmailBtn.disabled = disabled;
    refs.confirmEmailBtn.classList.toggle('d-none', !visible);
  }

  function renderInfo(profile = null, { awaitingEmailConfirmation = false, awaitingExplicitConfirmation = false } = {}) {
    const expiresAt = profile?.activation_expires_at
      ? formatDateTime(profile.activation_expires_at)
      : 'dentro de 5 dias';

    const nextStep = awaitingExplicitConfirmation
      ? 'Use o botão abaixo para validar o email e concluir a ativação com segurança.'
      : awaitingEmailConfirmation
        ? 'Abra o email recebido no cadastro e use o link mais recente para concluir a ativação.'
        : 'Depois da ativação, o painel, a configuração da loja e o cadastro de produtos ficam liberados normalmente.';

    refs.activationInfo.innerHTML = '';

    const eyebrow = document.createElement('p');
    eyebrow.className = 'small text-uppercase fw-semibold text-secondary mb-2';
    eyebrow.textContent = 'Status da ativação';

    const deadline = document.createElement('p');
    deadline.className = 'small text-secondary mb-2';
    deadline.append('A sua conta fica pendente até a confirmação do email. O prazo limite para ativação é ');
    const strong = document.createElement('strong');
    strong.textContent = expiresAt;
    deadline.appendChild(strong);
    deadline.append('.');

    const nextStepText = document.createElement('p');
    nextStepText.className = 'small text-secondary mb-0';
    nextStepText.textContent = nextStep;

    refs.activationInfo.append(eyebrow, deadline, nextStepText);
  }

  async function finalizeActivation() {
    const { data, error } = await window.db.rpc('finalize_account_activation');
    if (error) throw error;
    return Array.isArray(data) ? (data[0] || null) : data;
  }

  async function waitForSession(timeoutMs = 5000) {
    const currentSession = await window.Auth.getSession();
    if (currentSession) {
      return currentSession;
    }

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

  function finishAsActive(profile = null) {
    refs.goToLoginBtn.href = window.Auth.getDashboardRoute(profile?.role);
    refs.goToLoginBtn.textContent = 'Abrir painel';
    setConfirmButton({ visible: false });
  }

  async function ensureActivationFromSession() {
    const session = await window.Auth.getSession();
    if (!session) {
      renderInfo(null, { awaitingEmailConfirmation: true });
      return false;
    }

    let profile = await window.Auth.getProfile();
    renderInfo(profile);

    if (window.Auth.isAccountActive(profile)) {
      showStatus('Sua conta já está ativa. Você pode acessar o painel normalmente.', 'success');
      finishAsActive(profile);
      return true;
    }

    profile = await finalizeActivation();
    renderInfo(profile);
    showStatus('Conta ativada com sucesso. O painel ja pode ser acessado.', 'success');
    finishAsActive(profile);
    return true;
  }

  async function confirmEmailAndActivate() {
    if (!state.tokenHash || state.confirming) return;

    state.confirming = true;
    setConfirmButton({
      visible: true,
      disabled: true,
      text: 'Confirmando email...'
    });
    showStatus('Validando o link de confirmação e preparando a ativação...', 'info');

    try {
      const { error } = await window.db.auth.verifyOtp({
        token_hash: state.tokenHash,
        type: state.tokenType || 'email'
      });

      if (error) {
        throw error;
      }

      const session = await waitForSession();
      if (!session) {
        throw new Error('O email foi confirmado, mas a sessão não ficou disponível. Abra novamente o link mais recente enviado para sua caixa de entrada.');
      }

      window.history.replaceState({}, document.title, window.location.pathname);
      await ensureActivationFromSession();
    } catch (err) {
      showStatus(err.message || 'Não foi possóvel confirmar o e-mail.', 'danger');
      renderInfo(null, { awaitingExplicitConfirmation: true });
      setConfirmButton({
        visible: true,
        disabled: false,
        text: 'Tentar novamente'
      });
    } finally {
      state.confirming = false;
    }
  }

  async function init() {
    if (window.AppConfig?.missingConfig) {
      showStatus('Configure SUPABASE_URL e SUPABASE_ANON_KEY em assets/js/config.js.', 'warning');
      return;
    }

    refs.confirmEmailBtn?.addEventListener('click', confirmEmailAndActivate);

    const status = getParam('status');
    const errorDescription = getParam('error_description');
    const errorCode = getParam('error_code');

    state.tokenHash = getParam('token_hash');
    state.tokenType = getParam('type') || 'email';

    if (errorDescription) {
      showStatus(
        errorCode
          ? `${errorDescription} (codigo ${errorCode})`
          : errorDescription,
        'danger'
      );
    }

    if (status === 'pending') {
      showStatus('Sua conta ainda precisa ser confirmada pelo link enviado no email.', 'warning');
    } else if (status === 'expired') {
      showStatus('O prazo para ativar sua conta expirou. Cadastre novamente ou solicite um novo email de ativação.', 'danger');
    }

    try {
      if (state.tokenHash) {
        renderInfo(null, { awaitingExplicitConfirmation: true });
        setConfirmButton({ visible: true });
        return;
      }

      const hasSessionPayload = ['access_token', 'refresh_token', 'code'].some((name) => Boolean(getParam(name)));
      if (hasSessionPayload) {
        renderInfo();
        showStatus('Recebemos o retorno do email de confirmação. Validando a sessão...', 'info');
        const session = await waitForSession();
        if (!session) {
          renderInfo(null, { awaitingEmailConfirmation: true });
          showStatus('O link foi aberto, mas a sessão não foi concluída automaticamente. Use o email mais recente ou atualize o template de confirmação no Supabase.', 'warning');
          return;
        }

        await ensureActivationFromSession();
        return;
      }

      const activated = await ensureActivationFromSession();
      if (!activated) {
        setConfirmButton({ visible: false });
      }
    } catch (err) {
      showStatus(err.message || 'Não foi possível concluir a ativação da conta.', 'danger');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
