(() => {
  const statusRef = document.getElementById('redirectStatusMessage');

  function setStatus(message) {
    if (statusRef) statusRef.textContent = message;
  }

  async function init() {
    if (window.AppConfig?.missingConfig) {
      setStatus('Configure o Supabase em assets/js/config.js antes de usar o painel.');
      return;
    }

    try {
      const activation = await window.Auth.ensureActivatedSession('ativacao.html');
      if (!activation) return;

      setStatus('Conta identificada. Abrindo o painel correto da sua area...');
      window.Auth.redirectToDashboard(activation.profile);
    } catch (err) {
      setStatus(err.message || 'Nao foi possivel direcionar o painel.');
      window.setTimeout(() => {
        window.location.href = 'login.html';
      }, 1200);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
