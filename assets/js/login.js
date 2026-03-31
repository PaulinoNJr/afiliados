(() => {
  const COPY_BY_TYPE = {
    advertiser: {
      eyebrow: 'Área do anunciante',
      title: 'Entre para gerenciar produtos, campanhas e afiliados',
      description: 'Acesse sua operação comercial com visão de performance, aprovações e governança.'
    },
    affiliate: {
      eyebrow: 'Área do afiliado',
      title: 'Entre para gerar links, acompanhar cliques e ver comissões',
      description: 'Acesse suas campanhas liberadas, materiais, conversões e histórico de ganhos.'
    },
    default: {
      eyebrow: 'Workspace Afiliados',
      title: 'Entre na sua operação com visibilidade comercial',
      description: 'Acesse campanhas, links, produtos, aprovações, comissões e métricas em um ambiente com cara de produto SaaS.'
    }
  };

  const refs = {
    form: document.getElementById('loginForm'),
    email: document.getElementById('email'),
    password: document.getElementById('password'),
    status: document.getElementById('statusMessage'),
    loginBtn: document.getElementById('loginBtn'),
    contextEyebrow: document.getElementById('loginContextEyebrow'),
    contextTitle: document.getElementById('loginContextTitle'),
    contextDescription: document.getElementById('loginContextDescription')
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

  function applyContextFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type');
    const content = COPY_BY_TYPE[type] || COPY_BY_TYPE.default;

    refs.contextEyebrow.textContent = content.eyebrow;
    refs.contextTitle.textContent = content.title;
    refs.contextDescription.textContent = content.description;
  }

  async function init() {
    applyContextFromUrl();

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
        showStatus('Login realizado, mas a conta ainda precisa de ativacao por email. Redirecionando...', 'warning');
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
