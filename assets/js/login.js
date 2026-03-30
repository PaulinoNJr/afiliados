(() => {
  const refs = {
    form: document.getElementById('loginForm'),
    email: document.getElementById('email'),
    password: document.getElementById('password'),
    status: document.getElementById('statusMessage'),
    loginBtn: document.getElementById('loginBtn')
  };

  function showStatus(message, type = 'danger') {
    refs.status.className = `alert alert-${type}`;
    refs.status.textContent = message;
    refs.status.classList.remove('d-none');
  }

  function setLoading(isLoading) {
    refs.loginBtn.disabled = isLoading;
    refs.loginBtn.textContent = isLoading ? 'Entrando...' : 'Entrar';
  }

  async function init() {
    if (window.AppConfig?.missingConfig) {
      showStatus('Configure SUPABASE_URL e SUPABASE_ANON_KEY em assets/js/config.js.', 'warning');
      return;
    }

    try {
      await window.Auth.redirectIfAuthenticated('admin.html');
    } catch (err) {
      showStatus(err.message || 'Erro ao validar sessao.');
    }

    refs.form.addEventListener('submit', onSubmit);
  }

  async function onSubmit(event) {
    event.preventDefault();

    const email = refs.email.value.trim();
    const password = refs.password.value;

    if (!email || !password) {
      showStatus('Informe email e senha.');
      return;
    }

    setLoading(true);
    refs.status.classList.add('d-none');

    try {
      const { error } = await window.Auth.login(email, password);

      if (error) {
        showStatus(`Falha no login: ${error.message}`);
        return;
      }

      const profile = await window.Auth.getProfile();
      if (!window.Auth.isAccountActive(profile)) {
        const status = profile?.activation_status || 'pending';
        showStatus('Login realizado, mas a conta ainda precisa de ativação por email. Redirecionando...', 'warning');
        setTimeout(() => {
          window.location.href = `ativacao.html?status=${encodeURIComponent(status)}`;
        }, 500);
        return;
      }

      showStatus('Login realizado com sucesso. Redirecionando...', 'success');
      setTimeout(() => {
        window.location.href = 'admin.html';
      }, 500);
    } catch (err) {
      showStatus(err.message || 'Erro inesperado durante login.');
    } finally {
      setLoading(false);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
