(() => {
  const refs = {
    status: document.getElementById('statusMessage'),
    activationInfo: document.getElementById('activationInfo'),
    goToLoginBtn: document.getElementById('goToLoginBtn')
  };

  function showStatus(message, type = 'info') {
    refs.status.className = `alert alert-${type}`;
    refs.status.textContent = message;
    refs.status.classList.remove('d-none');
  }

  function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return String(params.get(name) || '').trim();
  }

  function formatDateTime(value) {
    if (!value) return '';
    return new Date(value).toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short'
    });
  }

  function renderInfo(profile = null) {
    const expiresAt = profile?.activation_expires_at
      ? formatDateTime(profile.activation_expires_at)
      : 'dentro de 5 dias';

    refs.activationInfo.innerHTML = `
      <p class="small text-uppercase fw-semibold text-secondary mb-2">Status da ativacao</p>
      <p class="small text-secondary mb-2">A sua conta fica pendente ate a confirmacao do email. O prazo limite para ativacao e <strong>${expiresAt}</strong>.</p>
      <p class="small text-secondary mb-0">Depois da ativacao, o painel, a configuracao da loja e o cadastro de produtos ficam liberados normalmente.</p>
    `;
  }

  async function finalizeActivation() {
    const { data, error } = await window.db.rpc('finalize_account_activation');
    if (error) throw error;
    return Array.isArray(data) ? (data[0] || null) : data;
  }

  async function init() {
    if (window.AppConfig?.missingConfig) {
      showStatus('Configure SUPABASE_URL e SUPABASE_ANON_KEY em assets/js/config.js.', 'warning');
      return;
    }

    const status = getQueryParam('status');
    if (status === 'pending') {
      showStatus('Sua conta ainda precisa ser confirmada pelo link enviado no email.', 'warning');
    } else if (status === 'expired') {
      showStatus('O prazo para ativar sua conta expirou. Cadastre novamente ou solicite um novo email de ativacao.', 'danger');
    }

    try {
      const session = await window.Auth.getSession();
      if (!session) {
        renderInfo();
        return;
      }

      let profile = await window.Auth.getProfile();
      renderInfo(profile);

      if (window.Auth.isAccountActive(profile)) {
        showStatus('Sua conta ja esta ativa. Voce pode acessar o painel normalmente.', 'success');
        refs.goToLoginBtn.href = 'admin.html';
        refs.goToLoginBtn.textContent = 'Ir para o painel';
        return;
      }

      profile = await finalizeActivation();
      renderInfo(profile);
      showStatus('Conta ativada com sucesso. O painel ja pode ser acessado.', 'success');
      refs.goToLoginBtn.href = 'admin.html';
      refs.goToLoginBtn.textContent = 'Abrir painel';
    } catch (err) {
      showStatus(err.message || 'Nao foi possivel concluir a ativacao da conta.', 'danger');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
